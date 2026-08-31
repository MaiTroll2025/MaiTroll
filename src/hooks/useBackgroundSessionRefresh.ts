import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

/**
 * Background session refresh hook
 * Periodically refreshes the Supabase session and user profile to prevent
 * staleness issues that occur after ~10 minutes of inactivity.
 * 
 * This addresses the issue where the site becomes stale until refresh.
 */
export function useBackgroundSessionRefresh() {
  const navigate = useNavigate()
  const { user, logout, refreshProfile } = useAuthStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const lastRefreshTimeRef = useRef<number>(Date.now())

  const isBroadcastRoute = () => {
    if (typeof window === 'undefined') return false
    return /^\/(broadcast|watch|live)(\/|$)/.test(window.location.pathname)
  }
  
  // Attempt session refresh with retry logic
  const attemptRefresh = async (retries = 2): Promise<boolean> => {
    const { data: currentSession } = await supabase.auth.getSession()
    const expiresAtMs = currentSession.session?.expires_at
      ? currentSession.session.expires_at * 1000
      : 0

    if (currentSession.session?.access_token && expiresAtMs - Date.now() > 5 * 60 * 1000) {
      return true
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data?.session?.access_token) {
          return true
        }
        const { data: checkSession } = await supabase.auth.getSession()
        if (checkSession.session?.access_token) {
          return true
        }
      } catch (err) {
        if (attempt === retries) {
          console.debug('[BackgroundSession] Token refresh retry failed; session will be checked again quietly', err)
        }
      }
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
    return false
  }

  // Function to refresh session and profile
  const doRefresh = useCallback(async () => {
    if (!user) return
    
    if (refreshInFlightRef.current) {
      console.debug('[BackgroundSession] Refresh already in progress, skipping')
      return
    }
    refreshInFlightRef.current = true
    
    try {
      const refreshSucceeded = await attemptRefresh(2)
      
      if (!refreshSucceeded) {
        console.debug('[BackgroundSession] Refresh attempts did not complete; checking session state')
        const { data: finalCheck } = await supabase.auth.getSession()
        if (!finalCheck.session?.access_token) {
          console.warn('[BackgroundSession] No valid session after all attempts - logging out')
          await logout()
          navigate('/auth', { replace: true })
          return
        }
      }

      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current
      if (timeSinceLastRefresh > 5 * 60 * 1000) {
        if (isBroadcastRoute()) {
          if (import.meta.env.DEV) console.debug('[BackgroundSession] Broadcast route active; skipping full profile refresh to prevent broadcast disruption')
          lastRefreshTimeRef.current = Date.now()
        } else {
          if (import.meta.env.DEV) console.log('[BackgroundSession] Performing periodic full refresh to prevent staleness')
          await refreshProfile()
          lastRefreshTimeRef.current = Date.now()
        }
      }
      
      window.dispatchEvent(new CustomEvent('supabase-realtime-activity'))
      
      console.debug('[BackgroundSession] Session and profile refreshed successfully')
    } catch (err) {
      console.error('[BackgroundSession] Unexpected error during refresh:', err)
    } finally {
      refreshInFlightRef.current = false
    }
  }, [user, logout, refreshProfile, navigate])

  useEffect(() => {
    // Only run if user is logged in
    if (!user) {
      return
    }

    // Prevent multiple intervals from being created
    if (isActiveRef.current) {
      return
    }
    isActiveRef.current = true

    // Refresh session every 10 minutes to prevent staleness
    // Reduced frequency to avoid rate limiting with Supabase's built-in autoRefreshToken
    const SESSION_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
    
    // Initial refresh
    doRefresh()

    // Set up periodic refresh with logging
    intervalRef.current = setInterval(() => {
      console.debug('[BackgroundSession] Periodic refresh triggered at', new Date().toISOString())
      doRefresh()
    }, SESSION_REFRESH_INTERVAL)

    // Refresh immediately when tab becomes visible again (fixes backgrounded tab logout)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.debug('[BackgroundSession] Tab became visible, refreshing session')
        doRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActiveRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, doRefresh])
}
