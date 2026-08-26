import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Radio } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { cn } from '../../../lib/utils'

interface PendingInvite {
  notificationId: string
  inviteId: string
  broadcastId: string
  streamTitle?: string | null
  senderUsername?: string | null
  senderAvatarUrl?: string | null
  expiresAt?: string | null
  actionUrl: string
}

function parseInvite(row: any): PendingInvite | null {
  const metadata = row?.metadata || {}
  const broadcastId = metadata.broadcast_id || metadata.stream_id
  const inviteId = metadata.invite_id
  if (!broadcastId || !inviteId) return null

  return {
    notificationId: row.id,
    inviteId,
    broadcastId: String(broadcastId),
    streamTitle: metadata.stream_title ?? null,
    senderUsername: metadata.sender_username ?? null,
    senderAvatarUrl: metadata.sender_avatar_url ?? null,
    expiresAt: metadata.expires_at ?? null,
    actionUrl: metadata.action_url || `/watch/${broadcastId}?mkey=${inviteId}`,
  }
}

/**
 * The live MKey invitation.
 *
 * Rule 8: an invited user is, by definition, already inside another broadcast —
 * so the invitation has to reach them *there*, in the moment, with a single
 * JOIN LIVE action that deep-links straight into the target ViewerPage /
 * PhoneViewerPage.
 *
 * Rule 14: JOIN LIVE only navigates. It never claims. The claim is settled by
 * the server once a real broadcast session is verified on the target page.
 */
export default function MKeyInvitePopup() {
  const { user } = useAuthStore()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const location = useLocation()

  const [invite, setInvite] = useState<PendingInvite | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const seenRef = useRef<Set<string>>(new Set())

  const dismiss = useCallback(() => setInvite(null), [])

  // Realtime delivery: the invitation arrives while the user is watching
  // something else.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`mkey-invites:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload as any).new
          if (!row || row.type !== 'mkey_invite') return
          if (seenRef.current.has(row.id)) return
          seenRef.current.add(row.id)

          const parsed = parseInvite(row)
          if (!parsed) return
          setInvite(parsed)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Countdown to the claim window closing.
  useEffect(() => {
    if (!invite?.expiresAt) {
      setSecondsLeft(null)
      return
    }

    const expiry = new Date(invite.expiresAt).getTime()
    const tick = () => {
      const remaining = Math.round((expiry - Date.now()) / 1000)
      if (remaining <= 0) {
        setSecondsLeft(0)
        setInvite(null)
        return
      }
      setSecondsLeft(remaining)
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [invite?.expiresAt, invite?.inviteId])

  // Never nag someone who is already standing in the target room.
  const suppressed = useMemo(() => {
    if (!invite) return true
    return location.pathname.includes(invite.broadcastId)
  }, [invite, location.pathname])

  const handleJoin = useCallback(() => {
    if (!invite) return
    const target = invite.actionUrl
    setInvite(null)

    // Mark read so the invitation does not linger in Trollifications.
    void supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', invite.notificationId)
      .then(undefined, () => {})

    navigate(target)
  }, [invite, navigate])

  if (!invite || suppressed) return null

  const countdown =
    secondsLeft === null
      ? null
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="fixed left-1/2 top-4 z-[200] w-[min(92vw,380px)] -translate-x-1/2"
        role="alert"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-cyan-400/35 bg-slate-950/95 p-4',
            'shadow-[0_0_38px_rgba(45,212,191,0.30)] backdrop-blur-xl'
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_48%)]" />

          <button
            type="button"
            onClick={dismiss}
            className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss MKey invite"
          >
            <X size={14} />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                🔑
              </span>
              <h4 className="text-sm font-black tracking-tight text-white">MKey Invite</h4>
              {countdown && (
                <span className="ml-auto mr-6 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                  {countdown}
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-start gap-3">
              {invite.senderAvatarUrl ? (
                <img
                  src={invite.senderAvatarUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-cyan-400/30 object-cover"
                />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                  <Radio size={16} />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-white">
                  <span className="font-bold text-cyan-200">@{invite.senderUsername || 'Someone'}</span> wants you to
                  check out this live broadcast.
                </p>
                {invite.streamTitle && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{invite.streamTitle}</p>
                )}
                <p className="mt-1 text-[11px] font-semibold text-purple-200">
                  Join the broadcast to claim your MKey.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleJoin}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-500 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_0_22px_rgba(45,212,191,0.35)] transition-all hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500"
            >
              Join Live
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
