import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export type EndBroadcastReason = 'manual' | 'unload' | 'disconnect' | 'auto' | 'admin'

export interface BroadcastShutdownOptions {
  /** Resolved stream id for the broadcast being shut down. */
  streamId?: string | null
  /** Current user id (broadcaster). */
  userId?: string | null
  /** Whether a broadcast is currently live (controls `disabled` + guards). */
  isLive?: boolean
  /**
   * Stop the RTC SDK tracks/room. Injected so the hook works for both
   * LiveKit (`room.localParticipant.unpublishTrack` + `room.disconnect`) and
   * Agora (`track.setEnabled(false)` + `track.stop()` + `track.close()` +
   * `client.leave()`). Runs after browser-owned media is stopped.
   */
  stopRtc?: () => void | Promise<void>
  /** Called after the database + realtime work completes (e.g. navigate away). */
  onEnded?: (reason: EndBroadcastReason) => void
  /**
   * Optional getters for the browser-owned local media. Supplied by callers
   * that do not keep the stream in a ref the hook owns (e.g. LiveKit pages
   * that derive a MediaStream from `room.localParticipant`).
   */
  getLocalStream?: () => MediaStream | null
  getLocalVideo?: () => HTMLVideoElement | null
  /** When true, component unmount is a navigation transition, not a real exit. */
  isTransitioning?: boolean
}

export interface BroadcastShutdownApi {
  endingBroadcastRef: React.MutableRefObject<boolean>
  stopMediaStream: (stream?: MediaStream | null) => void
  endBroadcast: (reason?: EndBroadcastReason) => Promise<void>
}

/**
 * One shared shutdown sequence used by every ending path (manual button,
 * tab close, refresh, logout, component unmount, unexpected disconnect).
 *
 * It performs, in order:
 *   1. Stop browser-owned camera/microphone tracks + clear the local preview.
 *   2. Stop tracks managed by the RTC SDK (injected `stopRtc`).
 *   3. Leave/disconnect the RTC room.
 *   4. Mark the broadcast ended in the database.
 *   5. Broadcast a realtime `broadcast_ended` event for admin monitoring.
 *
 * The reentrancy guard (`endingBroadcastRef`) guarantees cleanup runs once
 * even when multiple triggers (pagehide + beforeunload + unmount) fire.
 */
