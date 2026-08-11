import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Stream } from '../types/broadcast'
import { BroadcastPage } from '../pages/broadcast/BroadcastPage'
import ViewerPage from '../pages/broadcast/ViewerPage'
import StreamEndedPage from '../pages/broadcast/StreamEndedPage'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://Mai Troll.app'
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/images/mai-troll-city-preview.png`

type BroadcasterMeta = {
  username: string
  avatar_url: string | null
  thumbnail_url?: string | null
}

type ProfileAccessSnapshot = {
  role: string
  isAdmin: boolean
  isSuperAdmin: boolean
  isStaff: boolean
  isOfficer: boolean
  isBroadOfficer: boolean
  isSecretary: boolean
  isPresident: boolean
  isCeo: boolean
}

function normalizeRole(value: unknown): string {
  return String(value || 'user').toLowerCase().trim()
}

function getProfileAccessSnapshot(profile: any): ProfileAccessSnapshot {
  const role = normalizeRole(profile?.role)
  const trollRole = normalizeRole(profile?.troll_role)

  const isAdmin =
    role === 'admin' ||
    role === 'ceo' ||
    profile?.is_admin === true ||
    profile?.is_ceo === true

  const isSuperAdmin =
    role === 'superadmin' ||
    profile?.is_superadmin === true

  const isCeo =
    role === 'ceo' ||
    profile?.is_ceo === true

  const isStaff =
    role === 'staff' ||
    profile?.is_staff === true

  const isOfficer =
    role === 'officer' ||
    role === 'troll_officer' ||
    trollRole === 'officer' ||
    trollRole === 'troll_officer' ||
    profile?.is_troll_officer === true ||
    profile?.is_lead_officer === true ||
    profile?.is_lead_troll_officer === true

  const isBroadOfficer =
    role === 'broadofficer' ||
    role === 'broad_officer' ||
    trollRole === 'broadofficer' ||
    trollRole === 'broad_officer'

  const isSecretary =
    role === 'secretary' ||
    profile?.is_secretary === true

  const isPresident =
    role === 'president' ||
    profile?.is_president === true

  return {
    role,
    isAdmin,
    isSuperAdmin,
    isStaff,
    isOfficer,
    isBroadOfficer,
    isSecretary,
    isPresident,
    isCeo,
  }
}

function canBypassBroadcastPassword(snapshot: ProfileAccessSnapshot): boolean {
  return (
    snapshot.isAdmin ||
    snapshot.isSuperAdmin ||
    snapshot.isCeo ||
    snapshot.isStaff ||
    snapshot.isOfficer ||
    snapshot.isBroadOfficer ||
    snapshot.isSecretary ||
    snapshot.isPresident
  )
}

function isEndedStream(stream: Stream | null): boolean {
  if (!stream) return false
  return stream.status === 'ended' || Boolean((stream as any).ended_at)
}

function updateMetaTag(property: string, content: string, isName = false) {
  if (typeof document === 'undefined') return

  const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`
  const existing = document.querySelector(selector)

  if (existing) {
    existing.setAttribute('content', content)
    return
  }

  const meta = document.createElement('meta')

  if (isName) {
    meta.setAttribute('name', property)
  } else {
    meta.setAttribute('property', property)
  }

  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

