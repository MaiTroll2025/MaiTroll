import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng'
import {
  Crown,
  FileText,
  LogOut,
  Mic,
  MicOff,
  Scale,
  User,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { supabase, UserRole } from '../lib/supabase'
import RequireRole from '../components/RequireRole'
import CourtChat from '../components/CourtChat'
import CourtDocketModal from '../components/CourtDocketModal'
import JudgeSentencingModal from '../components/JudgeSentencingModal'
import { Button } from '../components/ui/button'


type CourtRole =
  | 'admin'
  | 'ceo'
  | 'lead_troll_officer'
  | 'troll_officer'
  | 'secretary'
  | 'prosecutor'
  | 'judge'
  | 'attorney'
  | 'pastor'
  | 'moderator'
  | 'auctioneer'
  | 'lead_officer'
  | 'officer'
  | 'user'

type CourtStudioSpot =
  | 'judge'
  | 'prosecutor'
  | 'attorney'
  | 'defendant'
  | 'witness'
  | 'audience'

type AgoraCourtTrack = {
  uid: string | number
  videoTrack?: ICameraVideoTrack | IRemoteVideoTrack | null
  audioTrack?: IMicrophoneAudioTrack | IRemoteAudioTrack | null
  username?: string | null
  role?: CourtStudioSpot | string | null
  isLocal?: boolean
}

type AgoraTokenResponse = {
  appId?: string
  token?: string | null
  channel?: string
  channelName?: string
  uid?: string | number
  role?: 'publisher' | 'audience'
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidUuid = (value?: string | null) => UUID_REGEX.test(value || '')

function cleanCourtUuid(value?: string | null): string | null {
  if (!value) return null

  const cleaned = String(value)
    .replace(/^court-/, '')
    .replace(/^troll-court-/, '')

  return isValidUuid(cleaned) ? cleaned : null
}

function makeCourtRoomName(courtId: string) {
  return `troll-court-${courtId}`
}

function normalizeCourtRole(profile: any): CourtRole {
  if (!profile) return 'user'
  if (profile?.is_admin || profile?.role === 'admin') return 'admin'
  if (profile?.is_ceo || profile?.role === 'ceo') return 'ceo'

  if (
    profile?.is_lead_officer ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'lead_officer'
  ) {
    return 'lead_troll_officer'
  }

  if (
    profile?.is_troll_officer ||
    profile?.role === 'troll_officer' ||
    profile?.role === 'officer'
  ) {
    return 'troll_officer'
  }

  if (profile?.is_secretary || profile?.role === 'secretary') return 'secretary'
  if (profile?.is_prosecutor || profile?.role === 'prosecutor') return 'prosecutor'
  if (profile?.is_judge || profile?.role === 'judge') return 'judge'
  if (profile?.is_attorney || profile?.role === 'attorney') return 'attorney'
  if (profile?.is_pastor || profile?.role === 'pastor') return 'pastor'
  if (profile?.is_moderator || profile?.role === 'moderator') return 'moderator'
  if (profile?.is_auctioneer || profile?.role === 'auctioneer') return 'auctioneer'

  return profile?.role || 'user'
}

function canJudge(role: CourtRole) {
  return role === 'admin' || role === 'ceo' || role === 'lead_troll_officer' || role === 'judge'
}

function canEndCourt(role: CourtRole) {
  return (
    role === 'admin' ||
    role === 'ceo' ||
    role === 'lead_troll_officer' ||
    role === 'troll_officer' ||
    role === 'officer' ||
    role === 'judge'
  )
}

function getAutoStudioSpot(role: CourtRole): CourtStudioSpot {
  if (canJudge(role)) return 'judge'
  if (role === 'prosecutor') return 'prosecutor'
  if (role === 'attorney') return 'attorney'
  return 'audience'
}

function canPublishFromSpot(spot: CourtStudioSpot | null) {
  return Boolean(spot && spot !== 'audience')
}

function spotLabel(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'Judge'
    case 'prosecutor':
      return 'Prosecutor'
    case 'attorney':
      return 'Defense Attorney'
    case 'defendant':
      return 'Defendant'
    case 'witness':
      return 'Witness'
    case 'audience':
      return 'Audience'
    default:
      return 'Court Member'
  }
}

function spotTone(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'border-amber-300/70 shadow-[0_0_36px_rgba(245,158,11,0.45)]'
    case 'prosecutor':
      return 'border-red-400/70 shadow-[0_0_30px_rgba(239,68,68,0.35)]'
    case 'attorney':
      return 'border-cyan-300/70 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
    case 'defendant':
      return 'border-red-500/70 shadow-[0_0_26px_rgba(239,68,68,0.35)]'
    case 'witness':
      return 'border-purple-300/70 shadow-[0_0_26px_rgba(168,85,247,0.35)]'
    case 'audience':
      return 'border-amber-200/40 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
    default:
      return 'border-white/30'
  }
}

