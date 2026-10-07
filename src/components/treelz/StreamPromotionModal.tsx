import React, { useState } from 'react'
import { Radio, Users, Share2, X } from 'lucide-react'
import { promoteLiveStreamToTreelz } from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

interface StreamPromotionModalProps {
  isOpen: boolean
  onClose: () => void
  streamId: string
  streamTitle: string
  viewerCount: number
}

export default function StreamPromotionModal({
  isOpen,
  onClose,
  streamId,
  streamTitle,
  viewerCount,
}: StreamPromotionModalProps) {
  const { user } = useAuthStore()
  const [promoting, setPromoting] = useState(false)

  if (!isOpen) return null

  const handlePromote = async () => {
    if (!user) return
    setPromoting(true)
    try {
      // In production, this would capture a 15s clip from the stream
      // For now we use a placeholder flow
      await promoteLiveStreamToTreelz(
        user.id,
        streamId,
        '', // Would be the captured clip URL
        '', // Would be the thumbnail URL
      )
      toast.success('Stream promoted to Treelz!')
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to promote stream')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0d1f]/95 p-6 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Share to Treelz</h3>
            <p className="text-[10px] text-slate-400">Promote your live stream</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-bold">{viewerCount} viewers</span>
            <span className="text-slate-500">•</span>
            <span className="truncate">{streamTitle}</span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-300">
            This will create a 15-second preview clip from your stream with a &quot;Join Live&quot; button on Treelz.
          </p>
        </div>

        <button
          onClick={handlePromote}
          disabled={promoting || viewerCount < 20}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 py-3 text-sm font-black text-white transition hover:opacity-80 disabled:opacity-40"
        >
          <Share2 className="h-4 w-4" />
          {promoting ? 'Promoting...' : 'Share to Treelz'}
        </button>

        {viewerCount < 20 && (
          <p className="mt-2 text-center text-[10px] text-red-400">
            Need 20+ viewers to promote
          </p>
        )}
      </div>
    </div>
  )
}
