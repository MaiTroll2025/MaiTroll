import { useState, useRef, useCallback, useEffect } from 'react'
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'

interface StaffWalkieTalkieConfig {
  onLiveKitMicMute?: () => void
  onLiveKitMicUnmute?: () => void
}

const WALKIE_TALKIE_CHANNEL = 'staff-walkie-talkie'

export function useStaffWalkieTalkie({
  onLiveKitMicMute,
  onLiveKitMicUnmute,
}: StaffWalkieTalkieConfig = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)

  const user = useAuthStore(state => state.user)
  const profile = useAuthStore(state => state.profile)

  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const joinedRef = useRef(false)
  const joiningRef = useRef(false)
  const isPublishingRef = useRef(false)
  const remoteAudioElementsRef = useRef<Record<string, HTMLAudioElement>>({})
  const remoteAudioPlaybackFailedRef = useRef(false)

  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID

  const debugAgora = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  }

  const createRemoteAudioElement = (uid: string) => {
    const existing = remoteAudioElementsRef.current[uid]
    if (existing) {
      return existing
    }

    const audioElement = document.createElement('audio')
    audioElement.autoplay = true
    audioElement.controls = false
    audioElement.style.display = 'none'
    audioElement.id = `walkie-remote-audio-${uid}`
    document.body.appendChild(audioElement)
    remoteAudioElementsRef.current[uid] = audioElement
    return audioElement
  }

  const cleanupRemoteAudioElement = (uid: string) => {
    const element = remoteAudioElementsRef.current[uid]
    if (element) {
      if (element.parentNode) {
        element.parentNode.removeChild(element)
      }
      delete remoteAudioElementsRef.current[uid]
    }
  }

  const updateRemoteUsers = useCallback((user: IAgoraRTCRemoteUser) => {
    setRemoteUsers(prev => {
      const exists = prev.some((u) => u.uid === user.uid)
      if (!exists) {
        return [...prev, user]
      }
      return prev.map((u) => (u.uid === user.uid ? user : u))
    })
  }, [])

  const removeRemoteUser = useCallback((uid: string | number) => {
    setRemoteUsers(prev => prev.filter((u) => u.uid !== uid))
    cleanupRemoteAudioElement(String(uid))
  }, [])

  const ensureMicrophoneSupport = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = 'Microphone access is not available in this browser'
      toast.error(msg)
      throw new Error(msg)
    }

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
    const audioInputs = devices.filter((device) => device.kind === 'audioinput')
    debugAgora('[StaffWalkieTalkie] available audio inputs:', audioInputs.map((device) => ({ label: device.label, deviceId: device.deviceId })))

    if (audioInputs.length === 0) {
      const msg = 'No microphone found'
      toast.error(msg)
      throw new Error(msg)
    }
  }, [])

  const fetchAgoraToken = useCallback(async () => {
    try {
      const uid = user?.id ? stableNumericUid(user.id) : Math.floor(Math.random() * 100000) + 1
      const role = String(profile?.role || '').trim().toLowerCase()
      const pageNum = Number((profile as any)?.walkie_talkie_page || 0) || 0

      const { data, error: tokenError } = await supabase.functions.invoke('agora-walkie-token', {
        body: {
          channelName: WALKIE_TALKIE_CHANNEL,
          userId: user?.id || 'anonymous',
          uid,
          role,
          walkieTalkiePage: pageNum,
        },
      })

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`)
      }

      if (!data?.token || !data?.appId || !data?.channelName || typeof data.uid === 'undefined') {
        throw new Error('Invalid Agora token payload')
      }

      return data as {
        token: string
        uid: number | string
        appId: string
        channelName: string
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch Agora token'
      setError(errMsg)
      if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission denied')) {
        toast.error('Microphone permission denied')
      }
      if (err?.name === 'NotFoundError') {
        toast.error('No microphone found')
      }
      throw err
    }
  }, [profile, user.id])

  const initAgoraClient = useCallback(async () => {
    if (clientRef.current) {
      return clientRef.current
    }

    const appId = getAgoraAppId()
    if (!appId) {
      throw new Error('VITE_AGORA_APP_ID not configured')
    }

    debugAgora('[StaffWalkieTalkie] Initializing Agora client')

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      debugAgora('[StaffWalkieTalkie] User joined:', user.uid)
      updateRemoteUsers(user)
    }

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      debugAgora('[StaffWalkieTalkie] User left:', user.uid)
      removeRemoteUser(user.uid)
    }

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: string) => {
      debugAgora('[StaffWalkieTalkie] User published:', user.uid, mediaType)
      try {
        await (client as any).subscribe(user, mediaType)

        if (mediaType === 'audio' && user.audioTrack) {
          const audioElement = createRemoteAudioElement(String(user.uid))
          try {
            await (user.audioTrack as any).play(audioElement)
            user.audioTrack.setVolume?.(100)
          } catch (playError) {
            console.warn('[StaffWalkieTalkie] Remote audio play failed:', playError)
            if (!remoteAudioPlaybackFailedRef.current) {
              remoteAudioPlaybackFailedRef.current = true
              toast.error('Tap to enable audio.')
            }
          }
        }

        updateRemoteUsers(user)
      } catch (err) {
        console.error('[StaffWalkieTalkie] Remote subscribe error:', err)
      }
    }

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: string) => {
      debugAgora('[StaffWalkieTalkie] User unpublished:', user.uid, mediaType)
      if (mediaType === 'audio') {
        cleanupRemoteAudioElement(String(user.uid))
      }
      updateRemoteUsers(user)
    }

    const handleConnectionStateChange = (curState: string, revState: string) => {
      debugAgora('[StaffWalkieTalkie] Connection state:', curState, '(was', revState + ')')
    }

    client.on('user-joined', handleUserJoined)
    client.on('user-left', handleUserLeft)
    client.on('user-published', handleUserPublished)
    client.on('user-unpublished', handleUserUnpublished)
    client.on('connection-state-change', handleConnectionStateChange)

    clientRef.current = client
    return client
  }, [removeRemoteUser, updateRemoteUsers])

  const stableNumericUid = (value: unknown): number => {
    const raw = String(value || '').trim()
    const parsed = Number(raw)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }

    let hash = 0
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
    }

    const uid = hash % 2147483647
    return uid > 0 ? uid : 1
  }

  const createMicrophoneTrack = useCallback(async () => {
    await ensureMicrophoneSupport()

    try {
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'speech_standard',
        AEC: true,
        ANS: true,
        AGC: true,
      })

      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      const selected = devices.find((device) => device.kind === 'audioinput')
      if (selected) {
        debugAgora('[StaffWalkieTalkie] Selected microphone:', selected.label)
      }

      return micTrack
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create microphone track'
      if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission denied')) {
        toast.error('Microphone permission denied')
      } else if (err?.name === 'NotFoundError') {
        toast.error('No microphone found')
      }
      throw new Error(errMsg)
    }
  }, [ensureMicrophoneSupport])

  const joinWalkieTalkie = useCallback(async () => {
    if (joiningRef.current || joinedRef.current) return

    joiningRef.current = true
    setIsJoining(true)
    setError(null)

    try {
      debugAgora('[StaffWalkieTalkie] Joining walkie-talkie channel')

      const client = await initAgoraClient()
      const tokenData = await fetchAgoraToken()

      debugAgora('[StaffWalkieTalkie] Agora join details:', {
        appId: tokenData.appId,
        channel: tokenData.channelName,
        uid: tokenData.uid,
        tokenLength: tokenData.token.length,
      })

      await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid)

      const micTrack = await createMicrophoneTrack()
      localAudioTrackRef.current = micTrack
      await client.publish([micTrack])
      isPublishingRef.current = true

      setIsConnected(true)
      setIsSpeaking(true)
      joinedRef.current = true

      onLiveKitMicMute?.()
      debugAgora('[StaffWalkieTalkie] Joined walkie-talkie successfully')
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Failed to join walkie-talkie'
      console.error('[StaffWalkieTalkie] Join error:', errMsg, err)
      setError(errMsg)
      if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission denied')) {
        toast.error('Microphone permission denied')
      } else if (err?.name === 'NotFoundError') {
        toast.error('No microphone found')
      } else {
        toast.error('Failed to connect to staff walkie-talkie: ' + errMsg)
      }
      onLiveKitMicUnmute?.()
    } finally {
      joiningRef.current = false
      setIsJoining(false)
    }
  }, [createMicrophoneTrack, fetchAgoraToken, initAgoraClient, onLiveKitMicMute, onLiveKitMicUnmute])

  const leaveWalkieTalkie = useCallback(async () => {
    try {
      debugAgora('[StaffWalkieTalkie] Leaving walkie-talkie')

      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
        localAudioTrackRef.current.close()
        localAudioTrackRef.current = null
      }

      if (clientRef.current) {
        const client = clientRef.current as any
        if (localAudioTrackRef.current) {
          await client.unpublish(localAudioTrackRef.current).catch(() => {})
        }
        client.off('user-joined')
        client.off('user-left')
        client.off('user-published')
        client.off('user-unpublished')
        client.off('connection-state-change')
        await client.leave().catch((err) => {
          debugAgora('[StaffWalkieTalkie] Error leaving Agora client:', err)
        })
        clientRef.current = null
      }

      Object.keys(remoteAudioElementsRef.current).forEach((uid) => {
        cleanupRemoteAudioElement(uid)
      })

      setIsConnected(false)
      setIsSpeaking(false)
      setRemoteUsers([])
      joinedRef.current = false
      isPublishingRef.current = false
      setIsJoining(false)
      setError(null)
      onLiveKitMicUnmute?.()

      debugAgora('[StaffWalkieTalkie] Left walkie-talkie successfully')
    } catch (err) {
      console.error('[StaffWalkieTalkie] Leave error:', err)
    }
  }, [onLiveKitMicUnmute])

  const toggleSpeaking = useCallback(
    async (speaking: boolean) => {
      try {
        if (speaking && !joinedRef.current) {
          await joinWalkieTalkie()
          return
        }

        if (!localAudioTrackRef.current) {
          return
        }

        await localAudioTrackRef.current.setEnabled(speaking)
        setIsSpeaking(speaking)
      } catch (err) {
        console.error('[StaffWalkieTalkie] Speaking toggle error:', err)
      }
    },
    [joinWalkieTalkie],
  )

  useEffect(() => {
    const remoteAudioElements = remoteAudioElementsRef.current
    return () => {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
        localAudioTrackRef.current.close()
      }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {})
      }
      Object.keys(remoteAudioElements).forEach((uid) => {
        cleanupRemoteAudioElement(uid)
      })
    }
  }, [])

  return {
    isConnected,
    isSpeaking,
    remoteUsers,
    error,
    isJoining,
    joinWalkieTalkie,
    leaveWalkieTalkie,
    toggleSpeaking,
  }
}

export default useStaffWalkieTalkie