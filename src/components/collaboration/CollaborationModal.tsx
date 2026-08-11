import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Users, X } from 'lucide-react'
import { resolveDisplayName } from '../../lib/streamCollaboration'
import { cn } from '../../lib/utils'
import type { CollaborationBroadcasterOption } from '../../lib/streamCollaboration'

interface CollaborationModalProps {
  open: boolean
  onClose: () => void
  broadcasters: CollaborationBroadcasterOption[]
  loading: boolean
  onRequest: (broadcaster: CollaborationBroadcasterOption) => Promise<{ ok: boolean; error?: string }>
}

export default function CollaborationModal({ open, onClose, broadcasters, loading, onRequest }: CollaborationModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setBusyId(null)
      setFeedback(null)
    }
  }, [open])

  const sortedBroadcasters = useMemo(() => {
    return [...broadcasters].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0))
  }, [broadcasters])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          className="w-full max-w-2xl rounded-[28px] border border-cyan-400/25 bg-slate-950/95 p-4 shadow-[0_0_60px_rgba(34,211,238,0.15)] sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Shared collaboration
              </div>
              <h3 className="mt-3 text-xl font-black text-white">Invite a live broadcaster</h3>
              <p className="mt-1 text-sm text-slate-400">Bring your audience into one shared stream and keep the collaboration separate from the core battle system.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {feedback ? <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">{feedback}</div> : null}

          <div className="mt-5 max-h-[60vh] space-y-3 overflow-auto pr-1">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Loading active broadcasters…</div>
            ) : sortedBroadcasters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">No eligible broadcasters are currently live.</div>
            ) : (
              sortedBroadcasters.map((broadcaster) => (
                <div key={broadcaster.stream_id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-400/40 to-purple-500/40" />
                        <div className="min-w-0">
                          <div className="truncate font-black text-white">{resolveDisplayName({ username: broadcaster.username }, 'Broadcaster')}</div>
                          <div className="truncate text-xs text-slate-400">{broadcaster.title || 'Live stream'}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{broadcaster.category || 'Live'}</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{broadcaster.viewer_count ?? 0} viewers</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{broadcaster.current_collaboration_participants ?? 0}/{broadcaster.available_collaboration_capacity ?? 5} collab seats</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusyId(broadcaster.stream_id)
                        setFeedback(null)
                        const result = await onRequest(broadcaster)
                        setBusyId(null)
                        setFeedback(result.ok ? `Collaboration request sent to ${resolveDisplayName({ username: broadcaster.username }, 'Broadcaster')}.` : result.error || 'Unable to send request')
                      }}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-3.5 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25',
                        busyId === broadcaster.stream_id && 'opacity-70',
                      )}
                    >
                      <Users className="h-4 w-4" />
                      {busyId === broadcaster.stream_id ? 'Sending…' : 'Request'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