export function useBroadcastShutdown(options: BroadcastShutdownOptions): BroadcastShutdownApi {
  const { streamId, userId, isLive = false, stopRtc, onEnded, getLocalStream, getLocalVideo, isTransitioning = false } = options

  const endingBroadcastRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  // Keep latest values available to stable callbacks without re-subscribing.
  const stopRtcRef = useRef(stopRtc)
  const onEndedRef = useRef(onEnded)
  stopRtcRef.current = stopRtc
  onEndedRef.current = onEnded

  const streamIdRef = useRef(streamId)
  const userIdRef = useRef(userId)
  const getLocalStreamRef = useRef(getLocalStream)
  const getLocalVideoRef = useRef(getLocalVideo)
  streamIdRef.current = streamId
  userIdRef.current = userId
  getLocalStreamRef.current = getLocalStream
  getLocalVideoRef.current = getLocalVideo

  const stopMediaStream = useCallback((stream?: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        /* ignore */
      }
      try {
        stream.removeTrack(track)
      } catch {
        /* ignore */
      }
    })
  }, [])

  const endBroadcast = useCallback(
    async (reason: EndBroadcastReason = 'manual') => {
      if (endingBroadcastRef.current) return
      endingBroadcastRef.current = true

      try {
        // 1. Stop browser-owned camera and microphone tracks immediately.
        const localStream = getLocalStreamRef.current?.() ?? localStreamRef.current
        stopMediaStream(localStream)
        localStreamRef.current = null

        const localVideo = getLocalVideoRef.current?.() ?? localVideoRef.current
        if (localVideo) {
          try {
            localVideo.pause()
          } catch {
            /* ignore */
          }
          localVideo.srcObject = null
        }

        // 2 + 3. Stop RTC SDK tracks and leave/disconnect the room.
        try {
          await Promise.resolve(stopRtcRef.current?.())
        } catch (rtcErr) {
          console.warn('[useBroadcastShutdown] stopRtc failed:', rtcErr)
        }

        // 4. Update the authoritative broadcast record.
        const sid = streamIdRef.current
        if (sid) {
          const endedAt = new Date().toISOString()

          const { error } = await supabase
            .from('streams')
            .update({
              status: 'ended',
              is_live: false,
              ended_at: endedAt,
              rtc_connected: false,
              camera_enabled: false,
              microphone_enabled: false,
              end_reason: reason,
            })
            .eq('id', sid)

          if (error) throw error

          try {
            await supabase.functions.invoke('bunny-live-stop', {
              body: { streamId: sid },
            })
          } catch (bunnyErr) {
            console.warn('[useBroadcastShutdown] bunny-live-stop failed:', bunnyErr)
          }

          // 5. Notify admin monitoring without waiting for polling.
          try {
            await supabase.channel('rtc-admin-monitor').send({
              type: 'broadcast',
              event: 'broadcast_ended',
              payload: {
                stream_id: sid,
                broadcaster_id: userIdRef.current,
                ended_at: endedAt,
                reason,
              },
            })
          } catch (broadcastErr) {
            console.warn('[useBroadcastShutdown] broadcast_ended send failed:', broadcastErr)
          }
        }

        onEndedRef.current?.(reason)
      } catch (err) {
        console.error('[useBroadcastShutdown] endBroadcast failed:', err)
      } finally {
        endingBroadcastRef.current = false
      }
    },
    [stopMediaStream],
  )

  // Lifecycle protection: runs the same cleanup on tab close, refresh,
  // logout, component unmount, and unexpected disconnect.
  //
  // IMPORTANT: we deliberately do NOT end the broadcast on `visibilitychange`
  // (tab hidden). Backgrounding the tab — e.g. the broadcaster opening the
  // viewer page to check their own stream, or a phone locking/switching apps —
  // is not the same as ending the stream. Ending on `hidden` was killing
  // healthy streams "before they fully started" the moment the broadcaster
  // switched away. `pagehide`/`beforeunload` still cover real teardown.
  useEffect(() => {
    const handlePageHide = () => {
      void endBroadcast('unload')
    }
    const handleBeforeUnload = () => {
      void endBroadcast('unload')
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)

      if (isTransitioning) {
        return
      }

      // Media must still stop locally during component destruction even if
      // the async DB/realtime work cannot complete.
      const localStream = getLocalStreamRef.current?.() ?? localStreamRef.current
      stopMediaStream(localStream)
      localStreamRef.current = null

      const localVideo = getLocalVideoRef.current?.() ?? localVideoRef.current
      if (localVideo) {
        try {
          localVideo.srcObject = null
        } catch {
          /* ignore */
        }
      }

      // Best-effort leave on unmount; do not await (component is tearing down).
      void Promise.resolve(stopRtcRef.current?.()).catch(() => undefined)
    }
  }, [endBroadcast, stopMediaStream, isLive])

  // Heartbeat: while a broadcast is live, keep `last_heartbeat_at` fresh in the
  // database as a lightweight "browser still open" signal for admin monitoring.
  useEffect(() => {
    if (!isLive || !streamIdRef.current) return

    const beat = () => {
      const sid = streamIdRef.current
      if (!sid) return
      void supabase
        .from('streams')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', sid)
        .then(() => undefined, () => undefined)
    }

    beat()
    const interval = window.setInterval(beat, 20_000)
    return () => window.clearInterval(interval)
  }, [isLive, endBroadcast])

  return {
    endingBroadcastRef,
    stopMediaStream,
    endBroadcast,
  }
}
