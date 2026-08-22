import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useLiveContextStore } from '../lib/liveContextStore'

const IDLE_PROMPT_MS = 60 * 1000
const KEEP_ALIVE_MS = 30 * 60 * 1000
const BROADCASTER_IDLE_END_MS = 10 * 60 * 1000
const BROADCASTER_PROMPT_RESPONSE_MS = 10 * 60 * 1000

const STREAM_PATTERNS = /^\/(broadcast|watch|live|gaming\/watch|tcnn\/viewer|troll-court\/watch)(\/|$)/
const BROADCAST_PATTERNS = /^\/(broadcast|setup|gaming\/setup)(\/|$)/

function isInStream(pathname: string): boolean {
  return STREAM_PATTERNS.test(pathname)
}

function isBroadcasting(pathname: string): boolean {
  return BROADCAST_PATTERNS.test(pathname)
}

async function endStreamServerSide(streamId: string) {
  try {
    await supabase
      .from('streams')
      .update({ is_live: false, status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', streamId)

    const { data: session } = await supabase
      .from('rtc_sessions')
      .select('id, started_at')
      .eq('room_name', `stream-${streamId}`)
      .eq('is_active', true)
      .maybeSingle()

    if (session) {
      const endTime = new Date().toISOString()
      const startTime = new Date(session.started_at)
      const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)
      await supabase
        .from('rtc_sessions')
        .update({ is_active: false, ended_at: endTime, duration_seconds: durationSeconds })
        .eq('id', session.id)
    }

    console.log('[IdleSession] Stream ended server-side due to broadcaster inactivity:', streamId)
  } catch (err) {
    console.error('[IdleSession] Failed to end stream server-side:', err)
  }
}

export function useIdleSession() {
  const [showIdlePrompt, setShowIdlePrompt] = useState(false)
  const [isBroadcasterVerified, setIsBroadcasterVerified] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const activeStreamId = useLiveContextStore((s) => s.activeStreamId)

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepAliveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const broadcasterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const broadcasterCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const streamIdRef = useRef<string | null>(null)
  const pendingLogoutRef = useRef(false)

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    pendingLogoutRef.current = false

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
    if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
    if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)

    if (isInStream(location.pathname)) {
      return
    }

    idleTimerRef.current = setTimeout(() => {
      setShowIdlePrompt(true)
    }, IDLE_PROMPT_MS)
  }, [location.pathname])

  const handleActivity = useCallback(() => {
    if (isInStream(location.pathname)) {
      return
    }
    lastActivityRef.current = Date.now()
    pendingLogoutRef.current = false

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
    if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
    if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)

    setShowIdlePrompt(false)
    setIsBroadcasterVerified(false)
    setCountdown(0)
  }, [location.pathname])

  const handleKeepAlive = useCallback(() => {
    setShowIdlePrompt(false)
    setIsBroadcasterVerified(false)
    setCountdown(0)
    lastActivityRef.current = Date.now()
    pendingLogoutRef.current = false

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
    if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
    if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)

    keepAliveTimerRef.current = setTimeout(() => {
      resetIdleTimer()
    }, KEEP_ALIVE_MS)
  }, [resetIdleTimer])

  const handleBroadcasterVerify = useCallback(() => {
    setIsBroadcasterVerified(true)
    setShowIdlePrompt(false)
    setCountdown(0)
    lastActivityRef.current = Date.now()
    pendingLogoutRef.current = false

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
    if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
    if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)

    if (streamIdRef.current) {
      broadcasterTimerRef.current = setTimeout(() => {
        setShowIdlePrompt(true)
        let remaining = BROADCASTER_PROMPT_RESPONSE_MS / 1000
        setCountdown(remaining)
        
        broadcasterCountdownRef.current = setInterval(() => {
          remaining -= 1
          setCountdown(remaining)
          
          if (remaining <= 0) {
            if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
            endStreamServerSide(streamIdRef.current)
            setShowIdlePrompt(false)
            setIsBroadcasterVerified(false)
          }
        }, 1000)
      }, BROADCASTER_IDLE_END_MS)
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [user, handleActivity])

  useEffect(() => {
    if (!user) return

    if (isInStream(location.pathname)) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
      if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
      if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
      setShowIdlePrompt(false)
      setIsBroadcasterVerified(false)
      setCountdown(0)
      return
    }

    if (isBroadcasting(location.pathname) && activeStreamId) {
      streamIdRef.current = activeStreamId
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
      if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
      if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)

      broadcasterTimerRef.current = setTimeout(() => {
        setShowIdlePrompt(true)
        let remaining = BROADCASTER_PROMPT_RESPONSE_MS / 1000
        setCountdown(remaining)
        
        broadcasterCountdownRef.current = setInterval(() => {
          remaining -= 1
          setCountdown(remaining)
          
          if (remaining <= 0) {
            if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
            endStreamServerSide(streamIdRef.current)
            setShowIdlePrompt(false)
            setIsBroadcasterVerified(false)
          }
        }, 1000)
      }, BROADCASTER_IDLE_END_MS)
      return
    }

    streamIdRef.current = null
    if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
    if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
    resetIdleTimer()

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
      if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
      if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
    }
  }, [user, location.pathname, activeStreamId, resetIdleTimer])

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (keepAliveTimerRef.current) clearTimeout(keepAliveTimerRef.current)
      if (broadcasterTimerRef.current) clearTimeout(broadcasterTimerRef.current)
      if (broadcasterCountdownRef.current) clearInterval(broadcasterCountdownRef.current)
    }
  }, [])

  return {
    showIdlePrompt,
    isBroadcasterVerified,
    countdown,
    handleKeepAlive,
    handleBroadcasterVerify,
  }
}
