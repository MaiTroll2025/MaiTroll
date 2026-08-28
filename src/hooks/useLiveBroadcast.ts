// src/hooks/useLiveBroadcast.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared LiveKit session logic for the BROADCASTER experience.
//
// This hook is the single source of truth for the LiveKit connection used by
// BOTH the web BroadcastPage and the phone BroadcastHostPage. It encapsulates
// the exact, verified behaviour:
//   - adopt the transferred room/tracks coming from PhoneGoLive (PreflightStore)
//   - connect + publish camera/mic tracks
//   - toggle camera / microphone
//   - flip camera
//   - tear the room down cleanly
//
// The host/layout JSX lives in the page that consumes this hook, so the phone
// page can be edited independently without touching the web version.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Room,
  Track,
  createLocalTracks,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  VideoPresets,
} from 'livekit-client'
import { PreflightStore, usePreflightStore } from '../lib/preflightStore'

export const getLiveKitUrl = (): string | undefined => {
  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
  if (!livekitUrl) {
    console.error('[useLiveBroadcast] Missing LiveKit URL - check VITE_LIVEKIT_URL')
  }
  return livekitUrl
}

export interface LiveBroadcastSession {
  roomRef: React.MutableRefObject<Room | null>
  localTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null
  cameraEnabled: boolean
  micEnabled: boolean
  isConnecting: boolean
  isConnected: boolean
  remoteParticipants: Map<string, RemoteParticipant>
  connect: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleMicrophone: () => Promise<void>
  flipCamera: () => Promise<void>
  disconnect: () => void
}

interface UseLiveBroadcastOptions {
  streamId: string
  isHost: boolean
  videoPreset?: { resolution: { width: number; height: number } }
  facingMode?: 'user' | 'environment'
  /** Fired once the room is connected + tracks are published. */
  onConnected?: (room: Room) => void
}