function injectSocialMetaTags(stream: Stream | null, broadcaster: BroadcasterMeta | null) {
  if (!stream || typeof document === 'undefined') return

  const isLive = stream.status === 'live' || stream.is_live === true
  const statusText = isLive ? 'LIVE' : 'Ended'
  const title = `${broadcaster?.username || 'Broadcaster'} is ${statusText} on Mai Troll`
  const description = stream.title || 'Watch this live broadcast on Mai Troll'
  const canonicalUrl = `${APP_URL}/watch/${stream.id}`
  const previewImage =
    (stream as any).thumbnail_url ||
    broadcaster?.thumbnail_url ||
    broadcaster?.avatar_url ||
    FALLBACK_PREVIEW_IMAGE

  document.title = title

  updateMetaTag('og:type', isLive ? 'video.other' : 'website')
  updateMetaTag('og:title', title)
  updateMetaTag('og:description', description)
  updateMetaTag('og:url', canonicalUrl)
  updateMetaTag('og:image', previewImage)
  updateMetaTag('og:site_name', 'MaiTroll')

  if (isLive) {
    updateMetaTag('og:video', `${APP_URL}/embed/${stream.id}`)
    updateMetaTag('og:video:secure_url', `${APP_URL}/embed/${stream.id}`)
    updateMetaTag('og:video:type', 'text/html')
    updateMetaTag('og:video:width', '1280')
    updateMetaTag('og:video:height', '720')
    updateMetaTag('og:live', 'true')
    updateMetaTag('og:stream:status', 'live')
  }

  updateMetaTag('twitter:card', isLive ? 'player' : 'summary_large_image', true)
  updateMetaTag('twitter:title', title, true)
  updateMetaTag('twitter:description', description, true)
  updateMetaTag('twitter:image', previewImage, true)
  updateMetaTag('twitter:site', '@Mai Trollapp', true)

  if (isLive) {
    updateMetaTag('twitter:player', `${APP_URL}/embed/${stream.id}`, true)
    updateMetaTag('twitter:player:width', '1280', true)
    updateMetaTag('twitter:player:height', '720', true)
  }

  const existingCanonical = document.querySelector('link[rel="canonical"]')

  if (existingCanonical) {
    existingCanonical.setAttribute('href', canonicalUrl)
  } else {
    const link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    link.setAttribute('href', canonicalUrl)
    document.head.appendChild(link)
  }

  // JSON-LD structured data (VideoObject for live streams)
  const existingSchema = document.querySelector('#stream-schema')
  if (existingSchema) existingSchema.remove()

  const schemaScript = document.createElement('script')
  schemaScript.id = 'stream-schema'
  schemaScript.type = 'application/ld+json'

  const streamStart = (stream as any).started_at || (stream as any).created_at || new Date().toISOString()
  const broadcasterName = broadcaster?.username || 'MaiTroll Creator'

  schemaScript.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': isLive ? 'VideoObject' : 'VideoObject',
    'name': stream.title || `${broadcasterName} on Mai Troll`,
    'description': description,
    'thumbnailUrl': previewImage,
    'uploadDate': streamStart,
    'url': canonicalUrl,
    'embedUrl': `${APP_URL}/embed/${stream.id}`,
    'author': {
      '@type': 'Person',
      'name': broadcasterName,
      'url': `${APP_URL}/profile/${encodeURIComponent(broadcasterName)}`
    },
    ...(isLive && {
      'isLiveBroadcast': true,
      'publication': {
        '@type': 'BroadcastEvent',
        'isLiveBroadcast': true,
        'startDate': streamStart
      }
    })
  })
  document.head.appendChild(schemaScript)
}

function injectSafeMetaForPrivateStream(streamId: string, isPrivate: boolean) {
  if (typeof document === 'undefined') return

  const title = isPrivate ? 'Private Broadcast' : 'Stream Not Found'
  const description = isPrivate
    ? 'This is a private broadcast. Log in to request access.'
    : 'This broadcast is not available.'

  document.title = title

  updateMetaTag('og:type', 'website')
  updateMetaTag('og:title', title)
  updateMetaTag('og:description', description)
  updateMetaTag('og:url', `${APP_URL}/watch/${streamId}`)
  updateMetaTag('og:image', FALLBACK_PREVIEW_IMAGE)

  updateMetaTag('twitter:card', 'summary_large_image', true)
  updateMetaTag('twitter:title', title, true)
  updateMetaTag('twitter:description', description, true)
  updateMetaTag('twitter:image', FALLBACK_PREVIEW_IMAGE, true)
}

/**
 * BroadcastRouter
 *
 * Stable routing rules:
 * - Host / stream owner -> BroadcastPage, LiveKit RTC publisher.
 * - Approved seat user -> BroadcastPage, LiveKit RTC participant.
 * - Normal viewer -> ViewerPage, LiveKit audience viewer.
 * - Staff/admin password bypass grants access only. It does not force RTC publishing.
 *
 * Mux/HLS viewer routing is intentionally not used.
 *
 * Stability note:
 * - Do not depend on the full profile object for route decisions.
 * - Do not log final route inside render.
 * - Do not remount BroadcastPage when profile realtime updates.
 */
