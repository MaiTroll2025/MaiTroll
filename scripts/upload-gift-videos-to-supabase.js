import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import dotenv from 'dotenv'

dotenv.config()

const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mov', '.mkv']
const CONVERT_EXTENSIONS = ['.mp4', '.mov', '.mkv']
const DEFAULT_INPUT_DIR = 'C:/Users/kainm/Videos/Gifts'

const inputDirArgIndex = process.argv.findIndex((arg) => arg === '--input-dir')
const inputDirArg = inputDirArgIndex >= 0 ? process.argv[inputDirArgIndex + 1] : undefined
const INPUT_DIR = path.resolve(inputDirArg || process.env.GIFT_VIDEO_INPUT_DIR || DEFAULT_INPUT_DIR)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[upload-gift-videos] ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const STORAGE_BUCKET = 'gift-videos'

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find((bucket) => bucket.name === STORAGE_BUCKET)) {
    console.log(`[upload-gift-videos] Creating bucket: ${STORAGE_BUCKET}`)
    const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ['video/webm', 'video/mp4'],
      fileSizeLimit: 50 * 1024 * 1024,
    })
    if (error) {
      console.error(`[upload-gift-videos] Failed to create bucket:`, error.message)
      process.exit(1)
    }
    console.log(`[upload-gift-videos] Created bucket: ${STORAGE_BUCKET}`)
  }
}

function slugify(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function convertToWebMAlpha(inputPath, outputPath) {
  const cmd = [
    'ffmpeg',
    '-i', `"${inputPath}"`,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',
    '-y',
    `"${outputPath}"`,
  ].join(' ')
  console.log(`[upload-gift-videos] Converting to WebM: ${inputPath} -> ${outputPath}`)
  execSync(cmd, { stdio: 'inherit' })
}

async function uploadFile(filePath, slug) {
  const ext = path.extname(filePath).toLowerCase()
  const fileBuffer = fs.readFileSync(filePath)
  const fileName = `${slug}.webm`
  const tempWebmPath = path.join(path.dirname(filePath), `${slug}.webm`)

  let bufferToUpload = fileBuffer

  if (CONVERT_EXTENSIONS.includes(ext)) {
    if (!hasFfmpeg()) {
      console.log(`[upload-gift-videos] FFmpeg not found, uploading ${ext} file directly as ${fileName}`)
    } else {
      convertToWebMAlpha(filePath, tempWebmPath)
      if (!fs.existsSync(tempWebmPath)) {
        console.error(`[upload-gift-videos] Conversion failed for ${filePath}, uploading original instead`)
      } else {
        bufferToUpload = fs.readFileSync(tempWebmPath)
        fs.unlinkSync(tempWebmPath)
      }
    }
  }

  const contentType = ext === '.mp4' ? 'video/mp4' : 'video/webm'

  console.log(`[upload-gift-videos] Uploading: ${fileName}`)

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, bufferToUpload, {
      contentType,
      upsert: true,
    })

  if (error) {
    console.error(`[upload-gift-videos] Upload failed for ${fileName}:`, error.message)
    return null
  }

  console.log(`[upload-gift-videos] Uploaded: ${fileName}`)
  return fileName
}

async function getPublicUrl(fileName) {
  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

async function updateGiftItem(slug, animationUrl, giftName) {
  const names = [giftName, giftName.toLowerCase(), giftName.replace(/\s+/g, '-').toLowerCase(), normalizeValue(giftName)]
  const slugs = [slug, `gift-${slug}`, `gift_${slug}`, normalizeValue(slug)]
  const candidates = Array.from(new Set([...slugs, ...names].filter(Boolean)))

  let matchedRows = []

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from('gift_items')
      .select('id, gift_slug, name, coin_cost')
      .or(`gift_slug.eq.${candidate},gift_slug.eq.gift_${candidate},gift_slug.eq.gift-${candidate},name.eq.${candidate},name.eq.${normalizeValue(candidate)}`)
      .limit(20)

    if (error) {
      console.error(`[upload-gift-videos] DB lookup failed for "${candidate}":`, error.message)
      continue
    }

    if (data && data.length > 0) {
      matchedRows.push(...data)
    }
  }

  const uniqueRows = Array.from(new Map(matchedRows.map((row) => [row.id, row])).values())
  if (uniqueRows.length === 0) {
    console.warn(`[upload-gift-videos] No gift_items row found for slug: ${slug} or name: ${giftName}`)
    return false
  }

  const { error: updateError } = await supabaseAdmin
    .from('gift_items')
    .update({ animation_url: animationUrl, animation_type: 'video', is_active: true })
    .in('id', uniqueRows.map((row) => row.id))

  if (updateError) {
    console.error(`[upload-gift-videos] DB update failed for ${slug}:`, updateError.message)
    return false
  }

  console.log(`[upload-gift-videos] Updated gift_items rows: ${uniqueRows.map((row) => row.name || row.gift_slug).join(', ')}`)
  return true
}

async function removeStaleStorageObjects(keepNames) {
  const { data: objects, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list('', { limit: 1000 })
  if (error) {
    console.error('[upload-gift-videos] Could not list storage objects:', error.message)
    return
  }

  const staleNames = (objects || [])
    .map((object) => object.name)
    .filter((name) => name && !keepNames.has(name))

  if (staleNames.length === 0) {
    console.log('[upload-gift-videos] No stale gift videos to remove from storage')
    return
  }

  const { error: removeError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(staleNames)
  if (removeError) {
    console.error('[upload-gift-videos] Failed to remove stale storage objects:', removeError.message)
    return
  }

  console.log(`[upload-gift-videos] Removed ${staleNames.length} stale storage object(s)`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  await ensureBucket()

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[upload-gift-videos] ERROR: Input directory not found: ${INPUT_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(INPUT_DIR)
    .filter((file) => VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase()))

  if (files.length === 0) {
    console.log(`[upload-gift-videos] No supported video files found in input directory: ${INPUT_DIR}`)
    process.exit(0)
  }

  console.log(`[upload-gift-videos] Found ${files.length} file(s) to process`)

  let success = 0
  let failed = 0
  const uploadedFileNames = new Set()

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file)
    const slug = slugify(file)
    const giftName = path.basename(file, path.extname(file))

    if (dryRun) {
      console.log(`[upload-gift-videos] DRY RUN: Would process ${file} (slug: ${slug})`)
      continue
    }

    const uploadedFileName = await uploadFile(filePath, slug)
    if (!uploadedFileName) {
      failed++
      continue
    }

    uploadedFileNames.add(uploadedFileName)

    const publicUrl = await getPublicUrl(uploadedFileName)
    if (!publicUrl) {
      console.error(`[upload-gift-videos] Could not get public URL for ${uploadedFileName}`)
      failed++
      continue
    }

    const updated = await updateGiftItem(slug, publicUrl, giftName)
    if (updated) {
      success++
    } else {
      failed++
    }
  }

  if (!dryRun) {
    await removeStaleStorageObjects(uploadedFileNames)
  }

  console.log(`[upload-gift-videos] Complete: ${success} succeeded, ${failed} failed`)
}

main().catch((err) => {
  console.error('[upload-gift-videos] Fatal error:', err)
  process.exit(1)
})