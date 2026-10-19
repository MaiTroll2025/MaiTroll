import { useCallback, useMemo, useRef, useState } from 'react'
import { MessageSquareOff, Move, Shield, UserRoundX, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { isStaffProfile } from '@/lib/staff'
import { useAuthStore } from '@/lib/store'
import { rpcModoEndStream, rpcModeratorDisableChat, rpcModeratorKickUser } from '@/types/moderationActions'
import type { StreamAudienceMember } from '@/hooks/useStreamAudiencePresence'

interface ModParticipant {
  userId: string
  username: string
  seatIndex?: number
}

interface PhoneViewerRtcModButtonProps {
  streamId: string
  broadcasterId: string
  audience: StreamAudienceMember[]
  seats: Array<{ userId: string | null; displayName: string; seatIndex: number; isOccupied: boolean }>
  currentUserId?: string
}

export default function PhoneViewerRtcModButton({
  streamId,
  broadcasterId,
  audience,
  seats,
  currentUserId,
}: PhoneViewerRtcModButtonProps) {
  const profile = useAuthStore((state) => state.profile)
  const [open, setOpen] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [endingStream, setEndingStream] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const draggingRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const draggedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const participants = useMemo(() => {
    const byUserId = new Map<string, ModParticipant>()
    for (const member of audience) {
      if (!member.user_id || member.user_id === currentUserId || member.user_id === broadcasterId) continue
      byUserId.set(member.user_id, { userId: member.user_id, username: member.username || 'Viewer' })
    }
    for (const seat of seats) {
      if (!seat.isOccupied || !seat.userId || seat.userId === currentUserId || seat.userId === broadcasterId) continue
      const participant = byUserId.get(seat.userId)
      byUserId.set(seat.userId, {
        userId: seat.userId,
        username: seat.displayName || participant?.username || `Seat ${seat.seatIndex}`,
        seatIndex: seat.seatIndex,
      })
    }
    return [...byUserId.values()].sort((a, b) => a.username.localeCompare(b.username))
  }, [audience, broadcasterId, currentUserId, seats])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button') && event.currentTarget.tagName.toLowerCase() !== 'button') return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    draggedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
    }
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = draggingRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (Math.abs(event.clientX - drag.x) > 4 || Math.abs(event.clientY - drag.y) > 4) {
      draggedRef.current = true
    }
    const rect = panelRef.current?.getBoundingClientRect()
    const width = rect?.width ?? 320
    const height = rect?.height ?? 420
    setPosition({
      left: Math.min(Math.max(8, drag.left + event.clientX - drag.x), window.innerWidth - width - 8),
      top: Math.min(Math.max(8, drag.top + event.clientY - drag.y), window.innerHeight - height - 8),
    })
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (draggingRef.current?.pointerId !== event.pointerId) return
    draggingRef.current = null
    if (draggedRef.current) {
      window.setTimeout(() => { draggedRef.current = false }, 0)
    }
  }, [])

  const handleKick = useCallback(async (participant: ModParticipant) => {
    if (!window.confirm(`Kick ${participant.username} from this stream?`)) return
    setBusyUserId(participant.userId)
    try {
      const result = await rpcModeratorKickUser(streamId, participant.userId, 'Removed by staff from phone viewer')
      if (!result.success) throw new Error(result.message || 'Unable to kick this user')
      toast.success(`${participant.username} was removed from the stream`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to kick this user')
    } finally {
      setBusyUserId(null)
    }
  }, [streamId])

  const handleDisableChat = useCallback(async (participant: ModParticipant) => {
    setBusyUserId(participant.userId)
    try {
      const result = await rpcModeratorDisableChat(
        streamId,
        participant.userId,
        30,
        'Chat disabled by staff from phone viewer',
      )
      if (!result.success) throw new Error(result.message || 'Unable to disable chat')
      toast.success(`${participant.username}'s chat was disabled for 30 minutes`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disable chat')
    } finally {
      setBusyUserId(null)
    }
  }, [streamId])

  const handleEndStream = useCallback(async () => {
    if (!window.confirm('End this live stream for everyone?')) return
    setEndingStream(true)
    try {
      const result = await rpcModoEndStream(
        streamId,
        broadcasterId,
        'Stream ended by staff from phone viewer',
        60,
      )
      if (!result.success) throw new Error(result.message || 'Unable to end this stream')
      toast.success('Stream ended')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to end this stream')
    } finally {
      setEndingStream(false)
    }
  }, [broadcasterId, streamId])

  if (!isStaffProfile(profile) || !streamId || !broadcasterId) return null

  return (
    <div
      ref={panelRef}
      className="fixed z-[600]"
      style={position ? { left: position.left, top: position.top } : { right: 12, bottom: 112 }}
    >
      {open ? (
        <section className="w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-cyan-300/30 bg-slate-950/95 text-white shadow-[0_12px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div
            className="flex cursor-move touch-none items-center gap-2 border-b border-white/10 bg-slate-900/90 px-3 py-2.5"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Drag moderator panel"
          >
            <Move size={14} className="text-cyan-300" />
            <Shield size={15} className="text-cyan-200" />
            <span className="flex-1 text-xs font-black uppercase tracking-wider">RTC stream moderation</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close moderator panel">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[min(58dvh,480px)] overflow-y-auto p-3">
            <button
              type="button"
              onClick={() => void handleEndStream()}
              disabled={endingStream}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2.5 text-xs font-bold text-red-100 disabled:opacity-50"
            >
              <UserRoundX size={15} />
              {endingStream ? 'Ending stream…' : 'End stream for everyone'}
            </button>

            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/60">
              <Users size={14} />
              Stream viewers and seats ({participants.length})
            </div>

            {participants.length === 0 ? (
              <p className="rounded-lg bg-white/5 px-3 py-4 text-center text-xs text-white/50">No other active viewers or seated users.</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((participant) => {
                  const busy = busyUserId === participant.userId
                  return (
                    <li key={participant.userId} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold">
                          {participant.username}
                        </span>
                        {participant.seatIndex !== undefined && (
                          <span className="shrink-0 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] text-cyan-200">
                            Seat {participant.seatIndex}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDisableChat(participant)}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-400/10 px-2 py-2 text-[10px] font-bold text-amber-100 disabled:opacity-50"
                        >
                          <MessageSquareOff size={13} />
                          Disable chat 30m
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleKick(participant)}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-red-400/10 px-2 py-2 text-[10px] font-bold text-red-100 disabled:opacity-50"
                        >
                          <UserRoundX size={13} />
                          {busy ? 'Working…' : 'Kick'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            if (draggedRef.current) {
              event.preventDefault()
              return
            }
            setOpen(true)
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Open draggable RTC stream moderation"
          title="RTC stream moderation"
          className="flex h-12 w-12 touch-none items-center justify-center rounded-full border border-cyan-300/50 bg-slate-950/90 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.35)] backdrop-blur-xl"
        >
          <Shield size={20} />
        </button>
      )}
    </div>
  )
}
