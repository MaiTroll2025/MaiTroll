import { useState, useRef, useCallback, useEffect } from 'react'
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IMicrophoneAudioTrack,
  UID
} from 'agora-rtc-sdk-ng'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'

interface PodcastAgoraConfig {
  channelName: string
  enabled: boolean
  isHost?: boolean
  podcastId?: string
  playing?: boolean
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void
  onError?: (error: string) => void
  /** Called when the Agora client is initialized and when local track is published,
   *  exposing refs needed to merge Agora audio into the recording stream. */
  onClientReady?: (client: IAgoraRTCClient, localAudioTrack: IMicrophoneAudioTrack | null) => void
}

// Generate a unique numeric UID that won't collide with other users.
// Uses a large random range (1B–4B) to minimize collision risk.
function generateUniqueUid(): UID {
  return 1000000000 + Math.floor(Math.random() * 3000000000)
}

export function usePodcastAgora({
  channelName,
  enabled,
  isHost = false,
  podcastId,
  playing,
  onUserJoined,
  onUserLeft,
  onError,
  onClientReady
}: PodcastAgoraConfig) {
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)

  const user = useAuthStore(state => state.user)
  const profile = useAuthStore(state => state.profile)

  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const joinedRef = useRef(false)
  const joiningRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const uidRef = useRef<UID>(generateUniqueUid())

  const isMutedRef = useRef(false)
  const isPlayingRef = useRef(false)
  const volumeRef = useRef(1.875)

  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID

  const debugAgora = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  }

  const applyAudioState = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
    if (!allRemoteUsers) return
    allRemoteUsers.forEach((remoteUser) => {
      const audioTrack = remoteUser.audioTrack
      if (audioTrack) {
        if (isMutedRef.current || !isPlayingRef.current) {
          audioTrack.setVolume(0)
        } else {
          audioTrack.setVolume(volumeRef.current)
          try { audioTrack.play() } catch { /* already playing */ }
        }
      }
    })
  }, [])

  useEffect(() => {
    if (playing === undefined || isPlayingRef.current === playing) return

    isPlayingRef.current = playing
    setIsPlaying(playing)
    applyAudioState()
  }, [playing, applyAudioState])

  const initAgoraClient = useCallback(async () => {
    try {
      const appId = getAgoraAppId()
      if (!appId) {
        throw new Error('VITE_AGORA_APP_ID not configured')
      }

      debugAgora('[PodcastAgora] Initializing Agora client (audio-only)')

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

      client.on('user-joined', (agoraUser) => {
        debugAgora('[PodcastAgora] User joined:', agoraUser.uid)
        setRemoteUsers(prev => [...prev, agoraUser])
        onUserJoined?.(agoraUser)
      })

      client.on('user-left', (agoraUser) => {
        debugAgora('[PodcastAgora] User left:', agoraUser.uid)
        setRemoteUsers(prev => prev.filter(u => u.uid !== agoraUser.uid))
        onUserLeft?.(agoraUser)
      })

      client.on('user-published', async (agoraUser, mediaType) => {
        debugAgora('[PodcastAgora] User published:', agoraUser.uid, mediaType)
        try {
          await client.subscribe(agoraUser, mediaType)
          debugAgora('[PodcastAgora] Subscribed to:', agoraUser.uid, mediaType)
          if (mediaType === 'audio') {
            const audioTrack = agoraUser.audioTrack
            if (audioTrack) {
              if (isMutedRef.current || !isPlayingRef.current) {
                audioTrack.setVolume(0)
              } else {
                audioTrack.setVolume(volumeRef.current)
                audioTrack.play()
              }
              setIsPlaying(true)
            }
          }
        } catch (subErr) {
          console.error('[PodcastAgora] Subscribe error:', subErr)
        }
      })

      client.on('user-subscribed', (agoraUser, mediaType) => {
        debugAgora('[PodcastAgora] User subscribed event:', agoraUser.uid, mediaType)
        if (mediaType === 'audio' && agoraUser.audioTrack) {
          if (isMutedRef.current || !isPlayingRef.current) {
            agoraUser.audioTrack.setVolume(0)
          } else {
            agoraUser.audioTrack.setVolume(volumeRef.current)
            agoraUser.audioTrack.play()
          }
          setIsPlaying(true)
        }
      })

      clientRef.current = client
      onClientReady?.(client, audioTrackRef.current)
      return client
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize Agora client'
      console.error('[PodcastAgora] Initialization error:', errMsg)
      setError(errMsg)
      onError?.(errMsg)
      throw err
    }
  }, [onError, onUserJoined, onUserLeft, onClientReady])

  const fetchAgoraToken = useCallback(async (channel: string, uid: UID, pId?: string) => {
    try {
      debugAgora('[PodcastAgora] Fetching Agora token for channel:', channel, 'uid:', uid)

      const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName: channel,
          userId: uid.toString(),
          role: isHost ? 'publisher' : 'subscriber',
          podcastId: pId,
          roomType: 'podcast',
        }
      })

      if (tokenError) {
        console.error('[PodcastAgora] Token fetch error:', tokenError)
        await supabase.from('podcast_rtc_logs').insert({
          podcast_id: pId || null,
          user_id: user?.id || null,
          username: profile?.username || null,
          role: profile?.role || null,
          level: profile?.level || null,
          event_type: 'agora_token_error',
          message: `Agora token fetch failed: ${tokenError.message}`,
          metadata: { channelName: channel, uid }
        })
        throw new Error(`Token error: ${tokenError.message}`)
      }

      if (!data?.token) {
        throw new Error('No token in response')
      }

      debugAgora('[PodcastAgora] Token received successfully')
      return data
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch Agora token'
      setError(errMsg)
      onError?.(errMsg)
      throw err
    }
  }, [isHost, onError, user, profile])

  const joinPodcast = useCallback(async (podcastIdArg?: string) => {
    const resolvedPodcastId = podcastIdArg || podcastId
    if (joiningRef.current || joinedRef.current) return
    if (!channelName) {
      console.error('[PodcastAgora] No channel name provided')
      return
    }

    joiningRef.current = true
    setIsJoining(true)

    try {
      debugAgora('[PodcastAgora] Joining channel:', channelName)

      let client = clientRef.current
      if (!client) {
        client = await initAgoraClient()
      }

      const uid = uidRef.current
      const appId = getAgoraAppId()
      if (!appId) {
        throw new Error('Agora App ID not configured')
      }

      const { token } = await fetchAgoraToken(channelName, uid, resolvedPodcastId)

      const joinPromise = client.join(appId, channelName, token, uid)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout')), 15000)
      )

      await Promise.race([joinPromise, timeoutPromise])
      debugAgora('[PodcastAgora] Joined channel successfully with uid:', uid)

      if (isHost) {
        try {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
            AGC: true,
          })
          audioTrackRef.current = audioTrack
          await client.publish([audioTrack])
          debugAgora('[PodcastAgora] Published local microphone track as host')
        } catch (trackError) {
          console.error('[PodcastAgora] Failed to publish local microphone track:', trackError)
          setError('Could not access microphone for podcast host')
        }
      }

      // Expose client + local track for recording (merge audio into display media)
      onClientReady?.(client, audioTrackRef.current)

      setIsConnected(true)
      joinedRef.current = true
      startTimeRef.current = Date.now()

      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)

      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: resolvedPodcastId || null,
        user_id: user?.id || null,
        username: profile?.username || null,
        role: profile?.role || null,
        level: profile?.level || null,
        event_type: 'podcast_joined',
        message: `User joined podcast`,
        metadata: { channelName, uid }
      })

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to join podcast'
      console.error('[PodcastAgora] Join error:', errMsg)
      setError(errMsg)
      toast.error('Failed to connect to podcast: ' + errMsg)

      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: resolvedPodcastId || null,
        user_id: user?.id || null,
        username: profile?.username || null,
        role: profile?.role || null,
        level: profile?.level || null,
        event_type: 'agora_join_failed',
        message: errMsg,
        metadata: { channelName, uid: uidRef.current }
      })
    } finally {
      joiningRef.current = false
      setIsJoining(false)
    }
  }, [channelName, fetchAgoraToken, initAgoraClient, user, profile, isHost])

  const leavePodcast = useCallback(async () => {
    if (!joinedRef.current || !clientRef.current) return

    try {
      debugAgora('[PodcastAgora] Leaving channel')

      if (audioTrackRef.current) {
        audioTrackRef.current.stop()
        audioTrackRef.current.close()
        audioTrackRef.current = null
      }

      await clientRef.current.leave()

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setIsConnected(false)
      setIsPlaying(false)
      isPlayingRef.current = false
      setRemoteUsers([])
      joinedRef.current = false
      startTimeRef.current = null

      debugAgora('[PodcastAgora] Left channel successfully')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to leave podcast'
      console.error('[PodcastAgora] Leave error:', errMsg)
      setError(errMsg)
    }
  }, [])

  const toggleMute = useCallback(async () => {
    const nextMuted = !isMutedRef.current
    isMutedRef.current = nextMuted
    setIsMuted(nextMuted)

    debugAgora(`[PodcastAgora] Toggle mute: ${nextMuted ? 'muted' : 'unmuted'}`)

    if (audioTrackRef.current) {
      try {
        audioTrackRef.current.setEnabled(!nextMuted)
      } catch (err) {
        console.error('[PodcastAgora] Error setting host mic enabled:', err)
      }
    }

    applyAudioState()

    supabase.from('podcast_rtc_logs').insert({
      podcast_id: podcastId || null,
      user_id: user?.id || null,
      username: profile?.username || null,
      role: profile?.role || null,
      level: profile?.level || null,
      event_type: nextMuted ? 'podcast_muted' : 'podcast_unmuted',
      message: `User ${nextMuted ? 'muted' : 'unmuted'} podcast audio`,
      metadata: {}
    })
  }, [user, profile, podcastId, applyAudioState])

  const togglePlay = useCallback(() => {
    const nextPlaying = !isPlayingRef.current
    isPlayingRef.current = nextPlaying
    setIsPlaying(nextPlaying)

    debugAgora(`[PodcastAgora] Toggle play: ${nextPlaying ? 'playing' : 'paused'}`)
    applyAudioState()
  }, [applyAudioState])

  const VOLUME_BOOST = 1.25

  const handleSetVolume = useCallback((newVolume: number) => {
    const boostedVolume = Math.min(newVolume * VOLUME_BOOST, 2.0)
    volumeRef.current = boostedVolume
    setVolume(newVolume)

    if (!isMutedRef.current && isPlayingRef.current) {
      const client = clientRef.current
      if (client) {
        const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
        if (allRemoteUsers) {
          allRemoteUsers.forEach((remoteUser) => {
            if (remoteUser.audioTrack) {
              remoteUser.audioTrack.setVolume(boostedVolume)
            }
          })
        }
      }
    }
  }, [])

  useEffect(() => {
    if (!joinedRef.current) return
    applyAudioState()
  }, [isMuted, isPlaying, applyAudioState])

  useEffect(() => {
    if (enabled && channelName && !joinedRef.current && !joiningRef.current) {
      joinPodcast()
    }

    return () => {
      if (!enabled) {
        leavePodcast()
      }
    }
  }, [enabled, channelName, joinPodcast, leavePodcast])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (joinedRef.current) {
        leavePodcast()
      }
    }
  }, [leavePodcast])

  return {
    isConnected,
    isPlaying,
    isMuted,
    volume,
    elapsedTime,
    remoteUsers,
    error,
    isJoining,
    joinPodcast,
    leavePodcast,
    togglePlay,
    toggleMute,
    setVolume: handleSetVolume,
  }
}
