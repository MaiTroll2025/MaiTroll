import React, { useCallback, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useSquads } from '@/lib/hooks/useSquads'
import { toast } from 'sonner'
import { ShieldAlert, Coins, Upload, X } from 'lucide-react'

const BUCKET = 'squad-assets'

function ImageUploader({
  currentUrl,
  label,
  accept,
  maxSizeMB = 5,
  onChange,
}: {
  currentUrl?: string | null
  label: string
  accept: string
  maxSizeMB?: number
  onChange: (url: string | null) => void
}) {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be less than ${maxSizeMB}MB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!user || !preview) return
    setUploading(true)
    try {
      const blob = await (async () => {
        const res = await fetch(preview)
        return res.blob()
      })()
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, blob, {
        contentType: accept,
        upsert: true,
      })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) throw new Error('Failed to get public URL')
      onChange(publicUrl)
      setPreview(null)
      toast.success(`${label} uploaded`)
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(`Failed to upload ${label}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-300 uppercase">{label}</label>
      <div className="relative flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
        >
          <Upload className="w-3 h-3" /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {currentUrl && (
          <button
            onClick={() => { setPreview(null); onChange(null) }}
            className="rounded-xl px-3 py-2 text-xs font-bold text-red-400 bg-red-900/10 border border-red-500/20 hover:bg-red-500/20 transition"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        )}
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
            <div className="w-48 h-48 mx-auto rounded-xl overflow-hidden mb-4 border border-white/10">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition disabled:opacity-50"
              >
                {uploading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SquadCreate() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { createSquad, loading } = useSquads()

  const [form, setForm] = useState({
    name: '', tag: '', description: '', rules: '', block_name: '',
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { toast.error('Authentication required'); return }
    if (!form.name.trim()) { toast.error('Squad name is required'); return }
    if (!form.tag.trim()) { toast.error('Squad tag is required'); return }
    if (!/^[A-Z0-9]{2,6}$/.test(form.tag.trim())) {
      toast.error('Tag must be 2–6 uppercase letters/numbers'); return
    }
    const res = await createSquad({
      name: form.name.trim(),
      tag: form.tag.trim().toUpperCase(),
      description: form.description.trim() || null,
      rules: form.rules.trim() || null,
      logo_url: logoUrl,
      cover_url: coverUrl,
      block_name: form.block_name.trim() || null,
    })
    if (res.success) {
      navigate(`/squads/${(res.squad as any)?.slug}`)
    }
  }, [user, form, logoUrl, coverUrl, createSquad, navigate])

  const coins = Number((profile as any)?.troll_coins ?? 0)

  return (
    <div className="min-h-screen bg-[#070511] text-white p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 rounded-xl border border-white/10 bg-[#10101a]/60 p-5">
          <h1 className="text-3xl font-black tracking-tight mb-1">Create Squad</h1>
          <p className="text-sm text-slate-400">
            A Squad is your broadcasting community inside MaiTroll City. Creation costs <b>3,000 Troll Coins</b>. You will become the Squad Leader and can lead one active Squad at a time.
          </p>
          <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-200 flex items-center gap-2">
            <Coins className="w-4 h-4" /> You have {coins.toLocaleString()} TC — {coins >= 3000 ? 'sufficient' : 'insufficient'} for creation.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/10 bg-[#10101a]/60 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Squad Name</label>
              <input
                name="name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Neon Broadcasters"
                className="w-full rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Tag</label>
              <input
                name="tag" value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                placeholder="e.g. NEON"
                maxLength={6}
                className="w-full rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none text-uppercase font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase">Description</label>
            <textarea
              name="description" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is your Squad about?"
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase">Squad Rules</label>
            <textarea
              name="rules" value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              placeholder="Membership expectations, behavior, broadcasting standards…"
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase">Virtual City Block</label>
            <input
              name="block_name" value={form.block_name}
              onChange={(e) => setForm({ ...form, block_name: e.target.value })}
              placeholder="e.g. Neon Row"
              className="w-full rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none"
            />
            <p className="text-xs text-slate-500">Your Squad&apos;s dedicated block inside MaiTroll City.</p>
          </div>

          <ImageUploader currentUrl={logoUrl} label="Squad Logo" accept="image/*" onChange={setLogoUrl} />
          <ImageUploader currentUrl={coverUrl} label="Squad Cover Photo" accept="image/*" onChange={setCoverUrl} />

          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-slate-400 mb-2">
              <ShieldAlert className="w-3 h-3 inline" /> Costs 3,000 Troll Coins (deducted atomically). No charge if creation fails.
            </p>
            <button
              type="submit"
              disabled={loading || coins < 3000}
              className={`w-full rounded-xl py-3 font-bold text-white transition ${coins < 3000 ? 'bg-slate-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/30'}`}
            >
              {loading ? 'Creating…' : `Create Squad (3,000 TC)`}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          You may only lead or belong to one active Squad at a time. Joining a Squad as a member costs 100 Troll Coins (50 to your Leader, 50 to MaiTroll&apos;s administrative pool).
        </p>
      </div>
    </div>
  )
}
