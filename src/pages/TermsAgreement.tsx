import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, XCircle, FileText } from 'lucide-react'
import { MaiTrollTheme } from '../styles/trollCityTheme'
import { flushSync } from 'react-dom'

export default function TermsAgreement() {
  const { profile, session, setProfile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)

  useEffect(() => {
    if (session?.user) {
      // If the profile already has terms accepted, redirect the user away from this page immediately
      if (profile?.terms_accepted) {
        const targetPath = (profile?.role === 'admin') ? '/admin' : '/home'
        navigate(targetPath, { replace: true })
        return
      }

      setAuthChecked(true)
      return
    }

    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        if (!data?.session?.user) {
          setAuthRequired(true)
          navigate('/auth', { replace: true })
          return
        }
        setAuthChecked(true)
      })
      .catch((error) => {
        if (!mounted) return
        console.error('[Terms] auth check failed', error)
        setAuthRequired(true)
        navigate('/auth', { replace: true })
      })

    return () => {
      mounted = false
    }
  }, [navigate, session, profile])

  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-[100000] bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-300">Checking authentication...</p>
        </div>
      </div>
    )
  }

   const handleAgree = async () => {
     if (!authChecked || authRequired) {
       toast.error('You need to be logged in to accept the terms.')
       return
     }

     setSubmitting(true)

     try {
       const {
         data: { session: liveSession },
         error: sessionError,
       } = await supabase.auth.getSession()

       if (sessionError) {
         throw new Error(`Session error: ${sessionError.message}`)
       }

       const token = liveSession?.access_token || session?.access_token
       const sessionUserId = liveSession?.user?.id || session?.user?.id

       if (!token || !sessionUserId) {
         throw new Error('Missing authentication session. Please sign in again.')
       }

       const supabaseUrl =
         import.meta.env.VITE_SUPABASE_URL || 'https://gejtbllazzighxwxudyu.supabase.co'

       const functionUrl = new URL('/functions/v1/user-agreements', supabaseUrl)
       functionUrl.searchParams.set('action', 'accept_agreement')

       const response = await fetch(functionUrl.toString(), {
         method: 'POST',
         headers: {
           Authorization: `Bearer ${token}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           agreement_version: '1.0',
         }),
       })

       const responseText = await response.text()
       let result: any = null
       try {
         result = responseText ? JSON.parse(responseText) : null
       } catch {
         result = null
       }

       if (!response.ok || !result?.success) {
         throw new Error(
           JSON.stringify({
             status: response.status,
             statusText: response.statusText,
             response: result || responseText,
           })
         )
       }

       // Edge Function returns the updated profile directly
       const updatedProfile = result?.profile

       if (updatedProfile && setProfile) {
         // Ensure agreement flags are explicitly true (source-of-truth safety)
         flushSync(() => {
           setProfile({
             ...updatedProfile,
             terms_accepted: true,
             court_recording_consent: true,
           } as any)
         })
       } else {
         // Fallback: if Edge Function didn't return profile, use optimistic update and refresh
         console.warn('[Terms] No profile returned from Edge Function, using optimistic update')
         if (setProfile) {
           flushSync(() => {
             setProfile({
               ...profile,
               terms_accepted: true,
               court_recording_consent: true,
             } as any)
           })
         }
       }

       toast.success('Welcome to MaiMaiTroll!')

       const targetPath = (updatedProfile?.role || profile?.role) === 'admin' ? '/admin' : '/home'

       navigate(targetPath, {
         replace: true,
       })
     } catch (err: any) {
       console.error('[Terms] Agreement error:', {
         message: err?.message,
         error: err,
       })

       toast.error(err?.message || 'Failed to save agreement')
     } finally {
       setSubmitting(false)
     }
   }

  const terms = {
    pros: [
      { icon: '💰', title: 'Earn Real Money', desc: 'Cash out your earned coins through streaming and engagement' },
      { icon: '🎮', title: 'Interactive Features', desc: 'Engage with gifts, family wars, and more' },
      { icon: '🏆', title: 'Level Up System', desc: 'Progress through 100 levels with custom tier names and rewards' },
      { icon: '👑', title: 'Exclusive Badges', desc: 'Earn OG badges, admin badges, and family crowns' },
      { icon: '🎯', title: 'Fair Play', desc: 'Transparent rules and moderation for all users' },
      { icon: '🌟', title: 'Community', desc: 'Join troll families and compete in weekly wars' },
    ],
    rules: [
      { icon: '🚫', title: 'Zero Tolerance Policy', desc: 'Harassment, hate speech, or illegal content results in immediate permanent ban' },
      { icon: '⚠️', title: 'Account Responsibility', desc: 'You are responsible for all activity on your account. Secure your credentials.' },
      { icon: '💸', title: 'No Chargebacks', desc: 'All coin purchases are final. Chargebacks will result in permanent ban.' },
      { icon: '🔒', title: 'Account Reset on Ban', desc: 'Banned users lose ALL progress: coins, XP, level, badges reset to 0' },
      { icon: '📊', title: 'Free Marketplace', desc: 'No fees to run a shop. Sellers keep 100% of earnings from item sales.' },
      { icon: '🎥', title: 'Content Ownership', desc: 'By streaming, you grant Mai Troll rights to use your content for promotion' },
      { icon: '⚖️', title: 'Dispute Resolution', desc: 'All disputes must go through our support ticket system first' },
      { icon: '🔄', title: 'Terms Can Change', desc: 'We reserve the right to update these terms. Continued use means acceptance.' },
    ]
  }

  return (
    <div className={`fixed inset-0 z-[100000] overflow-y-auto ${MaiTrollTheme.backgrounds.app} text-white pointer-events-auto`}>
      <div className="max-w-5xl mx-auto p-6 pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          <FileText className="w-16 h-16 mx-auto mb-4 text-troll-neon-blue" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent mb-2">
            Welcome to MaiMaiTroll
          </h1>
          <p className={`${MaiTrollTheme.text.muted}`}>Please read and agree to our platform terms before continuing</p>
        </div>

        {/* Pros Section */}
        <div className={`${MaiTrollTheme.backgrounds.card} rounded-xl border border-green-500/30 p-6 mb-6`}>
          <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Platform Benefits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {terms.pros.map((pro, i) => (
              <div key={i} className={`flex gap-3 p-4 ${MaiTrollTheme.backgrounds.input} rounded-lg ${MaiTrollTheme.borders.glass}`}>
                <span className="text-3xl">{pro.icon}</span>
                <div>
                  <h3 className="font-semibold text-green-300">{pro.title}</h3>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>{pro.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Section */}
        <div className={`${MaiTrollTheme.backgrounds.card} rounded-xl border border-red-500/30 p-6 mb-6`}>
          <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            Platform Rules & Consequences
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {terms.rules.map((rule, i) => (
              <div key={i} className={`flex gap-3 p-4 ${MaiTrollTheme.backgrounds.input} rounded-lg ${MaiTrollTheme.borders.glass}`}>
                <span className="text-3xl">{rule.icon}</span>
                <div>
                  <h3 className="font-semibold text-red-300">{rule.title}</h3>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Highlight */}
        <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border-2 border-red-500 rounded-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-red-300 mb-2">⚠️ CRITICAL: Ban Policy</h3>
          <p className="text-white">
            When you are banned, your account is <strong>completely reset</strong>. You will lose:
          </p>
          <ul className="list-disc list-inside mt-2 text-gray-200 space-y-1">
            <li>All coins</li>
            <li>All XP and levels (back to Level 1)</li>
            <li>All badges and achievements</li>
            <li>All earnings history</li>
          </ul>
          <p className="mt-3 text-yellow-300 font-semibold">
            Follow the rules. Play fair. Build your legacy.
          </p>
        </div>

        {/* Agreement Text */}
        <div className={`relative z-[9999] ${MaiTrollTheme.backgrounds.card} rounded-xl ${MaiTrollTheme.borders.glass} p-6 mb-6 space-y-4 pointer-events-auto`} style={{ zIndex: 99999 }}>
          <div className={`space-y-4 ${MaiTrollTheme.text.muted}`}>
            <p className="font-semibold text-white">By clicking &quot;Agree & Continue&quot; below, you acknowledge and agree to the following:</p>
            
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                I have read and agree to the <Link to="/legal/terms" target="_blank" className="text-troll-purple underline hover:text-troll-neon-blue">Terms of Service</Link> and <Link to="/legal/privacy" target="_blank" className="text-troll-purple underline hover:text-troll-neon-blue">Privacy Policy</Link>.
              </li>
              <li>
                I consent to the collection and processing of my personal data as described in the Privacy Policy.
              </li>
              <li>
                I agree to the <Link to="/legal/refunds" target="_blank" className="text-troll-purple underline hover:text-troll-neon-blue">Payment Terms</Link> and understand that all purchases are final and non-refundable.
              </li>
              <li>
                I have read and agree to the <Link to="/legal/creator-earnings" target="_blank" className="text-troll-purple underline hover:text-troll-neon-blue">Creator Earning / Cashout Agreement</Link>, including 1099 tax reporting requirements.
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={async () => {
              try {
                try {
                  const { data: sessionData } = await supabase.auth.getSession()
                  const hasSession = !!sessionData?.session
                  if (hasSession) {
                    const { error } = await supabase.auth.signOut()
                    if (error) console.warn('supabase.signOut returned error:', error)
                  } else {
                    console.debug('No active session; skipping supabase.auth.signOut()')
                  }
                } catch (innerErr) {
                  console.warn('Error during sign-out (ignored):', innerErr)
                }
              } finally {
                navigate('/auth')
              }
            }}
            className={`px-8 py-3 rounded-lg ${MaiTrollTheme.components.buttonSecondary}`}
          >
            Decline & Sign Out
          </button>
          <button
            onClick={handleAgree}
            disabled={submitting}
            className={`px-8 py-3 rounded-lg ${MaiTrollTheme.components.buttonPrimary}
                     disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition font-bold`}
          >
            {submitting ? 'Processing...' : 'Agree & Continue'}
          </button>
        </div>

        {/* Footer */}
        <p className={`text-center ${MaiTrollTheme.text.muted} text-sm mt-8`}>
          Questions? Contact support at Mai Troll2025@gmail.com
        </p>
      </div>
    </div>
  )
}