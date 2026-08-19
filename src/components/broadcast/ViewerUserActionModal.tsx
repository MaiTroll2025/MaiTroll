import React, { useState, useEffect } from 'react'
import { X, UserPlus, Mail, Flag, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import { useChatStore } from '../../lib/chatStore'
import { supabase } from '../../lib/supabase'
import { rpcSubmitReport } from '../../types/moderationActions'
import { REPORT_REASONS, type ReportReason } from '../../types/moderation'

interface ViewerUserActionModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  username: string
  avatarUrl?: string | null
  streamId: string
}

export default function ViewerUserActionModal({
  isOpen,
  onClose,
  userId,
  username,
  avatarUrl,
  streamId,
}: ViewerUserActionModalProps) {
  const { user } = useAuthStore()
  const openChatBubble = useChatStore((state) => state.openChatBubble)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | ''>('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !user) return
    let cancelled = false
    const checkFollow = async () => {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle()
      if (!cancelled) setIsFollowing(!!data)
    }
    checkFollow()
    return () => { cancelled = true }
  }, [isOpen, user, userId])

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow users')
      return
    }
    setFollowLoading(true)
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId)
        if (error) throw error
        setIsFollowing(false)
        toast.success(`Unfollowed ${username}`)
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: userId })
        if (error) throw error
        setIsFollowing(true)
        toast.success(`Following ${username}`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update follow')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleMessage = () => {
    if (!user) {
      toast.error('Please sign in to send messages')
      return
    }
    openChatBubble(userId, username, avatarUrl || '')
    onClose()
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !reportReason) return
    setReportLoading(true)
    try {
      const response = await rpcSubmitReport(userId, streamId, reportReason, reportDescription.trim() || null)
      if (response.success) {
        toast.success('Report submitted. Our Troll Officers will review soon.')
        setReportReason('')
        setReportDescription('')
        setShowReport(false)
        onClose()
      } else {
        toast.error(response.message || 'Failed to submit report')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report')
    } finally {
      setReportLoading(false)
    }
  }

  if (!isOpen) return null

  if (showReport) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="text-base font-black text-white">Report {username}</h3>
            <button onClick={() => { setShowReport(false); setReportReason(''); setReportDescription(''); }} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleReportSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">Reason</label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setReportReason(reason.id as ReportReason)}
                    className={cn(
                      'w-full text-left rounded-xl border px-3 py-2 text-sm transition-all',
                      reportReason === reason.id
                        ? 'border-red-400/50 bg-red-500/15 text-red-200'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                    )}
                  >
                    <span className="font-bold">{reason.label}</span>
                    <span className="block text-xs text-zinc-500">{reason.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Description (optional)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-red-400/50 resize-none"
                placeholder="Additional details..."
              />
            </div>
            <button
              type="submit"
              disabled={!reportReason || reportLoading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition-all"
            >
              {reportLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
              ) : (
                username ? username.charAt(0).toUpperCase() : <UserPlus className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="font-bold text-white text-sm">{username}</div>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2">
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all',
              isFollowing
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:text-white'
            )}
          >
            <UserPlus className="h-5 w-5" />
            <span className="text-[11px] font-bold">{isFollowing ? 'Following' : 'Follow'}</span>
          </button>
          <button
            onClick={handleMessage}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-slate-300 transition-all hover:border-cyan-300/35 hover:text-white"
          >
            <Mail className="h-5 w-5" />
            <span className="text-[11px] font-bold">Message</span>
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-slate-300 transition-all hover:border-red-400/35 hover:text-red-200"
          >
            <Flag className="h-5 w-5" />
            <span className="text-[11px] font-bold">Report</span>
          </button>
        </div>
      </div>
    </div>
  )
}
