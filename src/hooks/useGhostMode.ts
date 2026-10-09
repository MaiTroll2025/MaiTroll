import { useState, useEffect, useCallback, useRef } from 'react'
import { Room } from 'livekit-client';
import { supabase } from '../lib/supabase'
import { getLiveKitRoomName } from '../lib/liveUtils'
import { toast } from 'sonner'

interface GhostSession {
  id: string
  stream_id: string
  user_id: string
  joined_at: string
  microphone_enabled: boolean
  camera_enabled: boolean
}

interface UseGhostModeProps {
  streamId: string
  userId?: string
  isCEO: boolean
  roomRef?: React.MutableRefObject<Room | null>
}

export function useGhostMode({ streamId, userId, isCEO, roomRef }: UseGhostModeProps) {
  const [ghostSession, setGhostSession] = useState<GhostSession | null>(null)
  const [isJoiningGhost, setIsJoiningGhost] = useState(false)
  const [isLeavingGhost, setIsLeavingGhost] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isCameraEnabled, setIsCameraEnabled] = useState(false)
  const _ghostRoomRef = useRef<Room | null>(null)

  const roomName = getLiveKitRoomName(null, streamId)

  const createGhostSession = useCallback(async () => {
    if (!userId || !isCEO) return false

    setIsJoiningGhost(true)
    try {
      const { data: _data, error } = await supabase
        .from('user_profiles')
        .update({ is_ghost_mode: true })
        .eq('id', userId)
        .select('id')
        .maybeSingle()

      if (error) {
        toast.error(error.message || 'Failed to enable ghost mode')
        return false
      }

      setGhostSession({
        id: userId,
        stream_id: streamId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        microphone_enabled: true,
        camera_enabled: false,
      })
      return true
    } catch (err) {
      console.error('createGhostSession error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to join ghost mode')
      return false
    } finally {
      setIsJoiningGhost(false)
    }
  }, [streamId, userId, isCEO])

  const joinGhostRoom = useCallback(async () => {
    if (!roomName || !userId) return

    const room = roomRef?.current
    if (!room) {
      console.error('[useGhostMode] No room available from roomRef')
      return
    }

    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          identity: `${userId}-ghost`,
          name: `${userId}-ghost`,
          role: 'publisher',
          isGhost: true,
          ghostMetadata: { role: 'ghost', hidden: true },
        },
      })

      if (tokenError) {
        console.error('Ghost token error:', tokenError)
        toast.error(tokenError.message || 'Failed to get LiveKit token')
        return
      }

      const token = tokenData?.token
      const liveKitUrl = tokenData?.url || tokenData?.liveKitUrl

      if (!token || !liveKitUrl) {
        console.error('Ghost token missing:', tokenData)
        toast.error('Invalid token response from server')
        return
      }

      console.log('[useGhostMode] Ghost token received:', { hasToken: !!token, isGhost: true })

      // Publish ghost tracks to the existing room
      await room.localParticipant.setMicrophoneEnabled(true)
      setIsMicEnabled(true)
      
      // Set ghost metadata on the participant
      console.log('[useGhostMode] Ghost mode enabled - publishing to existing room')

    } catch (err) {
      console.error('joinGhostRoom error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to join ghost mode')
    }
  }, [roomName, userId, roomRef])

  const leaveGhostSession = useCallback(async () => {
    if (!userId || !isCEO || !ghostSession) return

    setIsLeavingGhost(true)
    try {
      const room = roomRef?.current
      if (room?.localParticipant) {
        console.log('[useGhostMode] Leaving ghost mode - disabling mic')
        await room.localParticipant.setMicrophoneEnabled(false)
      }

      await supabase
        .from('user_profiles')
        .update({ is_ghost_mode: false })
        .eq('id', userId)

      setGhostSession(null)
      setIsMicEnabled(false)
      console.log('[useGhostMode] Ghost session ended')
    } catch (err) {
      console.error('leaveGhostSession error:', err)
    } finally {
      setIsLeavingGhost(false)
    }
  }, [userId, isCEO, ghostSession, roomRef])

  const toggleMic = useCallback(async () => {
    const room = roomRef?.current
    if (!room?.localParticipant) return
    const enabled = !isMicEnabled
    await room.localParticipant.setMicrophoneEnabled(enabled)
    setIsMicEnabled(enabled)
    console.log('[useGhostMode] Ghost mic toggled:', enabled)
  }, [roomRef, isMicEnabled])

  const toggleCamera = useCallback(async () => {
    const room = roomRef?.current
    if (!room?.localParticipant) return
    const enabled = !isCameraEnabled
    // Ghost mode doesn't typically use video
    setIsCameraEnabled(enabled)
    console.log('[useGhostMode] Ghost camera toggled:', enabled)
  }, [roomRef, isCameraEnabled])

  useEffect(() => {
    return () => {
      // Cleanup handled by parent component
    }
  }, [])

  return {
    ghostSession,
    isJoiningGhost,
    isLeavingGhost,
    isMicEnabled,
    isCameraEnabled,
    joinGhostMode: async () => {
      const created = await createGhostSession()
      if (created) {
        await joinGhostRoom()
      }
      return created
    },
    leaveGhostMode: leaveGhostSession,
    toggleMic,
    toggleCamera,
  }
}