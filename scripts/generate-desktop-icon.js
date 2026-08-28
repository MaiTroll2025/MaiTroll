import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createIcoFromPng(pngPath, icoPath) {
  const pngBuffer = fs.readFileSync(pngPath)

  const buffer = Buffer.alloc(22 + pngBuffer.length)

  buffer.writeUInt16LE(0, 0)
  buffer.writeUInt16LE(1, 2)
  buffer.writeUInt16LE(1, 4)

  buffer.writeUInt16LE(256, 6)
  buffer.writeUInt16LE(256, 8)
  buffer.writeUInt8(0, 10)
  buffer.writeUInt8(0, 11)
  buffer.writeUInt16LE(0, 12)
  buffer.writeUInt16LE(256, 14)
  buffer.writeUInt32LE(pngBuffer.length + 22, 16)
  buffer.writeUInt32LE(22, 20)

  pngBuffer.copy(buffer, 22)

  fs.writeFileSync(icoPath, buffer)
  console.log('Generated ICO (PNG-embedded):', icoPath, `(${buffer.length} bytes)`)
}

const sourcePng = path.join(__dirname, '..', 'public', 'icons', 'icon-256.png')
const outputIco = path.join(__dirname, '..', 'public', 'icons', 'maitroll.ico')

if (!fs.existsSync(sourcePng)) {
  console.error('Source PNG not found:', sourcePng)
  process.exit(1)
}

createIcoFromPng(sourcePng, outputIco)