function spotPosition(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'left-[50%] top-[25%] h-[18%] w-[18%] -translate-x-1/2'
    case 'prosecutor':
      return 'left-[11%] top-[55%] h-[19%] w-[18%]'
    case 'witness':
      return 'left-[35%] top-[58%] h-[16%] w-[15%]'
    case 'defendant':
      return 'left-[57%] top-[58%] h-[16%] w-[15%]'
    case 'attorney':
      return 'right-[9%] top-[55%] h-[19%] w-[19%]'
    case 'audience':
      return 'left-[50%] bottom-[8%] h-[13%] w-[24%] -translate-x-1/2'
    default:
      return 'left-[50%] top-[50%] h-[18%] w-[18%]'
  }
}

async function getAgoraCourtToken({
  channelName,
  uid,
  role,
}: {
  channelName: string
  uid: string
  role: 'publisher' | 'audience'
}): Promise<AgoraTokenResponse> {
  const payload = {
    channelName,
    channel: channelName,
    uid,
    role,
    roomType: 'court',
  }

  const candidates = ['agora-token', 'agora-rtc-token', 'rtc-token']

  let lastError: any = null

  for (const functionName of candidates) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      })

      if (error) {
        lastError = error
        continue
      }

      if (data?.appId || import.meta.env.VITE_AGORA_APP_ID) {
        return {
          appId: data?.appId || import.meta.env.VITE_AGORA_APP_ID,
          token: data?.token ?? null,
          channel: data?.channel || data?.channelName || channelName,
          channelName: data?.channelName || data?.channel || channelName,
          uid: data?.uid || uid,
          role,
        }
      }

      lastError = new Error(`${functionName} did not return appId`)
    } catch (err) {
      lastError = err
    }
  }

  const fallbackAppId = import.meta.env.VITE_AGORA_APP_ID

  if (fallbackAppId) {
    return {
      appId: fallbackAppId,
      token: null,
      channel: channelName,
      channelName,
      uid,
      role,
    }
  }

  throw lastError || new Error('Agora token/appId not available.')
}

function CourtStudioTile({
  spot,
  userTrack,
  isLocal,
  canEnterSpot,
  isJoiningSpot,
  onEnterSpot,
  isJudge,
  isMutedByJudge,
  onToggleMute,
}: {
  spot: CourtStudioSpot
  userTrack?: AgoraCourtTrack
  isLocal?: boolean
  canEnterSpot?: boolean
  isJoiningSpot?: boolean
  onEnterSpot?: () => void
  isJudge?: boolean
  isMutedByJudge?: boolean
  onToggleMute?: () => void
}) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoTrack = userTrack?.videoTrack || null
  const audioTrack = userTrack?.audioTrack || null
  const username = userTrack?.username || spotLabel(spot)
  const canClickEnter = !userTrack && Boolean(canEnterSpot && onEnterSpot)

  useEffect(() => {
    const container = videoContainerRef.current
    if (!container) return

    while (container.firstChild) container.removeChild(container.firstChild)

    if (!videoTrack) return

    try {
      videoTrack.play(container)

      requestAnimationFrame(() => {
        const videoElements = container.querySelectorAll('video')
        videoElements.forEach((video) => {
          video.style.width = '100%'
          video.style.height = '100%'
          video.style.objectFit = 'cover'
          video.style.borderRadius = '9999px'
          video.playsInline = true
          video.autoplay = true
          video.muted = Boolean(isLocal)
        })

        const wrapperElements = container.querySelectorAll('div')
        wrapperElements.forEach((element) => {
          element.style.width = '100%'
          element.style.height = '100%'
          element.style.borderRadius = '9999px'
          element.style.overflow = 'hidden'
        })
      })
    } catch (err) {
      console.error('[CourtRoom:Agora] failed to play video track', err)
    }

    return () => {
      try {
        videoTrack.stop()
      } catch {
        // no-op
      }

      while (container.firstChild) container.removeChild(container.firstChild)
    }
  }, [videoTrack, isLocal])

  useEffect(() => {
    if (!audioTrack || isLocal) return

    try {
      audioTrack.play()
    } catch (err) {
      console.error('[CourtRoom:Agora] failed to play audio track', err)
    }

    return () => {
      try {
        audioTrack.stop()
      } catch {
        // no-op
      }
    }
  }, [audioTrack, isLocal])

  return (
    <button
      type="button"
      className={[
        'absolute z-20 overflow-hidden rounded-full border-2 bg-black/40 backdrop-blur-sm transition',
        spotPosition(spot),
        spotTone(spot),
        canClickEnter ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default',
      ].join(' ')}
      onClick={() => {
        if (canClickEnter && onEnterSpot) {
          onEnterSpot()
          return
        }
      }}
    >
      {isJudge && userTrack && !isLocal && onToggleMute && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleMute()
          }}
          className={`absolute top-2 right-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border ${
            isMutedByJudge
              ? 'border-red-400 bg-red-600 text-white'
              : 'border-white/20 bg-black/60 text-white/70 hover:text-white'
          }`}
        >
          {isMutedByJudge ? <MicOff size={12} /> : <Mic size={12} />}
        </button>
      )}
      {videoTrack ? (
        <div ref={videoContainerRef} className="h-full w-full rounded-full overflow-hidden" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black/45 text-white/70">
          {spot === 'judge' ? (
            <Crown className="mb-1 h-7 w-7 text-amber-200" />
          ) : (
            <User className="mb-1 h-6 w-6 text-white/70" />
          )}

          <span className="max-w-[80%] truncate text-[10px] font-black">
            {userTrack
              ? username
              : canClickEnter
                ? isJoiningSpot
                  ? 'Entering...'
                  : `Enter ${spotLabel(spot)}`
                : spotLabel(spot)}
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-1/2 w-[92%] -translate-x-1/2 rounded-full bg-black/80 px-2 py-1 text-center">
        <p className="truncate text-[10px] font-black text-white">
          {userTrack
            ? username
            : canClickEnter
              ? `Click to enter ${spotLabel(spot)}`
              : `Waiting for ${spotLabel(spot)}`}
        </p>
      </div>
    </button>
  )
}

