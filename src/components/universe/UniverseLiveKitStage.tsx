// ============================================================================
// Universe Battle — LiveKit stage for on-stage battlers.
//
// STREAMING MODEL (authoritative, defined by product):
//   - Host + seat users (BOTH teams) are PUBLISHERS on LiveKit.
//   - Winning users stay on LiveKit with the host that invited them (publishers).
//   - Registered users in the queue + every other viewer watch via MUX
//     low-latency HLS playback. When a registered user becomes a battler they
//     switch Mux -> LiveKit; when the battle ends (and they are not a winner)
//     they switch back to Mux.
//
// This component is the single switch point: when `isOnStage` is true it
// publishes the local camera/mic to the round's LiveKit room at the lowest
// practical latency; otherwise it renders the provided Mux playbackId.
// ============================================================================
import React, { useEffect, useMemo, useRef } from 'react'
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom'
import UniverseMuxPlayer from './UniverseMuxPlayer'
import { Mic, Video, Loader2, Wifi } from 'lucide-react'
import { applyCameraVideoPresentation } from '../../lib/cameraVideoPresentation'

interface UniverseLiveKitStageProps {
  roomName: string | null | undefined
  userId: string | null | undefined
  userName?: string | null
  isOnStage: boolean
  playbackId?: string | null
  muted?: boolean
  className?: string
}

export default function UniverseLiveKitStage({
  roomName,
  userId,
  userName,
  isOnStage,
  playbackId,
  muted = false,
  className = '',
}: UniverseLiveKitStageProps) {
  const { isConnected, isPublishing, isJoining, joinAsPublisher, leaveRoom, error, localVideoTrack } =
    useLiveKitRoom({
      roomId: roomName || undefined,
      roomType: 'broadcast',
      role: 'publisher',
      publish: true,
      userName: userName || undefined,
      identity: userId ? `universe-${userId}` : undefined,
      onUserJoined: () => {},
      onUserLeft: () => {},
      onError: () => {},
    })
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = localVideoRef.current
    if (!video || !localVideoTrack) return
    applyCameraVideoPresentation(video, {
      track: localVideoTrack.mediaStreamTrack,
      isLocal: true,
    })
  }, [localVideoTrack])

  // Join as publisher whenever the user is on stage and we have a room.
  useEffect(() => {
    let cancelled = false
    if (isOnStage && roomName && userId) {
      // Re-join handled by hook guards; only fire if not already connected.
      if (!isConnected && !isJoining) {
        joinAsPublisher(userId).catch((err) => {
          if (!cancelled) console.warn('[UniverseLiveKitStage] publish failed', err)
        })
      }
    } else {
      // Off stage -> stop publishing, drop back to Mux.
      if (isConnected || isPublishing) {
        leaveRoom().catch(() => {})
      }
    }
    return () => {
      cancelled = true
    }
  }, [isOnStage, roomName, userId, isConnected, isJoining, isPublishing, joinAsPublisher, leaveRoom])

  // When leaving the stage we must release the room.
  useEffect(() => {
    return () => {
      leaveRoom().catch(() => {})
    }
  }, [leaveRoom])

  const stageLabel = useMemo(() => {
    if (isJoining) return 'Connecting…'
    if (isPublishing) return 'LIVE'
    return 'On Stage'
  }, [isJoining, isPublishing])

  // ---- VIEWER MODE: Mux low-latency playback --------------------------------
  if (!isOnStage) {
    return (
      <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
        {playbackId ? (
          <UniverseMuxPlayer playbackId={playbackId} muted={muted} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-950">
            <span className="text-xs text-slate-500">Waiting for broadcast…</span>
          </div>
        )}
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-300">
          <Wifi className="h-3 w-3 text-emerald-300" /> Mux
        </div>
      </div>
    )
  }

  // ---- ON-STAGE MODE: LiveKit publish (lowest latency) ----------------------
  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {localVideoTrack ? (
        <video
          ref={(el) => {
            localVideoRef.current = el
            if (el && localVideoTrack && el.srcObject !== (localVideoTrack as any).mediaStream) {
              const stream = new MediaStream()
              stream.addTrack((localVideoTrack as any).mediaStreamTrack)
              el.srcObject = stream
            }
          }}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-950">
          {isJoining ? (
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-300" />
          ) : (
            <Video className="h-6 w-6 text-slate-600" />
          )}
          <span className="text-[10px] font-bold text-slate-400">{stageLabel}</span>
        </div>
      )}

      {error ? (
        <div className="absolute inset-x-2 bottom-2 rounded-md bg-rose-500/20 px-2 py-1 text-[9px] font-bold text-rose-200">
          {String(error)}
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
        <Mic className="h-3 w-3" /> {isPublishing ? 'LiveKit LIVE' : stageLabel}
      </div>
    </div>
  )
}
