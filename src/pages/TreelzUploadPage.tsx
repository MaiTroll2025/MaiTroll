import React, { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Film, Type, Sparkles, AlertTriangle } from 'lucide-react'
import { uploadTreelzVideo, checkUploadBan } from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { moderation } from '@/services/maitrollModeration'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 250 * 1024 * 1024
const MIN_DURATION = 15
const MAX_DURATION = 600

export default function TreelzUploadPage() {
  const { user } = useAuthStore()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [banStatus, setBanStatus] = useState<{ banned: boolean; bannedUntil: string | null; strikes: number } | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (user) {
      checkUploadBan(user.id).then(setBanStatus).catch(() => {})
    }
  }, [user])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      toast.error('File too large. Max 250MB.')
      return
    }
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      setVideoDuration(Math.round(video.duration))
      if (video.duration < MIN_DURATION) {
        toast.error(`Video too short. Minimum ${MIN_DURATION} seconds.`)
        setFile(null)
        setPreview(null)
        setVideoDuration(0)
      }
      if (video.duration > MAX_DURATION) {
        toast.error(`Video too long. Maximum ${MAX_DURATION / 60} minutes.`)
        setFile(null)
        setPreview(null)
        setVideoDuration(0)
      }
    }
    video.src = url
  }, [])

  const handleUpload = async () => {
    if (!file || !user) return
    setUploading(true)
    setProgress(0)
    try {
      // Canonical moderation check for caption
      const modResult = await moderation.checkContent(user.id, caption, 'treelz_caption');
      if (!modResult.allowed) {
        toast.error(modResult.message || 'That caption violates Mai Troll\'s chat rules and was not sent.');
        setUploading(false)
        return
      }
      await uploadTreelzVideo(file, '', caption, user.id, setProgress)
      setUploadSuccess(true)
      toast.success('Treelz uploaded!')
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050715] px-6 text-center">
        <Sparkles className="mb-4 h-12 w-12 text-cyan-400" />
        <h2 className="mb-2 text-lg font-black text-white">Sign In Required</h2>
        <p className="mb-6 text-sm text-slate-400">You need to sign in to upload Treelz.</p>
        <Link to="/auth" className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-black text-white">
          Sign In
        </Link>
      </div>
    )
  }

  if (banStatus?.banned) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050715] px-6 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="mb-2 text-lg font-black text-white">Uploads Disabled</h2>
        <p className="mb-1 text-sm text-slate-400">Your Treelz uploads have been disabled.</p>
        <p className="mb-4 text-xs text-slate-500">
          Re-enabled: {banStatus.bannedUntil ? new Date(banStatus.bannedUntil).toLocaleDateString() : 'Soon'}
        </p>
        <p className="text-xs text-slate-600">Strikes: {banStatus.strikes}</p>
        <Link to="/treelz" className="mt-6 text-sm font-bold text-cyan-400">← Back to Treelz</Link>
      </div>
    )
  }

  if (uploadSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050715] px-6 text-center">
        <Sparkles className="mb-4 h-12 w-12 text-cyan-400" />
        <h2 className="mb-2 text-lg font-black text-white">Treelz Uploaded!</h2>
        <p className="mb-6 text-sm text-slate-400">Your video is now live on Treelz.</p>
        <div className="flex gap-3">
          <Link to="/treelz" className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-black text-white">
            View Treelz
          </Link>
          <button
            onClick={() => { setUploadSuccess(false); setFile(null); setPreview(null); setCaption(''); setVideoDuration(0) }}
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white"
          >
            Upload Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#050715]/90 px-4 py-3 backdrop-blur-xl">
        <Link to="/treelz" className="text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-sm font-black">Upload Treelz</h1>
      </div>

      <div className="mx-auto max-w-lg p-4 space-y-4">
        {!file ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.04] transition hover:border-cyan-400/40 hover:bg-white/[0.08]"
          >
            <Upload className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-bold text-white">Select Video</p>
            <p className="mt-1 text-xs text-slate-500">MP4, WebM • Max 250MB • 15s–10min</p>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video src={preview || ''} className="aspect-video w-full object-contain" controls playsInline />
            <button
              onClick={() => { setFile(null); setPreview(null); setVideoDuration(0) }}
              className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white"
            >
              Change
            </button>
            {videoDuration > 0 && (
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Type className="h-3 w-3" />
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
          />
          <p className="mt-1 text-right text-[10px] text-slate-600">{caption.length}/500</p>
        </div>

        {uploading && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-white">Uploading...</span>
              <span className="text-slate-400">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 py-3 text-sm font-black text-white transition hover:opacity-80 disabled:opacity-40"
        >
          <Film className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload Treelz'}
        </button>

        {banStatus && banStatus.strikes > 0 && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
            <p className="text-xs font-bold text-yellow-400">⚠️ {banStatus.strikes} strike{banStatus.strikes > 1 ? 's' : ''} on record.</p>
            <p className="mt-1 text-[10px] text-yellow-400/70">3 strikes = 1 week upload ban. AI-generated content will be flagged for review.</p>
          </div>
        )}
      </div>
    </div>
  )
}