function StudioControls({
  activeSpot,
  isConnected,
  isJoining,
  canUseMicCamera,
  micOn,
  cameraOn,
  autoSpot,
  onEnter,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onEndCourt,
  canEnd,
  onDocket,
}: {
  activeSpot: CourtStudioSpot | null
  isConnected: boolean
  isJoining: boolean
  canUseMicCamera: boolean
  micOn: boolean
  cameraOn: boolean
  autoSpot: CourtStudioSpot
  onEnter: () => void
  onLeave: () => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onEndCourt: () => void
  canEnd: boolean
  onDocket: () => void
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-40 flex w-[min(920px,calc(100%-32px))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-black/75 p-3 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200/70">
          Agora Court Studio
        </p>
        <p className="truncate text-sm font-black text-amber-50">
          {activeSpot
            ? `You are in the ${spotLabel(activeSpot)} spot`
            : `Your assigned spot: ${spotLabel(autoSpot)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!activeSpot ? (
          <Button onClick={onEnter} disabled={isJoining}>
            {isJoining ? 'Entering...' : `Enter Courtroom as ${spotLabel(autoSpot)}`}
          </Button>
        ) : (
          <Button onClick={onLeave} variant="destructive">
            Leave Spot
          </Button>
        )}

        {canUseMicCamera && (
          <>
            <Button onClick={onToggleMic} variant="outline">
              {micOn ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
              {micOn ? 'Mute' : 'Unmute'}
            </Button>

            <Button onClick={onToggleCamera} variant="outline">
              {cameraOn ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}
              {cameraOn ? 'Camera Off' : 'Camera On'}
            </Button>
          </>
        )}

        <Button onClick={onDocket} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Docket
        </Button>

        {canEnd && (
          <Button onClick={onEndCourt} variant="destructive">
            End Court
          </Button>
        )}
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100 lg:flex">
        {isConnected ? '🟢 AGORA LIVE' : '⚫ OFFLINE'}
      </div>
    </div>
  )
}

export default function CourtRoom() {
  const { user, profile } = useAuthStore()
  const params = useParams()
  const navigate = useNavigate()

  const rawCourtId = params.courtId || params.id
  const courtId = cleanCourtUuid(rawCourtId)

  const [courtSession, setCourtSession] = useState<any>(null)
  const [courtParticipants, setCourtParticipants] = useState<any[]>([])
  const [activeSpot, setActiveSpot] = useState<CourtStudioSpot | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [showDocketModal, setShowDocketModal] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [activeCase, setActiveCase] = useState<any>(null)
  const [showImHere, setShowImHere] = useState(false)
  const [attendanceDeadline, setAttendanceDeadline] = useState<number | null>(null)
  const [selectedCaseForSentencing, setSelectedCaseForSentencing] = useState<any>(null)
  const [calledDefendantId, setCalledDefendantId] = useState<string | null>(null)
  const [judgeMutedUsers, setJudgeMutedUsers] = useState<Record<string, boolean>>({})

   const [agoraJoined, setAgoraJoined] = useState(false)
   const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
   const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null)
   const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null)
   const [micOn, setMicOn] = useState(false)
   const [cameraOn, setCameraOn] = useState(false)

   const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null)
   const localVideoRef = useRef<ICameraVideoTrack | null>(null)
   const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
   const joinedRef = useRef(false)
   const judgeMutedUsersRef = useRef<Record<string, boolean>>({})
    const autoEnterRef = useRef(false)
    const enterCourtroomRef = useRef<((forcedSpot?: CourtStudioSpot) => void) | null>(null)

   useEffect(() => {
     enterCourtroomRef.current = enterCourtroom
   })

   useEffect(() => {
     judgeMutedUsersRef.current = judgeMutedUsers
   }, [judgeMutedUsers])

   const effectiveRole = useMemo(() => normalizeCourtRole(profile), [profile])
  const autoSpot = useMemo(() => getAutoStudioSpot(effectiveRole), [effectiveRole])

  const canUseMicCamera = canPublishFromSpot(activeSpot)
  const canEnd = canEndCourt(effectiveRole)

  const agoraChannelName = courtId ? makeCourtRoomName(courtId) : ''

  const cleanupLocalTracks = useCallback(() => {
    try {
      localAudioRef.current?.stop()
      localAudioRef.current?.close()
    } catch {
      // no-op
    }

    try {
      localVideoRef.current?.stop()
      localVideoRef.current?.close()
    } catch {
      // no-op
    }

    localAudioRef.current = null
    localVideoRef.current = null
    setLocalAudioTrack(null)
    setLocalVideoTrack(null)
    setMicOn(false)
    setCameraOn(false)
  }, [])

  const leaveAgora = useCallback(async () => {
    const client = agoraClientRef.current

    try {
      if (client && joinedRef.current) {
        const tracks = [localAudioRef.current, localVideoRef.current].filter(Boolean) as any[]
        if (tracks.length > 0) {
          try {
            await client.unpublish(tracks)
          } catch {
            // no-op
          }
        }

        await client.leave()
      }
    } catch (error) {
      console.error('[CourtRoom:Agora] leave failed', error)
    } finally {
      cleanupLocalTracks()
      joinedRef.current = false
      setAgoraJoined(false)
      setRemoteUsers([])
    }
  }, [cleanupLocalTracks])

  const ensureAgoraClient = useCallback(() => {
    if (agoraClientRef.current) return agoraClientRef.current

    const client = AgoraRTC.createClient({
      mode: 'live',
      codec: 'vp8',
    })

    client.on('user-published', async (remoteUser, mediaType) => {
      try {
        await client.subscribe(remoteUser, mediaType)

        if (mediaType === 'audio') {
          if (judgeMutedUsersRef.current[remoteUser.uid]) {
            try {
              remoteUser.audioTrack?.stop()
            } catch {
              // no-op
            }
          } else {
            remoteUser.audioTrack?.play()
          }
        }

        setRemoteUsers((prev) => {
          const exists = prev.some((item) => String(item.uid) === String(remoteUser.uid))
          if (exists) {
            return prev.map((item) => (String(item.uid) === String(remoteUser.uid) ? remoteUser : item))
          }
          return [...prev, remoteUser]
        })
      } catch (error) {
        console.error('[CourtRoom:Agora] subscribe failed', error)
      }
    })

    client.on('user-unpublished', (remoteUser) => {
      setRemoteUsers((prev) =>
        prev.map((item) => (String(item.uid) === String(remoteUser.uid) ? remoteUser : item)),
      )
    })

    client.on('user-left', (remoteUser) => {
      setRemoteUsers((prev) => prev.filter((item) => String(item.uid) !== String(remoteUser.uid)))
    })

    agoraClientRef.current = client

    return client
  }, [])

  const joinAgora = useCallback(
    async (spot: CourtStudioSpot) => {
      if (!user?.id || !agoraChannelName) {
        throw new Error('Missing user or court Agora channel.')
      }

      const publish = canPublishFromSpot(spot)
      const agoraRole: 'publisher' | 'audience' = publish ? 'publisher' : 'audience'

      const client = ensureAgoraClient()

      if (joinedRef.current) {
        return
      }

      const tokenResponse = await getAgoraCourtToken({
        channelName: agoraChannelName,
        uid: user.id,
        role: agoraRole,
      })

      if (!tokenResponse.appId) {
        throw new Error('Agora App ID missing.')
      }

      client.setClientRole?.(publish ? 'host' : 'audience')

      await client.join(
        tokenResponse.appId,
        tokenResponse.channelName || tokenResponse.channel || agoraChannelName,
        tokenResponse.token || null,
        String(tokenResponse.uid || user.id),
      )

      joinedRef.current = true
      setAgoraJoined(true)

      if (!publish) {
        return
      }

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {},
        {
          encoderConfig: '480p_1',
          optimizationMode: 'motion',
        },
      )

      localAudioRef.current = microphoneTrack
      localVideoRef.current = cameraTrack
      setLocalAudioTrack(microphoneTrack)
      setLocalVideoTrack(cameraTrack)
      setMicOn(true)
      setCameraOn(true)

      await client.publish([microphoneTrack, cameraTrack])
    },
    [agoraChannelName, ensureAgoraClient, user?.id],
  )

  const fetchCourtSession = useCallback(async () => {
    if (!courtId) return

    const { data, error } = await supabase
      .from('court_sessions')
      .select('*')
      .eq('id', courtId)
      .maybeSingle()

    if (error || !data) {
      toast.error('Court session not found.')
      navigate('/troll-court')
      return
    }

    setCourtSession(data)
  }, [courtId, navigate])

  const fetchCourtParticipants = useCallback(async () => {
    if (!courtId) return

    const { data, error } = await supabase
      .from('court_participants')
      .select('*, user_profiles(username, avatar_url)')
      .eq('court_session_id', courtId)

    if (!error && data) {
      setCourtParticipants(data)
    }
  }, [courtId])

  useEffect(() => {
    if (!rawCourtId) {
      const loadActiveSession = async () => {
        const { data, error } = await supabase
          .from('court_sessions')
          .select('id')
          .in('status', ['active', 'live'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error || !data) {
          toast.error('No active court session found.')
          navigate('/troll-court')
          return
        }

        navigate(`/court/${data.id}`, { replace: true })
      }

      void loadActiveSession()
      return
    }

    if (!courtId) {
      toast.error('Invalid court session ID.')
      navigate('/troll-court')
    }
  }, [rawCourtId, courtId, navigate])

  useEffect(() => {
    if (!courtId) return

    fetchCourtSession()
    fetchCourtParticipants()

    const sessionChannel = supabase
      .channel(`court_session_agora_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${courtId}`,
        },
        (payload) => {
          if (!payload.new) return

          const next = payload.new as any
          setCourtSession(next)

          if (next.status && !['active', 'live', 'waiting'].includes(next.status)) {
            toast.info('Court session ended.')
            navigate(`/court/${courtId}/summary`)
          }
        },
      )
      .subscribe()

    const participantChannel = supabase
      .channel(`court_participants_agora_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_participants',
          filter: `court_session_id=eq.${courtId}`,
        },
        () => {
          fetchCourtParticipants()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(participantChannel)
    }
  }, [courtId, fetchCourtParticipants, fetchCourtSession, navigate])

   useEffect(() => {
     return () => {
       leaveAgora()
     }
   }, [leaveAgora])

    useEffect(() => {
      if (!courtId || !user?.id || activeSpot || isJoining) return
      if (autoSpot !== 'audience') return
      if (autoEnterRef.current) return

      autoEnterRef.current = true

      void enterCourtroomRef.current('audience')
    }, [courtId, user?.id, activeSpot, isJoining, autoSpot])

   const upsertParticipantRole = async (spot: CourtStudioSpot) => {
    if (!courtId || !user?.id) return

    const { data, error } = await supabase.rpc('join_court_session', {
      p_court_session_id: courtId,
      p_role: spot,
    })

    if (error) throw error

    if (!data?.success) {
      throw new Error(data?.message || 'Failed to join court session.')
    }

    await fetchCourtParticipants()
  }

  const enterCourtroom = async (forcedSpot?: CourtStudioSpot) => {
    if (!courtId || !user?.id) {
      toast.error('Court ID or user missing.')
      return
    }

    setIsJoining(true)

    try {
      const spot = forcedSpot || autoSpot
      const previousSpot = activeSpot

      if (previousSpot && previousSpot !== spot) {
        await leaveAgora()
        if (courtId && user?.id) {
          await supabase
            .from('court_participants')
            .delete()
            .eq('court_session_id', courtId)
            .eq('user_id', user.id)
        }
        setActiveSpot(null)
        await fetchCourtParticipants()
      }

      await upsertParticipantRole(spot)
      await joinAgora(spot)

      if (spot === 'judge') {
        await supabase
          .from('court_sessions')
          .update({
            judge_id: user.id,
            judge_username: profile?.username || user.email || 'Judge',
            status: courtSession?.status === 'waiting' ? 'active' : courtSession?.status || 'active',
          })
          .eq('id', courtId)

        setCourtSession((prev: any) => ({
          ...prev,
          judge_id: user.id,
          judge_username: profile?.username || user.email || 'Judge',
          status: prev?.status === 'waiting' ? 'active' : prev?.status || 'active',
        }))
      }

      if (spot === 'defendant' && previousSpot === 'audience' && calledDefendantId === user?.id) {
        if (localAudioRef.current) {
          await localAudioRef.current.setEnabled(false)
          setMicOn(false)
        }
        if (localVideoRef.current) {
          await localVideoRef.current.setEnabled(true)
          setCameraOn(true)
        }

        if (activeCase?.id) {
          try {
            await supabase.rpc('record_defendant_attendance', { p_case_id: activeCase.id })
          } catch {
            // no-op
          }
        }
      }

      setActiveSpot(spot)
      toast.success(
        spot === 'audience'
          ? 'Joined courtroom audience.'
          : `Entered courtroom as ${spotLabel(spot)}.`,
      )
    } catch (error: any) {
      console.error('[CourtRoom:Agora] enter failed', error)
      toast.error(error?.message || 'Failed to enter courtroom.')

      try {
        await leaveAgora()
      } catch {
        // no-op
      }
    } finally {
      setIsJoining(false)
    }
  }

  const leaveCurrentSpot = async () => {
    try {
      await leaveAgora()

      if (courtId && user?.id) {
        await supabase
          .from('court_participants')
          .delete()
          .eq('court_session_id', courtId)
          .eq('user_id', user.id)
      }

      setActiveSpot(null)
      await fetchCourtParticipants()
      toast.info('Left courtroom spot.')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to leave courtroom spot.')
    }
  }

  const handleSelectCase = async (caseItem: any) => {
    if (!courtId || !user?.id) return
    try {
      const { data, error } = await supabase.rpc('set_active_case', {
        p_case_id: caseItem.id,
        p_session_id: courtId,
      })

      if (error) throw error

      if (data?.success) {
        setActiveCase(caseItem)
        setShowDocketModal(false)
        toast.success(`Case #${caseItem.id.slice(0, 8)} is now in session`)

        if (caseItem.defendant_id) {
          setShowImHere(true)
          setAttendanceDeadline(Date.now() + 30_000)
          setCalledDefendantId(caseItem.defendant_id)
        } else {
          setShowImHere(false)
          setAttendanceDeadline(null)
          setCalledDefendantId(null)
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to call case')
    }
  }

  const handleImHere = async () => {
    if (!activeCase?.id) return
    try {
      const { data, error } = await supabase.rpc('record_defendant_attendance', {
        p_case_id: activeCase.id,
      })

      if (error) throw error

      if (data?.success) {
        setShowImHere(false)
        setAttendanceDeadline(null)
        toast.success('Attendance recorded. You are present.')
      } else if (data?.expired) {
        setShowImHere(false)
        setAttendanceDeadline(null)
        toast.error('Attendance window expired.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record attendance')
    }
  }

  useEffect(() => {
    if (!showImHere || !attendanceDeadline || !activeCase?.id) return
    const timer = window.setTimeout(async () => {
      setShowImHere(false)
      setAttendanceDeadline(null)
      try {
        await supabase.rpc('mark_failure_to_appear', { p_case_id: activeCase.id })
      } catch {
        // no-op
      }
      toast.error('Failure to appear recorded.')
    }, Math.max(0, attendanceDeadline - Date.now()))
    return () => window.clearTimeout(timer)
  }, [showImHere, attendanceDeadline, activeCase?.id])

  const safeToggleMic = async () => {
    if (!canUseMicCamera) {
      toast.error('Enter a speaking spot before using mic.')
      return
    }

    if (!localAudioRef.current) {
      toast.error('Microphone track is not ready.')
      return
    }

    try {
      const next = !micOn
      await localAudioRef.current.setEnabled(next)
      setMicOn(next)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle mic.')
    }
  }

  const safeToggleCamera = async () => {
    if (!canUseMicCamera) {
      toast.error('Enter a speaking spot before using camera.')
      return
    }

    if (!localVideoRef.current) {
      toast.error('Camera track is not ready.')
      return
    }

    try {
      const next = !cameraOn
      await localVideoRef.current.setEnabled(next)
      setCameraOn(next)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle camera.')
    }
  }

  const toggleJudgeMute = useCallback(async (userId: string) => {
    setJudgeMutedUsers((prev) => {
      const next = { ...prev }
      const isMuting = !next[userId]
      if (isMuting) {
        next[userId] = true
      } else {
        delete next[userId]
      }

      const remoteUser = remoteUsers.find((u) => String(u.uid) === String(userId))
      if (remoteUser?.audioTrack) {
        if (isMuting) {
          try {
            remoteUser.audioTrack.stop()
          } catch {
            // no-op
          }
        } else {
          try {
            remoteUser.audioTrack.play()
          } catch {
            // no-op
          }
        }
      }

      return next
    })
  }, [remoteUsers])

  const handleEndCourt = async () => {
    if (!canEnd) {
      toast.error('Only court staff can end court.')
      return
    }

    if (!confirm('End this court session?')) return

    try {
      await supabase
        .from('court_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', courtId)

      await leaveAgora()
      setActiveSpot(null)
      toast.success('Court session ended.')
      navigate(`/court/${courtId}/summary`)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to end court.')
    }
  }

  const findParticipantBySpot = (spot: CourtStudioSpot) => {
    return courtParticipants.find(
      (participant) => String(participant.role || '').toLowerCase() === spot,
    )
  }

  const findRemoteAgoraUser = (id?: string | null) => {
    if (!id) return undefined

    return remoteUsers.find((remoteUser) => String(remoteUser.uid) === String(id))
  }

  const findTrackUser = (
    id?: string | null,
    username?: string | null,
    role?: CourtStudioSpot,
  ): AgoraCourtTrack | undefined => {
    if (!id) return undefined

    const cleanId = cleanCourtUuid(id) || id

    if (cleanId === user?.id) {
      return {
        uid: user.id,
        videoTrack: localVideoTrack,
        audioTrack: localAudioTrack,
        username: username || profile?.username || 'You',
        role,
        isLocal: true,
      }
    }

    const remote = findRemoteAgoraUser(cleanId)

    if (remote) {
      return {
        uid: remote.uid,
        videoTrack: remote.videoTrack || null,
        audioTrack: remote.audioTrack || null,
        username: username || String(remote.uid),
        role,
        isLocal: false,
      }
    }

    return {
      uid: cleanId,
      username,
      role,
      isLocal: false,
    }
  }

  const spotUsers = useMemo(() => {
    const judgeParticipant = findParticipantBySpot('judge')
    const prosecutorParticipant = findParticipantBySpot('prosecutor')
    const attorneyParticipant = findParticipantBySpot('attorney')
    const defendantParticipant = findParticipantBySpot('defendant')
    const witnessParticipant = findParticipantBySpot('witness')

    const judgeId = courtSession?.judge_id || judgeParticipant?.user_id

    return {
      judge: findTrackUser(
        judgeId,
        courtSession?.judge_username ||
          judgeParticipant?.user_profiles?.username ||
          'Judge',
        'judge',
      ),
      prosecutor: findTrackUser(
        prosecutorParticipant?.user_id,
        prosecutorParticipant?.user_profiles?.username || 'Prosecutor',
        'prosecutor',
      ),
      attorney: findTrackUser(
        attorneyParticipant?.user_id,
        attorneyParticipant?.user_profiles?.username || 'Defense Attorney',
        'attorney',
      ),
      defendant: findTrackUser(
        courtSession?.defendant_id || defendantParticipant?.user_id,
        courtSession?.defendant_username ||
          defendantParticipant?.user_profiles?.username ||
          'Defendant',
        'defendant',
      ),
      witness: findTrackUser(
        witnessParticipant?.user_id,
        witnessParticipant?.user_profiles?.username || 'Witness',
        'witness',
      ),
      audience:
        activeSpot === 'audience' && user?.id
          ? {
              uid: user.id,
              username: profile?.username || 'You',
              role: 'audience',
              isLocal: true,
            }
          : undefined,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    courtParticipants,
    courtSession,
    remoteUsers,
    user?.id,
    localVideoTrack,
    localAudioTrack,
    activeSpot,
    profile?.username,
  ])

  const canEnterSpecificSpot = (spot: CourtStudioSpot) => {
    if (isJoining) return false

    if (activeSpot) {
      if (activeSpot === 'audience' && spot === 'defendant' && calledDefendantId === user?.id) {
        return true
      }
      if (activeSpot === 'defendant' && spot === 'audience') {
        return true
      }
      return false
    }

    if (spot === 'audience') return autoSpot === 'audience'
    if (autoSpot === spot) return true
    if (canJudge(effectiveRole) && spot === 'judge') return true

    return false
  }

  return (
    <RequireRole
      roles={[UserRole.ADMIN, UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, UserRole.USER]}
      fallbackPath="/access-denied"
    >
      <div className="relative h-[calc(100dvh-76px)] overflow-hidden bg-black text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/troll-court-studio.png')",
          }}
        />

        <div className="absolute inset-0 bg-black/15" />

        {showImHere && user?.id && activeCase?.defendant_id === user.id && attendanceDeadline && (
          <div className="absolute inset-x-4 top-4 z-50 rounded-2xl border border-green-400/40 bg-black/85 p-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-black text-green-300">CASE CALLED — YOU ARE THE DEFENDANT</p>
              <button
                onClick={handleImHere}
                className="rounded-xl bg-green-500 px-6 py-3 font-black text-white shadow-[0_0_30px_rgba(34,197,94,0.35)] hover:bg-green-400"
              >
                I'M HERE
              </button>
              <p className="text-xs text-green-200/70">
                You have 30 seconds to confirm your appearance.
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 z-30 rounded-2xl border border-amber-300/25 bg-black/70 px-4 py-3 shadow-[0_0_26px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-amber-200" />
            <div>
              <h1 className="text-xl font-black text-amber-50">Troll Court</h1>
              <p className="text-xs text-amber-100/70">
                Case #{courtId?.slice(0, 8) || 'invalid'} • {courtSession?.status || 'loading'}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-2xl border border-amber-300/25 bg-black/70 px-4 py-3 text-xs font-black text-amber-100 shadow-[0_0_26px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {agoraJoined ? '🟢 AGORA COURTROOM' : '⚫ STUDIO OFFLINE'}
        </div>

        <CourtStudioTile
          spot="judge"
          userTrack={spotUsers.judge}
          isLocal={String(spotUsers.judge?.uid || '') === user?.id}
          canEnterSpot={canEnterSpecificSpot('judge')}
          isJoiningSpot={isJoining && autoSpot === 'judge'}
          onEnterSpot={() => enterCourtroom('judge')}
          isJudge={canJudge(effectiveRole)}
          isMutedByJudge={!!judgeMutedUsers[String(spotUsers.judge?.uid || '')]}
          onToggleMute={spotUsers.judge?.uid && String(spotUsers.judge?.uid) !== user?.id ? () => toggleJudgeMute(String(spotUsers.judge?.uid)) : undefined}
        />

        <CourtStudioTile
          spot="prosecutor"
          userTrack={spotUsers.prosecutor}
          isLocal={String(spotUsers.prosecutor?.uid || '') === user?.id}
          canEnterSpot={canEnterSpecificSpot('prosecutor')}
          isJoiningSpot={isJoining && autoSpot === 'prosecutor'}
          onEnterSpot={() => enterCourtroom('prosecutor')}
          isJudge={canJudge(effectiveRole)}
          isMutedByJudge={!!judgeMutedUsers[String(spotUsers.prosecutor?.uid || '')]}
          onToggleMute={spotUsers.prosecutor?.uid && String(spotUsers.prosecutor?.uid) !== user?.id ? () => toggleJudgeMute(String(spotUsers.prosecutor?.uid)) : undefined}
        />

        <CourtStudioTile
          spot="attorney"
          userTrack={spotUsers.attorney}
          isLocal={String(spotUsers.attorney?.uid || '') === user?.id}
          canEnterSpot={canEnterSpecificSpot('attorney')}
          isJoiningSpot={isJoining && autoSpot === 'attorney'}
          onEnterSpot={() => enterCourtroom('attorney')}
          isJudge={canJudge(effectiveRole)}
          isMutedByJudge={!!judgeMutedUsers[String(spotUsers.attorney?.uid || '')]}
          onToggleMute={spotUsers.attorney?.uid && String(spotUsers.attorney?.uid) !== user?.id ? () => toggleJudgeMute(String(spotUsers.attorney?.uid)) : undefined}
        />

        <CourtStudioTile
          spot="witness"
          userTrack={spotUsers.witness}
          isLocal={String(spotUsers.witness?.uid || '') === user?.id}
          canEnterSpot={canEnterSpecificSpot('witness')}
          isJoiningSpot={isJoining && autoSpot === 'witness'}
          onEnterSpot={() => enterCourtroom('witness')}
          isJudge={canJudge(effectiveRole)}
          isMutedByJudge={!!judgeMutedUsers[String(spotUsers.witness?.uid || '')]}
          onToggleMute={spotUsers.witness?.uid && String(spotUsers.witness?.uid) !== user?.id ? () => toggleJudgeMute(String(spotUsers.witness?.uid)) : undefined}
        />

        <CourtStudioTile
          spot="defendant"
          userTrack={spotUsers.defendant}
          isLocal={String(spotUsers.defendant?.uid || '') === user?.id}
          canEnterSpot={canEnterSpecificSpot('defendant')}
          isJoiningSpot={isJoining && autoSpot === 'defendant'}
          onEnterSpot={() => enterCourtroom('defendant')}
          isJudge={canJudge(effectiveRole)}
          isMutedByJudge={!!judgeMutedUsers[String(spotUsers.defendant?.uid || '')]}
          onToggleMute={spotUsers.defendant?.uid && String(spotUsers.defendant?.uid) !== user?.id ? () => toggleJudgeMute(String(spotUsers.defendant?.uid)) : undefined}
        />

        <CourtStudioTile
          spot="audience"
          userTrack={spotUsers.audience}
          isLocal={activeSpot === 'audience'}
          canEnterSpot={canEnterSpecificSpot('audience')}
          isJoiningSpot={isJoining && autoSpot === 'audience'}
          onEnterSpot={() => enterCourtroom('audience')}
        />

        <div className="absolute right-4 top-24 z-30 flex flex-col gap-2">
          <Button variant="outline" onClick={() => setShowDocketModal(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Docket
          </Button>

          <Button variant="outline" onClick={() => setShowChat((value) => !value)}>
            <Users className="mr-2 h-4 w-4" />
            Chat
          </Button>

          <Button variant="outline" onClick={() => navigate('/troll-court')}>
            <LogOut className="mr-2 h-4 w-4" />
            Exit
          </Button>
        </div>

        {showChat && (
          <div className="absolute bottom-28 right-4 z-40 h-[360px] w-[360px] overflow-hidden rounded-2xl border border-amber-300/25 bg-black/80 p-3 shadow-[0_0_34px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <CourtChat courtId={courtId || ''} isLocked={!canJudge(effectiveRole)} />
          </div>
        )}

        <StudioControls
          activeSpot={activeSpot}
          isConnected={agoraJoined}
          isJoining={isJoining}
          canUseMicCamera={canUseMicCamera}
          micOn={micOn}
          cameraOn={cameraOn}
          autoSpot={autoSpot}
          onEnter={() => enterCourtroom(autoSpot)}
          onLeave={leaveCurrentSpot}
          onToggleMic={safeToggleMic}
          onToggleCamera={safeToggleCamera}
          onEndCourt={handleEndCourt}
          canEnd={canEnd}
          onDocket={() => setShowDocketModal(true)}
        />

        <CourtDocketModal
          isOpen={showDocketModal}
          onClose={() => setShowDocketModal(false)}
          onSelectCase={handleSelectCase}
          onSentenceCase={setSelectedCaseForSentencing}
          courtId={courtId || ''}
          isJudge={canJudge(effectiveRole)}
        />

        <JudgeSentencingModal
          isOpen={!!selectedCaseForSentencing}
          caseData={selectedCaseForSentencing}
          onClose={() => setSelectedCaseForSentencing(null)}
          onSuccess={() => setSelectedCaseForSentencing(null)}
        />
      </div>
    </RequireRole>
  )
}