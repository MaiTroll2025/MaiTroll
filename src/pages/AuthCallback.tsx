import React from 'react'
import { supabase } from '../lib/supabase'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { generateUUID } from '../lib/uuid'

const AuthCallback = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth, setProfile } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'Trollcity2025@gmail.com'

  const landingForProfile = (prof: any) => {
    const userRole = prof?.role || prof?.troll_role
    if (userRole === 'troll_family') return '/family/home'
    if (userRole === 'organization' || userRole === 'org_admin' || prof?.organization_id) return '/organization/dashboard'
    if (userRole === 'student' || prof?.is_org_student) return '/mai-class'
    return '/home'
  }

  const [status, setStatus] = React.useState('Processing sign in…')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const run = async () => {
      try {
        setStatus('Completing authentication...')
        const params = new URLSearchParams(location.search)
        const code = params.get('code') || undefined
        const errorDesc = params.get('error_description') || undefined

        if (errorDesc) {
          const message = 'Authentication error: ' + errorDesc
          setErrorMessage(message)
          console.error('OAuth error:', errorDesc)
          toast.error(message)
          navigate('/auth')
          return
        }

        let sessionData = null
        let userProfile: any = null

        if (code) {
          console.log('Processing OAuth code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Session exchange error:', error)
            const message = 'Failed to complete sign in: ' + error.message
            setErrorMessage(message)
            toast.error(message)
            navigate('/auth')
            return
          }

          sessionData = data?.session
        }

        if (!sessionData) {
          const { data: sessionResult } = await supabase.auth.getSession()
          sessionData = sessionResult.session
        }

        if (!sessionData?.user) {
          console.log('No session found')
          setErrorMessage('No active session found after authentication.')
          toast.error('No session from provider')
          navigate('/auth')
          return
        }

        const u = sessionData.user
        console.log('User authenticated:', u.email)
        setStatus('Finalizing account...')

        const sessionId = generateUUID()
        try {
          localStorage.setItem('current_device_session_id', sessionId)
        } catch (e) {
          console.error('Failed to store session ID', e)
        }

        try {
          const deviceInfo = {
            browser: navigator.userAgent,
            platform: navigator.platform,
            screen: { width: window.screen.width, height: window.screen.height }
          }

          if (sessionId) {
            await supabase.rpc('register_session', {
              p_user_id: u.id,
              p_session_id: sessionId,
              p_device_info: JSON.stringify(deviceInfo),
              p_ip_address: null,
              p_user_agent: navigator.userAgent
            })
          } else {
            console.warn('[AuthCallback] Skipping register_session because session access_token is missing')
          }
        } catch (sessionError) {
          console.error('Error registering session:', sessionError)
        }

        setAuth(u as any, sessionData, sessionId)

        // Mark a fresh login so the Grand City Entrance replays the
        // ceremonial welcome on every login (including staff/employees).
        try { sessionStorage.setItem('tc_just_logged_in', '1') } catch { /* ignore */ }

        const fetchProfile = async () => {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', u.id)
            .maybeSingle()
          return profile
        }

        userProfile = await fetchProfile()

        if (!userProfile) {
          setStatus('Waiting for your account to finish setting up...')
          let retries = 0
          while (retries < 5 && !userProfile) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            userProfile = await fetchProfile()
            if (userProfile) break
            retries += 1
          }
        }

        if (userProfile) {
          console.log('Existing profile found:', userProfile.username)
          if (u.email === ADMIN_EMAIL && userProfile.role !== 'admin') {
            try {
              const now = new Date().toISOString()
              await supabase.from('user_profiles').update({ role: 'admin', updated_at: now }).eq('id', u.id)
              const { data: refreshed } = await supabase.from('user_profiles').select('*').eq('id', u.id).maybeSingle()
              if (refreshed) {
                userProfile = refreshed
              }
            } catch (adminError) {
              console.error('Admin role update failed:', adminError)
            }
          }

          setProfile(userProfile as any)
          try {
            localStorage.setItem(`tc-profile-${u.id}`, JSON.stringify({ data: userProfile, timestamp: Date.now() }))
          } catch {}

          if (!userProfile.username) {
            console.log('Profile needs setup - redirecting to setup')
            navigate('/profile/setup', { replace: true })
            return
          }

          toast.success('Welcome back!', { duration: 2000 })
          try {
            const ipRes = await fetch('https://api.ipify.org?format=json')
            const ipJson = await ipRes.json()
            const userIP = ipJson.ip
            const { data: current } = await supabase
              .from('user_profiles')
              .select('ip_address_history')
              .eq('id', u.id)
              .maybeSingle()
            const history = current?.ip_address_history || []
            const entry = { ip: userIP, timestamp: new Date().toISOString() }
            const updated = [...history, entry].slice(-10)
            await supabase
              .from('user_profiles')
              .update({ last_known_ip: userIP, ip_address_history: updated })
              .eq('id', u.id)
          } catch (ipError) {
            console.warn('[AuthCallback] IP tracking failed:', ipError)
          }

          navigate(landingForProfile(userProfile), { replace: true })
          return
        }

        console.warn('Profile not found after authentication, redirecting to profile setup')
        navigate('/profile/setup', { replace: true })
      } catch (error) {
        console.error('Auth callback error:', error)
        const message = (error as any)?.message || 'Authentication failed'
        setErrorMessage(message)
        toast.error(message)
        navigate('/auth')
      }
    }

    console.log('AuthCallback mounted, processing...')
    run()
  }, [navigate, setAuth, setProfile, location.search, ADMIN_EMAIL])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="bg-[#18181b] p-8 rounded-xl shadow-lg w-full max-w-md text-center space-y-4">
        <div className="text-lg font-semibold">{errorMessage ? 'Authentication issue' : status}</div>
        {errorMessage ? (
          <div className="text-sm text-slate-400">{errorMessage}</div>
        ) : (
          <div className="text-sm text-slate-400">Please wait while we finish signing you in.</div>
        )}

        {errorMessage ? (
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-2 mt-2 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80"
          >
            Return to Login
          </button>
        ) : (
          <div className="w-full py-4 rounded bg-[#111118] border border-[#2C2C2C]">
            <div className="mx-auto h-10 w-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