function BroadcastRouter() {
  const params = useParams<{ id?: string; streamId?: string }>()
  const streamId = params.id || params.streamId
  const navigate = useNavigate()

   const userId = useAuthStore((state) => state.user?.id || null)
   const profile = useAuthStore((state) => state.profile)
   const profileAccess = useMemo(() => getProfileAccessSnapshot(profile), [profile])

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcaster, setBroadcaster] = useState<BroadcasterMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [enteredPassword, setEnteredPassword] = useState('')
  const [validatingPassword, setValidatingPassword] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  const lastRouteLogRef = useRef<string | null>(null)
  const lastAccessStateRef = useRef<string | null>(null)

  const isHost = useMemo(() => {
    return Boolean(stream?.user_id && userId && userId === stream.user_id)
  }, [stream?.user_id, userId])

  const shouldUseRtcPage = isHost

  const routingDecision = useMemo(
    () => ({
      streamId,
      userId,
      streamOwnerId: stream?.user_id || null,
      isHost,
      hasAccess,
      route: shouldUseRtcPage
        ? 'BroadcastPage (LiveKit RTC)'
        : 'ViewerPage (LiveKit Viewer)',
    }),
    [streamId, userId, stream?.user_id, isHost, hasAccess, shouldUseRtcPage],
  )

  const handleValidatePassword = useCallback(async () => {
    if (!streamId) return

    if (!enteredPassword.trim()) {
      toast.error('Please enter a password')
      return
    }

    setValidatingPassword(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_broadcast_password', {
        p_stream_id: streamId,
        p_password: enteredPassword,
      })

      if (rpcError) throw rpcError

      if (data?.success === true) {
        sessionStorage.setItem(`stream_access_${streamId}`, 'granted')
        setHasAccess(true)
        setShowPasswordModal(false)
        toast.success('Access granted!')
      } else {
        toast.error(data?.error || 'Incorrect password')
      }
    } catch (err: any) {
      console.error('[BroadcastRouter] Password validation error:', err)
      toast.error(err?.message || 'Failed to validate password')
    } finally {
      setValidatingPassword(false)
    }
  }, [enteredPassword, streamId])

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchStream = async () => {
      setIsLoading(true)
      setError(null)

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          streamId,
        )

      let streamData: Stream | null = null
      let broadcasterData: BroadcasterMeta | null = null

      try {
        if (isUUID) {
          const { data, error: fetchError } = await supabase
            .from('streams')
            .select('*')
            .eq('id', streamId)
            .maybeSingle()

          console.log('[BroadcastRouter] Stream fetch result:', {
            data,
            error: fetchError,
            streamId,
          })

          if (!fetchError && data) {
            streamData = data as Stream

            if ((data as any).user_id) {
              const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url, thumbnail_url')
                .eq('id', (data as any).user_id)
                .maybeSingle()

              if (profileError) {
                console.warn('[BroadcastRouter] Broadcaster profile lookup failed:', profileError)
              }

              broadcasterData = profileData as BroadcasterMeta | null
            }
          }
        } else {
          const { data: userData, error: userError } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, thumbnail_url')
            .eq('username', streamId)
            .maybeSingle()

          console.log('[BroadcastRouter] User lookup result:', {
            userData,
            error: userError,
            streamId,
          })

          if (!userError && userData) {
            broadcasterData = userData as BroadcasterMeta

            const { data: liveStream, error: liveStreamError } = await supabase
              .from('streams')
              .select('*')
              .eq('user_id', userData.id)
              .eq('is_live', true)
              .eq('status', 'live')
              .maybeSingle()

            console.log('[BroadcastRouter] Live stream lookup:', {
              streamDataByUser: liveStream,
              error: liveStreamError,
            })

            if (!liveStreamError && liveStream) {
              streamData = liveStream as Stream
            } else {
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

              const { data: recentStream, error: recentError } = await supabase
                .from('streams')
                .select('*')
                .eq('user_id', userData.id)
                .gte('created_at', tenMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (recentError) {
                console.warn('[BroadcastRouter] Recent stream fallback failed:', recentError)
              }

              console.log('[BroadcastRouter] Recent stream fallback:', { recentStream })

              if (recentStream) {
                streamData = recentStream as Stream
              }
            }
          }
        }
      } catch (err) {
        console.error('[BroadcastRouter] Stream fetch error:', err)
      }

      if (cancelled) return

      if (!streamData) {
        setStream(null)
        setBroadcaster(null)
        setError('Stream not found.')
        injectSafeMetaForPrivateStream(streamId, false)
        setIsLoading(false)
        return
      }

      setStream(streamData)
      setBroadcaster(broadcasterData)
      injectSocialMetaTags(streamData, broadcasterData)
      setIsLoading(false)
    }

    void fetchStream()

    return () => {
      cancelled = true
    }
  }, [streamId])

  useEffect(() => {
    if (!stream || !streamId) return

    const protectedStream = (stream as any).is_protected === true
    const sessionAccess = sessionStorage.getItem(`stream_access_${streamId}`)
    const canBypass = canBypassBroadcastPassword(profileAccess)

    let nextHasAccess = false
    let nextShowPasswordModal = false
    let reason = 'unknown'

    if (isHost) {
      nextHasAccess = true
      reason = 'host'
    } else if (canBypass) {
      nextHasAccess = true
      reason = 'role-bypass'
    } else if (!protectedStream) {
      nextHasAccess = true
      reason = 'public-stream'
    } else if (sessionAccess === 'granted') {
      nextHasAccess = true
      reason = 'session-access'
    } else {
      nextHasAccess = false
      nextShowPasswordModal = true
      reason = 'password-required'
      injectSafeMetaForPrivateStream(streamId, true)
    }

    const nextAccessKey = JSON.stringify({
      streamId,
      userId,
      streamOwnerId: stream.user_id,
      protectedStream,
      role: profileAccess.role,
      canBypass,
      sessionAccess,
      nextHasAccess,
      nextShowPasswordModal,
      reason,
    })

    if (lastAccessStateRef.current !== nextAccessKey) {
      lastAccessStateRef.current = nextAccessKey
      console.log('[BroadcastRouter] Access decision:', {
        streamId,
        userId,
        streamOwnerId: stream.user_id,
        protectedStream,
        role: profileAccess.role,
        canBypass,
        sessionAccess,
        hasAccess: nextHasAccess,
        showPasswordModal: nextShowPasswordModal,
        reason,
      })
    }

    setHasAccess((current) => (current === nextHasAccess ? current : nextHasAccess))
    setShowPasswordModal((current) =>
      current === nextShowPasswordModal ? current : nextShowPasswordModal,
    )
  }, [
    stream?.id,
    stream?.user_id,
    (stream as any)?.is_protected,
    streamId,
    userId,
    isHost,
    profileAccess.role,
    profileAccess.isAdmin,
    profileAccess.isSuperAdmin,
    profileAccess.isCeo,
    profileAccess.isStaff,
    profileAccess.isOfficer,
    profileAccess.isBroadOfficer,
    profileAccess.isSecretary,
    profileAccess.isPresident,
  ])

  useEffect(() => {
    if (!stream || !hasAccess) return

    const routeKey = JSON.stringify(routingDecision)

    if (lastRouteLogRef.current === routeKey) {
      return
    }

    lastRouteLogRef.current = routeKey
    console.log('[BroadcastRouter] Final route decision:', routingDecision)
  }, [stream, hasAccess, routingDecision])

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4">Loading stream...</p>
      </div>
    )
  }

  if (error || !stream) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-black text-white">
        <p className="text-red-500">{error || 'Stream not found'}</p>
      </div>
    )
  }

  // Gaming/TCNN redirects must come BEFORE the ended-stream check so that
  // gaming streams always route to the HytroGaming viewer regardless of status.
  const isTCNN = stream.category === 'tcnn'
  if (isTCNN) {
    if (isHost) {
      return <Navigate to={`/tcnn/broadcaster/${streamId}`} replace />
    }
    return <Navigate to={`/tcnn/viewer/${streamId}`} replace />
  }

  if (stream.category === 'gaming' && !isHost) {
    return <Navigate to={`/gaming/watch/${streamId}`} replace />
  }

  if (isEndedStream(stream)) {
    const fromGovernment = localStorage.getItem('fromGovernmentStreams')

    if (fromGovernment) {
      localStorage.removeItem('fromGovernmentStreams')
      return <Navigate to="/government/streams" replace />
    }

    return <StreamEndedPage />
  }

  if (showPasswordModal && !hasAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-purple-500/30 bg-slate-900 p-6">
          <div className="flex items-center gap-3 text-purple-400">
            <Lock className="h-6 w-6" />
            <h2 className="text-xl font-bold text-white">Protected Broadcast</h2>
          </div>

          <p className="text-sm text-gray-400">
            This broadcast is password protected. Please enter the password to join.
          </p>

          <input
            type="password"
            value={enteredPassword}
            onChange={(event) => setEnteredPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleValidatePassword()
              }
            }}
            placeholder="Enter password..."
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            autoFocus
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-xl bg-white/10 py-3 text-white transition-colors hover:bg-white/20"
            >
              Go Back
            </button>

            <button
              type="button"
              onClick={() => void handleValidatePassword()}
              disabled={validatingPassword}
              className="flex-1 rounded-xl bg-purple-600 py-3 text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {validatingPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Join Broadcast'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4">Checking access...</p>
      </div>
    )
  }

  return shouldUseRtcPage ? <BroadcastPage /> : <ViewerPage />
}

export default BroadcastRouter
