import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Room,
  RoomEvent,
  VideoPresets,
  createLocalVideoTrack,
  createLocalAudioTrack,
  type LocalVideoTrack,
  type LocalAudioTrack,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
  type Participant,
  type TrackPublishOptions,
} from 'livekit-client'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { fetchSingOffToken } from '../services/singoffService'
import type { SingOffTokenMode } from '../services/singoffService'

export interface SingOffRemoteUser {
  identity: string
  name: string
  videoTrack: RemoteVideoTrack | null
  audioTrack: RemoteAudioTrack | null
  isSpeaking: boolean
  isHandRaised: boolean
}

interface UseSingOffLiveKitProps {
  roomName: string
  userId: string
  userName?: string
  mode?: SingOffTokenMode
  autoPublish?: boolean
  isAdmin?: boolean
  onUserJoined?: (user: SingOffRemoteUser) => void
  onUserLeft?: (userId: string) => void
  onError?: (err: Error) => void
}

export function useSingOffLiveKit({
  roomName,
  userId,
  userName,
  mode = 'singoff-viewer',
  autoPublish = false,
  isAdmin = false,
  onUserJoined,
  onUserLeft,
  onError,
}: UseSingOffLiveKitProps) {
  const { profile } = useAuthStore()

  const [isConnected, setIsConnected] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState<Record<string, SingOffRemoteUser>>({})
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null)
  const [error, setError] = useState<string | null>(null)

  const roomRef = useRef<Room | null>(null)
  const localTracksRef = useRef<{ video?: LocalVideoTrack; audio?: LocalAudioTrack; micOn: boolean; camOn: boolean }>({
    micOn: true,
    camOn: true,
  })

  const publish = useCallback(async () => {
    if (!roomRef.current?.localParticipant) return false
    try {
      let vTrack = localVideoTrack
      let aTrack = localAudioTrack
      if (!vTrack) {
        vTrack = (await createLocalVideoTrack({
          resolution: isAdmin ? VideoPresets.h1080 : VideoPresets.h720,
          frameRate: 30,
          facingMode: 'user',
        })) as LocalVideoTrack
      }
if (!aTrack) {
        aTrack = (await createLocalAudioTrack()) as LocalAudioTrack
      }
      setLocalVideoTrack(vTrack)
      setLocalAudioTrack(aTrack)
      localTracksRef.current.video = vTrack
      localTracksRef.current.audio = aTrack

const maxBitrate = isAdmin ? 6000 : 2500
      const videoOpts: TrackPublishOptions = {
        videoEncoding: { maxBitrate, maxFramerate: 30 },
        videoSimulcastLayers: [
          isAdmin ? VideoPresets.h720 : VideoPresets.h360,
          isAdmin ? VideoPresets.h360 : VideoPresets.h180,
        ],
        videoCodec: 'vp8' as const,
      }
      await roomRef.current.localParticipant.publishTrack(vTrack, videoOpts)
      await roomRef.current.localParticipant.publishTrack(aTrack, {})

      await roomRef.current.localParticipant.enableCameraAndMicrophone()
      localTracksRef.current.micOn = true
      localTracksRef.current.camOn = true
      setIsPublishing(true)
      return true
    } catch (e: any) {
      console.error('[singoff-livekit] publish failed', e)
      const msg = e?.message || 'Failed to publish'
      setError(msg)
      onError?.(e)
      toast.error(msg)
      return false
    }
  }, [localVideoTrack, localAudioTrack, isAdmin, onError])

  const toggleMic = useCallback(async () => {
    if (!roomRef.current?.localParticipant || !localAudioTrack) return
    try {
      const next = !localTracksRef.current.micOn
      if (next) await localAudioTrack.unmute()
      else await localAudioTrack.mute()
      localTracksRef.current.micOn = next
      await roomRef.current.localParticipant.setMicrophoneEnabled(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle mic')
    }
  }, [localAudioTrack])

  const toggleCamera = useCallback(async () => {
    if (!roomRef.current?.localParticipant || !localVideoTrack) return
    try {
      const next = !localTracksRef.current.camOn
      if (next) await localVideoTrack.unmute()
      else await localVideoTrack.mute()
      localTracksRef.current.camOn = next
      await roomRef.current.localParticipant.setCameraEnabled(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle camera')
    }
  }, [localVideoTrack])

  const connect = useCallback(async () => {
    if (!roomName || !userId) {
      setError('Missing room or user')
      return false
    }
    try {
      const token = await fetchSingOffToken(roomName, userId, userName || profile?.display_name || 'User', mode)
      if (!token) {
        setError('Could not obtain Sing Off token')
        onError?.(new Error('Could not obtain Sing Off token'))
        return false
      }

const room = new Room({
        adaptiveStream: true,
      })
      roomRef.current = room

      const addUser = (participant: Participant) => {
        const u: SingOffRemoteUser = {
          identity: participant.identity,
          name: participant.name || participant.identity,
          videoTrack: null,
          audioTrack: null,
          isSpeaking: false,
          isHandRaised: false,
        }
        setRemoteUsers((prev) => ({ ...prev, [participant.identity]: u }))
        onUserJoined?.(u)
      }

      room
        .on(RoomEvent.ParticipantConnected, (participant) => addUser(participant))
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          setRemoteUsers((prev) => {
            const next = { ...prev }
            delete next[participant.identity]
            return next
          })
          onUserLeft?.(participant.identity)
        })
        .on(RoomEvent.TrackSubscribed, (track: any, _publication: any, participant: Participant) => {
          const identity = participant.identity
          setRemoteUsers((prev) => {
            const existing = prev[identity]
            if (!existing) return prev
            const next: SingOffRemoteUser = { ...existing }
            if (track.kind === 'video') next.videoTrack = track as RemoteVideoTrack
            else if (track.kind === 'audio') next.audioTrack = track as RemoteAudioTrack
            return { ...prev, [identity]: next }
          })
        })
        .on(RoomEvent.TrackUnsubscribed, (track: any, _publication: any, participant: Participant) => {
          const identity = participant.identity
          setRemoteUsers((prev) => {
            const existing = prev[identity]
            if (!existing) return prev
            const next: SingOffRemoteUser = { ...existing }
            if (track.kind === 'video') next.videoTrack = null
            if (track.kind === 'audio') next.audioTrack = null
            return { ...prev, [identity]: next }
          })
        })
.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          setRemoteUsers((prev) => {
            const active = new Set(speakers.map((p) => p.identity))
            const next: Record<string, SingOffRemoteUser> = {}
            for (const [id, existing] of Object.entries(prev)) {
              next[id] = { ...existing, isSpeaking: active.has(id) }
            }
            return next
          })
        })
        .on(RoomEvent.Disconnected, () => {
          setIsConnected(false)
          setIsPublishing(false)
        })
        .on(RoomEvent.MediaDevicesError, (e: any) => {
          const msg = e?.message || 'Media device error'
          setError(msg)
          onError?.(e)
          toast.error(msg)
        })

await room.connect(token.serverUrl, token.token)
      setIsConnected(true)

      if (mode === 'singoff-publisher' && autoPublish) {
        await publish()
      }
      return true
    } catch (e: any) {
      console.error('[singoff-livekit] connect failed', e)
      const msg = e?.message || 'Failed to connect to the stage'
      setError(msg)
      onError?.(e)
      toast.error(msg)
      return false
    }
  }, [roomName, userId, userName, mode, autoPublish, profile, onError, onUserJoined, onUserLeft, publish])

  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
    setRemoteUsers({})
    setIsConnected(false)
    setIsPublishing(false)
    setLocalVideoTrack(null)
    setLocalAudioTrack(null)
    localTracksRef.current = { micOn: true, camOn: true }
  }, [])

  useEffect(() => {
    return () => leaveRoom()
  }, [leaveRoom])

  return {
    isConnected,
    isPublishing,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    micEnabled: localTracksRef.current.micOn,
    cameraEnabled: localTracksRef.current.camOn,
    connect,
    publish,
    toggleMic,
    toggleCamera,
    leaveRoom,
  }
}