export function useLiveBroadcast({
  streamId,
  isHost,
  videoPreset = VideoPresets.h720,
  facingMode,
  onConnected,
}: UseLiveBroadcastOptions): LiveBroadcastSession {
  const roomRef = useRef<Room | null>(null)
  const localTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)
  const [localTracks, setLocalTracks] = useState<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(facingMode || 'user')

  const isGoingLiveRef = useRef(false)
  const localTrackCreatedCountRef = useRef(0)
  const localTrackPublishedCountRef = useRef(0)
  const livekitRoomDisconnectedCountRef = useRef(0)

  // ── helpers ───────────────────────────────────────────────────────────────
  const connectRoom = useCallback(async (room: Room, token: string) => {
    if (room.state === 'connected') return
    if (room.state === 'connecting' || room.state === 'reconnecting') {
      console.log('[useLiveBroadcast] Room already connecting, skipping duplicate connect')
      return
    }
    const livekitUrl = getLiveKitUrl()
    if (!livekitUrl) {
      console.error('[useLiveBroadcast] LiveKit URL not configured')
      return
    }
    await room.connect(livekitUrl, token)
  }, [])

  const publishTrackOrClone = useCallback(
    async <T extends LocalAudioTrack | LocalVideoTrack>(
      track: T | undefined,
      room: Room,
      kind: 'audio' | 'video',
    ): Promise<T | undefined> => {
      if (!track) return undefined
      const trackId = (track as any).sid || (track as any).id || (track as any).trackId
      console.log('[useLiveBroadcast][DEBUG] publishTrackOrClone start:', { kind, trackId, roomName: room.name, roomState: room.state, localIdentity: room.localParticipant?.identity })
      const tryPublish = async (candidate: T): Promise<T | undefined> => {
        try {
          console.log('[useLiveBroadcast][DEBUG] Attempting publish:', { kind, trackId: candidate.sid || candidate.id, source: candidate.source, mediaStreamTrackKind: candidate.mediaStreamTrack?.kind })
          await room.localParticipant.publishTrack(candidate)
          localTrackPublishedCountRef.current += 1
          console.log('[useLiveBroadcast][DEBUG] Publish succeeded:', { kind, trackId: candidate.sid || candidate.id })
          return candidate
        } catch (err: any) {
          console.warn(`[useLiveBroadcast][DEBUG] Failed to publish ${kind} track`, {
            error: err?.message || err,
            code: err?.code,
            trackId: candidate.sid || candidate.id,
            roomName: room.name,
            roomState: room.state,
            localIdentity: room.localParticipant?.identity,
          })
          return undefined
        }
      }
      const published = await tryPublish(track)
      if (published) return published
      try {
        const mediaTrack =
          (track as any).getMediaStreamTrack?.() || (track as any).mediaStreamTrack?.()
        console.log('[useLiveBroadcast][DEBUG] Publish fallback mediaTrack:', { kind, hasMediaTrack: !!mediaTrack, mediaTrackKind: mediaTrack?.kind, mediaTrackReadyState: mediaTrack?.readyState })
        if (!mediaTrack) return undefined
        const clonedTrack = (
          kind === 'video' ? new LocalVideoTrack(mediaTrack) : new LocalAudioTrack(mediaTrack)
        ) as T
        localTrackCreatedCountRef.current += 1
        return await tryPublish(clonedTrack)
      } catch (err) {
        console.warn('[useLiveBroadcast][DEBUG] Failed to clone and publish track', { kind, error: err })
        return undefined
      }
    },
    [],
  )

  // ── participant snapshot sync (feeds the host video + controls) ────────────
  const syncRemoteParticipantSnapshots = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = new Map<string, RemoteParticipant>()
    room.remoteParticipants.forEach((p) => next.set(p.identity, p))
    setRemoteParticipants(next)
  }, [])

  const attachLiveKitHandlers = useCallback(
    (room: Room) => {
      const onConnectedEvt = () => syncRemoteParticipantSnapshots()
      const onDisconnectedEvt = () => syncRemoteParticipantSnapshots()
      room.on('participantConnected', onConnectedEvt)
      room.on('participantDisconnected', onDisconnectedEvt)
      room.on('trackPublished', onConnectedEvt)
      room.on('trackSubscribed', onConnectedEvt)
      room.on('trackUnsubscribed', onConnectedEvt)
      room.on('trackMuted', onConnectedEvt)
      room.on('trackUnmuted', onConnectedEvt)
    },
    [syncRemoteParticipantSnapshots],
  )

  const detachLiveKitHandlers = useCallback((room: Room) => {
    room.removeAllListeners('participantConnected')
    room.removeAllListeners('participantDisconnected')
    room.removeAllListeners('trackPublished')
    room.removeAllListeners('trackSubscribed')
    room.removeAllListeners('trackUnsubscribed')
    room.removeAllListeners('trackMuted')
    room.removeAllListeners('trackUnmuted')
  }, [])

  const disconnectLiveKitRoom = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    try {
      detachLiveKitHandlers(room)
    } catch (e) {
      console.warn('[useLiveBroadcast] Error detaching handlers:', e)
    }
    if (room.localParticipant) {
      const allPubs = [
        ...room.localParticipant.videoTrackPublications.values(),
        ...room.localParticipant.audioTrackPublications.values(),
      ]
      for (const pub of allPubs) {
        try {
          if (pub.track) room.localParticipant.unpublishTrack(pub.track).catch(() => {})
        } catch {
          /* ignore */
        }
      }
    }
    try {
      room.removeAllListeners()
    } catch {
      /* ignore */
    }
    try {
      room.disconnect().catch(() => {})
    } catch {
      /* ignore */
    }
    roomRef.current = null
    livekitRoomDisconnectedCountRef.current += 1
  }, [detachLiveKitHandlers])

  // ── connect + adopt PhoneGoLive's transferred room / publish tracks ────────
  const connect = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      const transferSession = PreflightStore.getTransferSession()
      const preflightRoom = transferSession?.room
      const preflightTracks = transferSession?.tracks
      const preflightRoomName = usePreflightStore.getState().roomName || transferSession?.roomName
      const expectedRoomName = `stream_${streamId}`

      let roomToUse: Room | null = null
      let token: string | null = null

      // 1) Adopt the already-connected room transferred from PhoneGoLive.
      if (
        isHost &&
        preflightRoom &&
        preflightRoom.state === 'connected' &&
        (preflightRoomName === expectedRoomName || transferSession?.ownership === 'broadcast-page')
      ) {
        roomToUse = preflightRoom
        roomRef.current = roomToUse
        attachLiveKitHandlers(roomToUse)
        isGoingLiveRef.current = true

        const existingCamPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
          Array.from(roomToUse.localParticipant.videoTrackPublications.values()).find(
            (pub: any) => pub?.source === Track.Source.Camera || pub?.track?.source === Track.Source.Camera,
          )
        const existingMicPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
          Array.from(roomToUse.localParticipant.audioTrackPublications.values()).find(
            (pub: any) => pub?.source === Track.Source.Microphone || pub?.track?.kind === 'audio',
          )

        const activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || preflightTracks?.audioTrack || null
        const activeVideoTrack = (existingCamPublication?.track as LocalVideoTrack | null) || preflightTracks?.videoTrack || null

        if (activeAudioTrack || activeVideoTrack) {
          const next: [LocalAudioTrack | null, LocalVideoTrack | null] = [activeAudioTrack || null, activeVideoTrack || null]
          localTracksRef.current = next
          setLocalTracks(next)
          setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
          setMicEnabled(Boolean(activeAudioTrack?.mediaStreamTrack?.enabled ?? activeAudioTrack))
        }

        // Clear the transfer session so it isn't adopted twice.
        PreflightStore.clearTransferSession()
        usePreflightStore.getState().clearPreflightConnection?.()
        setIsConnected(true)
        onConnected?.(roomToUse)
        return
      }

      // 2) Fresh connection (no transferred room).
      const tokenRequestPayload = { room: expectedRoomName, identity: `host_${streamId}`, role: 'host', metadata: { streamId } }
      console.log('[useLiveBroadcast][DEBUG] Fetching LiveKit token with payload:', tokenRequestPayload)
      const { data: tokenData, error: tokenError } = await (await import('../lib/supabase')).supabase
        .functions.invoke('livekit-token', {
          body: tokenRequestPayload,
        })

      if (tokenError || !tokenData?.token) {
        console.error('[useLiveBroadcast][DEBUG] Failed to fetch LiveKit token', { tokenError, tokenData })
        return
      }
      console.log('[useLiveBroadcast][DEBUG] Token response:', {
        participantType: tokenData.participantType,
        isPublisher: tokenData.isPublisher,
        canPublish: tokenData.canPublish,
        mode: tokenData.mode,
        identity: tokenData.participantIdentity,
      })
      token = tokenData.token

      if (!roomToUse) {
        roomToUse = new Room()
        roomRef.current = roomToUse
        attachLiveKitHandlers(roomToUse)
      }

      console.log('[useLiveBroadcast][DEBUG] Connecting to LiveKit room:', { expectedRoomName, roomState: roomToUse.state })
      if (roomToUse.state !== 'connected') {
        await connectRoom(roomToUse, token)
      }
      console.log('[useLiveBroadcast][DEBUG] Room connected:', { roomName: roomToUse.name, state: roomToUse.state, localIdentity: roomToUse.localParticipant?.identity })

      const existingCam =
        roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
        Array.from(roomToUse.localParticipant.videoTrackPublications.values()).find(
          (pub: any) => pub?.track?.kind === 'video',
        )
      const existingMic =
        roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
        Array.from(roomToUse.localParticipant.audioTrackPublications.values()).find(
          (pub: any) => pub?.track?.kind === 'audio',
        )
      console.log('[useLiveBroadcast][DEBUG] Existing publications:', {
        cam: existingCam?.track?.sid || existingCam?.trackSid || null,
        mic: existingMic?.track?.sid || existingMic?.trackSid || null,
      })

      let activeVideoTrack = (existingCam?.track as LocalVideoTrack | null) || null
      let activeAudioTrack = (existingMic?.track as LocalAudioTrack | null) || null

      if (!activeVideoTrack || !activeAudioTrack) {
        const fresh = await createLocalTracks({
          audio: !activeAudioTrack,
          video: activeVideoTrack
            ? false
            : { resolution: videoPreset.resolution, facingMode: facingMode },
        })
        activeAudioTrack = activeAudioTrack || (fresh.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined) || null
        activeVideoTrack = activeVideoTrack || (fresh.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined) || null
        console.log('[useLiveBroadcast][DEBUG] Created fresh tracks:', {
          audio: !!activeAudioTrack,
          video: !!activeVideoTrack,
          audioId: activeAudioTrack?.sid || activeAudioTrack?.id || null,
          videoId: activeVideoTrack?.sid || activeVideoTrack?.id || null,
        })
      }

      if (activeVideoTrack) {
        console.log('[useLiveBroadcast][DEBUG] Publishing video track:', { trackId: activeVideoTrack.sid || activeVideoTrack.id, kind: activeVideoTrack.kind })
        await publishTrackOrClone(activeVideoTrack, roomToUse, 'video')
      }
      if (activeAudioTrack) {
        console.log('[useLiveBroadcast][DEBUG] Publishing audio track:', { trackId: activeAudioTrack.sid || activeAudioTrack.id, kind: activeAudioTrack.kind })
        await publishTrackOrClone(activeAudioTrack, roomToUse, 'audio')
      }

      const next: [LocalAudioTrack | null, LocalVideoTrack | null] = [activeAudioTrack || null, activeVideoTrack || null]
      localTracksRef.current = next
      setLocalTracks(next)
      setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
      setMicEnabled(Boolean(activeAudioTrack?.mediaStreamTrack?.enabled ?? activeAudioTrack))
      setIsConnected(true)
      onConnected?.(roomToUse)
    } catch (err) {
      console.error('[useLiveBroadcast] connect failed', err)
    } finally {
      setIsConnecting(false)
    }
  }, [
    isConnecting,
    isHost,
    streamId,
    videoPreset,
    facingMode,
    attachLiveKitHandlers,
    connectRoom,
    publishTrackOrClone,
    onConnected,
  ])

  // ── toggles ───────────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !cameraEnabled
    try {
      await room.localParticipant.setCameraEnabled(next)
      setCameraEnabled(next)
      const track = localTracksRef.current?.[1]
      if (track) {
        if (next) {
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera)
          setLocalTracks((prev) => (prev ? [prev[0], (pub?.track as LocalVideoTrack) || prev[1]] : prev))
        } else {
          setLocalTracks((prev) => (prev ? [prev[0], null] : prev))
        }
      }
    } catch (err) {
      console.warn('[useLiveBroadcast] toggleCamera failed', err)
    }
  }, [cameraEnabled])

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !micEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicEnabled(next)
    } catch (err) {
      console.warn('[useLiveBroadcast] toggleMicrophone failed', err)
    }
  }, [micEnabled])

  const flipCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    const next = currentFacingMode === 'user' ? 'environment' : 'user'
    const oldTrack = localTracksRef.current?.[1]

    if (oldTrack) {
      try {
        oldTrack.stop()
      } catch {
        // ignore
      }
    }

    try {
      const fresh = await createLocalTracks({
        audio: false,
        video: {
          facingMode: next,
          ...(videoPreset ? { resolution: videoPreset.resolution } : {}),
        },
      })

      const video = fresh.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined
      if (video) {
        if (oldTrack) {
          room.localParticipant.unpublishTrack(oldTrack).catch(() => {})
        }
        room.localParticipant.publishTrack(video).catch(() => {})
        localTracksRef.current = [localTracksRef.current?.[0] || null, video]
        setLocalTracks(prev => (prev ? [prev[0], video] : prev))
        setCurrentFacingMode(next)
      }
    } catch (err) {
      console.warn('[useLiveBroadcast] flipCamera failed', err)
    }
  }, [currentFacingMode, videoPreset])

  const disconnect = useCallback(() => {
    disconnectLiveKitRoom()
    setLocalTracks(null)
    localTracksRef.current = null
    setCameraEnabled(false)
    setMicEnabled(false)
    setIsConnected(false)
    setRemoteParticipants(new Map())
  }, [disconnectLiveKitRoom])

  // Cleanup on unmount — but NOT when we're adopting a transferred room.
  useEffect(() => {
    return () => {
      if (!isGoingLiveRef.current) {
        disconnectLiveKitRoom()
      }
    }
  }, [disconnectLiveKitRoom])

  return {
    roomRef,
    localTracks,
    cameraEnabled,
    micEnabled,
    isConnecting,
    isConnected,
    remoteParticipants,
    connect,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    disconnect,
  }
}
