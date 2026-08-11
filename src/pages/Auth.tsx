import React, { useState, useEffect } from 'react'
import { AuthApiError } from '@supabase/supabase-js'
import { supabase, isAdminEmail, isStaffEmail, ALLOWED_STAFF_EMAILS } from '../lib/supabase'
import { post, API_ENDPOINTS } from '../lib/api'
import { toast } from 'sonner'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle, Building2, Phone, Globe, MapPin } from 'lucide-react'
import NavBubble from '../components/NavBubble';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import { generateUUID } from '../lib/uuid';
import { handleConcurrentLogin, resetConcurrentLoginCheck } from '../lib/sessionUtils';
import { moderation } from '@/services/maitrollModeration';

interface AuthProps {
  embedded?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'signup';
}


const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) || ''

const trackMobileError = (error: Error, context: string, userId?: string) => {
  if (import.meta.env.DEV) {
    console.warn('[Auth mobile tracking]', { context, userId, error })
  }
}

// Check for jail IP violations and ban if necessary
const checkJailIpViolations = async (userId: string, ipAddress: string) => {
  try {
    // Check if there are any jailed users on this IP (excluding current user)
    const { data: jailedUsers } = await supabase
      .from('jail')
      .select('user_id')
      .eq('ip_address', ipAddress)
      .neq('user_id', userId)
      .gt('release_time', new Date().toISOString());

    if (!jailedUsers || jailedUsers.length === 0) return; // No violations

    // Check existing violations for this IP
    const { data: existingViolation } = await supabase
      .from('jail_ip_violations')
      .select('count, is_permanent_ban')
      .eq('ip_address', ipAddress)
      .maybeSingle();

    let newCount = 1;
    if (existingViolation) {
      newCount = existingViolation.count + 1;
    }

    // Update or create violation record
    if (existingViolation) {
      await supabase
        .from('jail_ip_violations')
        .update({
          count: newCount,
          is_permanent_ban: newCount >= 3,
          banned_until: newCount >= 3 ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() : null
        })
        .eq('ip_address', ipAddress);
    } else {
      await supabase
        .from('jail_ip_violations')
        .insert({
          ip_address: ipAddress,
          user_id: userId,
          count: 1
        });
    }

    // If 3rd violation, ban all accounts on this IP
    if (newCount >= 3) {
      const { data: allUsersOnIp } = await supabase
        .from('user_profiles')
        .select('id')
        .contains('ip_address_history', [{ ip: ipAddress }]);

      if (allUsersOnIp && allUsersOnIp.length > 0) {
        await supabase
          .from('user_profiles')
          .update({ is_banned: true })
          .in('id', allUsersOnIp.map(u => u.id));

        // Log security violation
        await supabase
          .from('jail_security_violations')
          .insert({
            user_id: userId,
            ip_address: ipAddress,
            violation_type: 'multi_account',
            severity: 'critical',
            details: { banned_users: allUsersOnIp.length, ip_address: ipAddress }
          });

        toast.error('Your IP address has been permanently banned due to multiple account violations.');
        return;
      }
    }

    // For first 2 violations, just warn
    toast.warning(`Warning: Multiple accounts detected on this IP address. Violation ${newCount}/3.`);
  } catch (error) {
    console.error('Error checking jail IP violations:', error);
  }
};

const Auth = ({ embedded = false, onClose: _onClose, initialMode }: AuthProps = {}) => {
  // Prevent search engines from indexing the auth page
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const initialIsLogin = initialMode
    ? initialMode === 'login'
    : searchParams.get('mode') === 'signup' ? false : true
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
   const [showPassword, setShowPassword] = useState(false)
   const [orgPassword, setOrgPassword] = useState('')
   const [showOrgPassword, setShowOrgPassword] = useState(false)
   const [platform] = useState('')
    const [selectedRole, setSelectedRole] = useState<'user' | 'staff' | 'admin' | 'organization'>('user')
    const [isCelebSignup, setIsCelebSignup] = useState(false)
    const [celebFullName, setCelebFullName] = useState('')
    const [celebPhone, setCelebPhone] = useState('')
    const [celebSocialLinks, setCelebSocialLinks] = useState<{ platform: string; url: string }[]>([])
    const [showCelebFields, setShowCelebFields] = useState(false)
   const [roleEmailError, setRoleEmailError] = useState('')
   // Organization fields (only used when selectedRole === 'organization')
   const [orgName, setOrgName] = useState('')
   const [orgEmail, setOrgEmail] = useState('')
   const [orgPhone, setOrgPhone] = useState('')
   const [orgWebsite, setOrgWebsite] = useState('')
   const [orgCountry, setOrgCountry] = useState('')
   const [orgDescription, setOrgDescription] = useState('')
   const [orgError, setOrgError] = useState('')
   const [showAlertAdmin, setShowAlertAdmin] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertDetails, setAlertDetails] = useState('')
  const [alertSubmitting, setAlertSubmitting] = useState(false)
  const [dailyLimitReached, setDailyLimitReached] = useState(false)
  const [activeEvent, setActiveEvent] = useState<any>(null)
  const [inQueue, setInQueue] = useState(false)
  const [queueEmail, setQueueEmail] = useState('')
   const [queueUsername, setQueueUsername] = useState('')
   const [nextWindow, setNextWindow] = useState<Date | null>(null)
  const navigate = useNavigate()
  const { user, profile, setAuth, setProfile } = useAuthStore()
  
  // Check active event and signup limits
  useEffect(() => {
    const checkEventAndLimits = async () => {
      try {
        // 1. Get Active Event
        const { data: eventData } = await supabase.rpc('get_active_event')
        const event = eventData?.[0]
        setActiveEvent(event)

        if (event) {
          // 2. Get Signup Count for this event
          const { data: _count } = await supabase.rpc('get_active_event_signup_count')

          // eslint-disable-next-line no-constant-condition
          if (false) {
            setDailyLimitReached(true)
            const startTime = new Date(event.start_time)
            const endTime = new Date(startTime.getTime() + event.duration_hours * 60 * 60 * 1000)
            setNextWindow(endTime)
          } else {
            setDailyLimitReached(false)
          }
        } else {
          setDailyLimitReached(false)
        }
      } catch (err) {
        console.error('Error checking limits:', err)
      }
    }
    
    checkEventAndLimits()
    const interval = setInterval(checkEventAndLimits, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('signup_queue').insert({
        email: queueEmail || email,
        username: queueUsername || username
      })
      if (error) throw error
      setInQueue(true)
      toast.success('You have been added to the queue!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to join queue')
    } finally {
      setLoading(false)
    }
  }

  // Timer countdown
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!nextWindow || !dailyLimitReached) return

    const updateTimer = () => {
      const now = new Date()
      const diff = nextWindow.getTime() - now.getTime()

      if (diff <= 0) {
        setDailyLimitReached(false)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextWindow, dailyLimitReached])

  // Fetch profile from DB if user exists but profile is missing from store (e.g., on page refresh)
  useEffect(() => {
    if (user && !profile) {
      const fetchProfile = async () => {
        try {
          const { data: fetchedProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError) {
            console.error('Error fetching profile on refresh:', profileError)
            return
          }

          if (fetchedProfile) {
            // Check if admin needs updating
            const _isAdmin = fetchedProfile.role === 'admin' || fetchedProfile.is_admin === true;
            if (isAdminEmail(user.email) && fetchedProfile.role !== 'admin') {
              try {
                const now = new Date().toISOString()
                const { data: updated } = await supabase
                  .from('user_profiles')
                  .update({ role: 'admin', updated_at: now })
                  .eq('id', user.id)
                  .select('*')
                  .maybeSingle()
                setProfile(updated || fetchedProfile)
              } catch (err) {
                console.error('Failed to update admin role on refresh:', err)
                setProfile(fetchedProfile)
              }
            } else {
              setProfile(fetchedProfile)
            }
          }
        } catch (err) {
          console.error('Error in fetchProfile effect:', err)
        }
      }

      fetchProfile()
    }
  }, [user])

  // Get referral code from URL
  const referralCode = searchParams.get('ref') || ''

  // Validate role-email combinations on role or email change
  React.useEffect(() => {
    if (selectedRole === 'admin' && !isAdminEmail(email)) {
      setRoleEmailError(`Only the admin email (${ADMIN_EMAIL}) can sign up as admin`)
    } else if (selectedRole === 'staff' && !isStaffEmail(email)) {
      setRoleEmailError(`Your email is not authorized for staff role. Allowed: ${ALLOWED_STAFF_EMAILS.join(', ')}`)
    } else {
      setRoleEmailError('')
    }
  }, [email, selectedRole, isLogin])

   // Validate organization fields when org mode is selected
   React.useEffect(() => {
     if (selectedRole !== 'organization') {
       setOrgError('')
       return
     }

     if (!orgName.trim()) {
       setOrgError('Organization name is required')
     } else if (!orgEmail.trim()) {
       setOrgError('Business email is required')
     } else if (
       orgEmail.includes('@gmail.com') ||
       orgEmail.includes('@yahoo.com') ||
       orgEmail.includes('@hotmail.com') ||
       orgEmail.includes('@outlook.com')
     ) {
       setOrgError('Personal email addresses are not allowed. Please use a business email.')
     } else {
       setOrgError('')
     }
   }, [orgName, orgEmail, selectedRole])

  const landingForProfile = (prof: any) => {
    const userRole = prof?.role || prof?.troll_role
    if (userRole === 'troll_family') return '/family/home'
    if (userRole === 'student' || prof?.is_org_student) return '/home'
    return '/home'
  }

  const executeLogin = async (loginEmail: string, loginPassword: string) => {
    console.log('Attempting email login...')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    
    if (error) {
      console.error('Login error:', error)
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Login failed. Please try again or contact support if the issue persists.')
      }
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password.')
      }
      throw error
    }
    
    if (data.user && data.session) {
      console.log('Email login successful:', data.user.email)
      // Mark a fresh login so the Grand City Entrance can replay the
      // ceremonial welcome (shown on every login, including staff/employees).
      try { sessionStorage.setItem('tc_just_logged_in', '1') } catch { /* ignore */ }
      // All post-login work (profile fetch, session registration, IP tracking,
      // admin checks, navigation) is handled by the auth store's onAuthStateChange
      // handler via acceptSession → refreshProfile. Do NOT duplicate it here.
    } else if (data.user && !data.session) {
      throw new Error('Login failed. Please try again or contact support if the issue persists.')
    } else {
      throw new Error('Login failed - no user data returned')
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // Prevent double submission
    setLoading(true)
    
    try {
      if (isLogin) {
        await executeLogin(email, password)
      } else {
        if (selectedRole !== 'organization' && !username.trim()) {
          toast.error('Username is required for sign up')
          setLoading(false)
          return
        }

         if (!acceptedTerms) {
           toast.error('You must accept the terms and agreements to sign up')
           setLoading(false)
           return
         }
         
           // Check org fields if signing up as organization
           if (selectedRole === 'organization' && !orgName.trim()) {
             toast.error('Organization name is required')
             setLoading(false)
             return
           }
           if (selectedRole === 'organization' && !orgEmail.trim()) {
             toast.error('Business email is required')
             setLoading(false)
             return
           }
           if (selectedRole === 'organization') {
             // Validate business email (no personal emails)
             const cleanOrgEmail = orgEmail.trim().toLowerCase()
             if (
               cleanOrgEmail.includes('@gmail.com') ||
               cleanOrgEmail.includes('@yahoo.com') ||
               cleanOrgEmail.includes('@hotmail.com') ||
               cleanOrgEmail.includes('@outlook.com')
             ) {
               toast.error('Personal email addresses are not allowed for organizations. Please use a business email.')
               setLoading(false)
               return
             }
           }

          // Use Edge Function for signup
          console.log('Creating new user account...')
          
          // For organization signup, use org credentials; otherwise use user-provided
           const finalEmail = selectedRole === 'organization' ? orgEmail.trim() : email.trim()
           const finalPassword = selectedRole === 'organization' ? orgPassword : password
            const finalUsername = selectedRole === 'organization' ? orgName.trim() : username.trim()

            const signupData: any = {
            email: finalEmail,
            password: finalPassword,
            username: finalUsername,
            role: selectedRole,
            referral_code: referralCode || localStorage.getItem('recruited_by') || undefined,
            data: {
              terms_accepted: true,
              accepted_at: new Date().toISOString(),
              platform: selectedRole === 'organization' ? null : (platform || null)
            }
          }

          // Include organization details if signing up as organization
          if (selectedRole === 'organization') {
            signupData.organization_data = {
              name: orgName.trim(),
              email: orgEmail.trim(),
              phone: orgPhone.trim() || null,
              website: orgWebsite.trim() || null,
              country: orgCountry.trim(),
              description: orgDescription.trim()
            }
          }

          const { success, error: signUpError } = await post(API_ENDPOINTS.auth.signup, signupData)

        if (!success || signUpError) {
          console.error('Signup failed:', signUpError)
          toast.error(signUpError || 'Signup failed')
          setLoading(false)
          return
        }
        
           toast.success('Account created! Logging you in...')
           // Use org credentials for org signup
           const loginEmail = selectedRole === 'organization' ? orgEmail.trim() : email.trim()
           const loginPassword = selectedRole === 'organization' ? orgPassword : password
           await executeLogin(loginEmail, loginPassword)

           // Canonical ban evasion check
           const { data: { user: loggedInUser } } = await supabase.auth.getUser()
           if (loggedInUser) {
             const evasionResult = await moderation.checkBanEvasion(loggedInUser.id)
             if (evasionResult.evasionDetected) {
               toast.error('Account restricted due to policy violation. Please contact support.')
               // The App.tsx jail guard will redirect to /jail
             }
           }

           // If celeb signup was requested, submit the Celeb application
          if (isCelebSignup) {
            if (!celebFullName.trim() || !celebPhone.trim()) {
              toast.error('Please provide your full name and phone number for the Celeb application')
              return
            }

            try {
              const socialMedia = celebSocialLinks.length > 0
                ? celebSocialLinks.reduce((acc: Record<string, string>, link) => {
                    acc[link.platform] = link.url
                    return acc
                  }, {})
                : {}

              toast.info('Submitting your Celeb application...')
              const { success: appSuccess, error: appError } = await post(
                API_ENDPOINTS.celeb.submitApplication,
                {
                  full_name: celebFullName.trim(),
                  phone_number: celebPhone.trim(),
                  email: email.trim(),
                  social_media: socialMedia,
                },
              )

              if (!appSuccess || appError) {
                toast.error(appError || 'Failed to submit Celeb application')
              } else {
                toast.success('Celeb application submitted! You will be notified once reviewed.')
              }
            } catch (appErr: any) {
              toast.error(appErr?.message || 'Failed to submit Celeb application')
            }
          }
        }
    } catch (err: any) {
      console.error('Email auth error:', err)
      
      // Track the error for mobile monitoring
      const errorToTrack = err instanceof Error ? err : new Error(String(err))
      try {
        trackMobileError(errorToTrack, 'Auth-login', undefined)
      } catch (err) {
        console.error('Error tracking mobile error:', err)
      }
      
      if (err instanceof AuthApiError) {
        const msg = String(err.message || '')
        const lowerMsg = msg.toLowerCase()
        if (lowerMsg.includes('invalid refresh token') || lowerMsg.includes('refresh token not found')) {
          try {
            await supabase.auth.signOut()
          } catch (err) {
            console.error('Error signing out:', err)
          }
          try {
            useAuthStore.getState().logout()
          } catch (err) {
            console.error('Error logging out:', err)
          }
          toast.error('Your session has expired. Please sign in again.')
          navigate('/auth')
          return
        }
      }
      const rawMessage = String(err?.message || '')
      const lower = rawMessage.toLowerCase()
      if (err?.name === 'AbortError' || lower.includes('aborted')) {
        toast.error('Request was interrupted. Please check your connection and try again.')
      } else {
        toast.error(rawMessage || 'Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAlertAdminSubmit = async () => {
    if (alertSubmitting) return
    const trimmedDetails = alertDetails.trim()
    const emailToSend = alertEmail.trim() || email.trim()
    if (!emailToSend) {
      toast.error('Please enter your email so we can contact you')
      return
    }
    if (!trimmedDetails) {
      toast.error('Please describe the issue you are having')
      return
    }
    setAlertSubmitting(true)
    try {
      const { error } = await supabase.from('critical_alerts').insert({
        message: `AUTH LOGIN ISSUE from ${emailToSend}: ${trimmedDetails}`,
        severity: 'critical',
        resolved: false,
        source: 'auth_login_issue'
      })
      if (error) {
        throw error
      }
      toast.success('Alert sent. Please check your email within 5 minutes.')
      setShowAlertAdmin(false)
      setAlertDetails('')
    } catch (err: any) {
      console.error('Failed to send login alert:', err)
      toast.error(err?.message || 'Failed to send alert, please try again')
    } finally {
      setAlertSubmitting(false)
    }
  }

  useEffect(() => {
    if (user && profile) {
      navigate(landingForProfile(profile), { replace: true })
    }
  }, [user, profile, navigate])

  return (
    <>
    <div className={embedded ? "w-full text-white font-sans" : `auth-container flex items-center justify-center min-h-screen ${MaiTrollTheme.backgrounds.primary} text-white overflow-x-hidden relative font-sans`}>
      {/* Animated Background Gradients */}
      {!embedded && (
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
      </div>
      )}

      {/* Floating Particles */}
      {!embedded && (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
      )}

      {/* Auth Card */}
      <div className={embedded ? "w-full p-6" : "relative z-10 w-full max-w-md px-4 py-8"}>
        <div className={embedded ? "" : "backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-8"}>
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Mai Troll
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-semibold tracking-widest">
              {isLogin ? 'Welcome Back' : 'Join the City'}
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="grid grid-cols-2 w-full max-w-xs bg-slate-800/50 border border-white/5 rounded-xl p-1 gap-1">
              <button
                onClick={() => setIsLogin(true)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  isLogin 
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  !isLogin 
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5 mb-6">
            {!isLogin && dailyLimitReached ? (
              <div className="text-center p-6 bg-slate-800/50 rounded-xl border border-purple-500/30 animate-in fade-in zoom-in duration-300">
                <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {activeEvent ? 'Event Sign-Up Cap Reached' : 'Daily Sign-Up Limit Reached'}
                </h3>
                <p className="text-slate-300 mb-6 text-sm">
                  {activeEvent 
                    ? `Early access for "${activeEvent.event_name}" is limited to ${activeEvent.signup_cap} participants. We've reached the limit for early access! You can join the waitlist or wait for the full public launch in 48 hours.` 
                    : "We limit new registrations to 100 users per day to ensure the best experience for our citizens."}
                </p>
                
                {inQueue ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                    <p className="text-green-400 font-bold mb-1">You&apos;re in the queue!</p>
                    <p className="text-xs text-green-400/80">We&apos;ll notify you when a spot opens up.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 rounded-xl p-4 mb-6 border border-white/5 text-left">
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-3 text-center">Join the Waitlist</p>
                    <div className="space-y-3">
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input 
                          type="email" 
                          placeholder="Email" 
                          value={queueEmail}
                          onChange={(e) => setQueueEmail(e.target.value)}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50"
                          required
                        />
                      </div>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="Username" 
                          value={queueUsername}
                          onChange={(e) => setQueueUsername(e.target.value)}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50"
                          required
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleJoinQueue}
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                      >
                        {loading ? 'Joining...' : 'Join Queue'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-950/50 rounded-lg p-4 mb-6 border border-white/5">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">
                    {activeEvent ? 'Registration opens in' : 'Next Registration Window'}
                  </p>
                  <div className="text-3xl font-mono text-cyan-400 font-bold tracking-wider">
                    {timeLeft}
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  Already have an account? <button type="button" onClick={() => setIsLogin(true)} className="text-purple-400 hover:text-purple-300 hover:underline">Sign in here</button>
                </p>
              </div>
            ) : (
               <>
                 {/* Email Input (hidden for organization) */}
                 {selectedRole !== 'organization' && (
                   <div className="relative group">
                     <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                     <input
                       type="email"
                       id="email"
                       name="email"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                       placeholder="Email address"
                       autoComplete="email"
                       required
                     />
                   </div>
                 )}

                 {/* Password Input (hidden for organization) */}
                 {selectedRole !== 'organization' && (
                   <div className="relative group">
                     <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                     <input
                       type={showPassword ? "text" : "password"}
                       id="password"
                       name="password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                       placeholder="Password"
                       autoComplete={isLogin ? 'current-password' : 'new-password'}
                       required
                       minLength={6}
                     />
                     <button
                       type="button"
                       onClick={() => setShowPassword(!showPassword)}
                       className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                     >
                       {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                   </div>
                 )}

                 {/* Username Input (Sign Up Only, hidden for organization) */}
                 {!isLogin && selectedRole !== 'organization' && (
                   <div className="relative group">
                     <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                     <input
                       type="text"
                       id="username"
                       name="username"
                       value={username}
                       onChange={(e) => setUsername(e.target.value)}
                       className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all focus:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                       placeholder="Username"
                       autoComplete="username"
                       required
                     />
                   </div>
                 )}

                       <div className="text-sm text-slate-400 mb-4">
                         Accounts are created as a User by default. Role approval happens later via application.
                       </div>

                     {/* Terms Acceptance (Sign Up Only) */}
                    {!isLogin && (
                      <div className="flex items-start gap-3 px-1">
                      <div className="relative flex items-center pt-1">
                        <input
                          type="checkbox"
                          id="accept-terms"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="peer h-5 w-5 appearance-none rounded border border-purple-500/30 bg-slate-800/50 checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all cursor-pointer"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <label htmlFor="accept-terms" className="text-sm text-slate-300 cursor-pointer select-none">
                        I accept the{' '}
                        <Link to="/legal/terms" target="_blank" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Terms and Agreements
                        </Link>
                        {' '}and acknowledge the{' '}
                        <Link to="/legal/privacy" target="_blank" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Privacy Policy
                        </Link>.
                       </label>
                     </div>
                    )}

                 {/* Celeb Signup Checkbox (Sign Up Only) */}
                 {!isLogin && (
                   <>
                     <div className="flex items-start gap-3 px-1">
                       <div className="relative flex items-center pt-1">
                         <input
                           type="checkbox"
                           id="celeb-signup"
                           checked={isCelebSignup}
                           onChange={(e) => {
                             setIsCelebSignup(e.target.checked)
                             setShowCelebFields(e.target.checked)
                           }}
                           className="peer h-5 w-5 appearance-none rounded border border-purple-500/30 bg-slate-800/50 checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all cursor-pointer"
                         />
                         <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         </div>
                       </div>
                       <label htmlFor="celeb-signup" className="text-sm text-slate-300 cursor-pointer select-none">
                         Sign up as a{' '}
                         <span className="text-yellow-400 font-semibold">Celebrity</span>
                         {' '} — Apply for Celeb Stream status (requires review)
                       </label>
                     </div>

                     {showCelebFields && (
                       <>
                         <div className="relative group">
                           <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                           <input
                             type="text"
                             id="celeb-full-name"
                             name="celeb-full-name"
                             value={celebFullName}
                             onChange={(e) => setCelebFullName(e.target.value)}
                             className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all"
                             placeholder="Full legal name"
                             required={isCelebSignup}
                           />
                         </div>

                         <div className="relative group">
                           <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                           <input
                             type="tel"
                             id="celeb-phone"
                             name="celeb-phone"
                             value={celebPhone}
                             onChange={(e) => setCelebPhone(e.target.value)}
                             className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all"
                             placeholder="Phone number"
                             required={isCelebSignup}
                           />
                         </div>

                         <div className="relative group">
                           <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400/60 group-focus-within:text-cyan-400 transition-colors" />
                           <input
                             type="url"
                             id="celeb-social-url"
                             name="celeb-social-url"
                             placeholder="Social media URL (e.g. https://instagram.com/yourname)"
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                 e.preventDefault()
                                 const val = (e.target as HTMLInputElement).value.trim()
                                 if (val) {
                                   setCelebSocialLinks([...celebSocialLinks, { platform: 'social', url: val }])
                                   ;(e.target as HTMLInputElement).value = ''
                                 }
                               }
                             }}
                             className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all"
                           />
                         </div>

                         {celebSocialLinks.length > 0 && (
                           <div className="flex flex-wrap gap-2">
                             {celebSocialLinks.map((link, idx) => (
                               <div key={idx} className="bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-cyan-400 truncate max-w-full">
                                 {link.url}
                               </div>
                             ))}
                           </div>
                         )}

                         <div className="text-xs text-slate-500">
                           Press Enter after entering a social media URL to add it. Your application will be reviewed by our team.
                         </div>
                       </>
                     )}
                   </>
                 )}
                 {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2"></div>
                      Processing...
                    </span>
                  ) : (
                    isLogin ? 'Sign In' : 'Sign Up'
                  )}
                </button>
              </>
            )}
          </form>

        {/* Helper Links */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <Link
              to={email ? `/reset-password?email=${encodeURIComponent(email)}` : "/reset-password"}
              className="text-cyan-400/80 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowAlertAdmin(true)
                if (!alertEmail && email) {
                  setAlertEmail(email)
                }
              }}
              className="text-cyan-400/80 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              Need help?
            </button>
          </div>
          </div>

          {/* Alert Admin Modal */}
      {showAlertAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
          <div className="w-full max-w-md rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Need help?</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertAdmin(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Tell our team about the issue and we&apos;ll help you fix it.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">Describe the issue</label>
                <textarea
                  value={alertDetails}
                  onChange={(e) => setAlertDetails(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/40 focus:bg-slate-800/70 transition-all resize-none h-24"
                  placeholder="Example: Password reset not working..."
                />
              </div>
              <button
                type="button"
                onClick={handleAlertAdminSubmit}
                disabled={alertSubmitting}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alertSubmitting ? 'Sending...' : 'Send help request'}
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>

    <NavBubble />

    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes float-particle {
        0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
        50% { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
      }
    ` }} />
  </>
  );
}

export default Auth;
