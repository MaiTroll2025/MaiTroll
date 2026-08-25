import React, { useEffect, useState } from 'react'
import { AuthApiError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { post, API_ENDPOINTS } from '../../lib/api'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

export default function PhoneAuth() {
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const executeLogin = async (
    loginEmail: string,
    loginPassword: string,
  ) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        throw new Error(
          'Login failed. Please try again or contact support if the issue persists.',
        )
      }

      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password.')
      }

      throw error
    }

    if (data.user && data.session) {
      try {
        sessionStorage.setItem('tc_just_logged_in', '1')
      } catch {
        /* ignore */
      }
    } else if (data.user && !data.session) {
      throw new Error(
        'Login failed. Please try again or contact support if the issue persists.',
      )
    } else {
      throw new Error('Login failed - no user data returned')
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) return

    setLoading(true)

    try {
      if (isLogin) {
        await executeLogin(email.trim(), password)
      } else {
        if (!username.trim()) {
          toast.error('Username is required for sign up')
          setLoading(false)
          return
        }

        if (!acceptedTerms) {
          toast.error(
            'You must accept the terms and agreements to sign up',
          )
          setLoading(false)
          return
        }

        const {
          success,
          error: signUpError,
        } = await post(API_ENDPOINTS.auth.signup, {
          email: email.trim(),
          password,
          username: username.trim(),
          role: 'user',
          data: {
            terms_accepted: true,
            accepted_at: new Date().toISOString(),
          },
        })

        if (!success || signUpError) {
          toast.error(signUpError || 'Signup failed')
          setLoading(false)
          return
        }

        toast.success('Account created! Logging you in...')

        await executeLogin(email.trim(), password)
      }
    } catch (err: any) {
      console.error('[PhoneAuth] auth error:', err)

      if (err instanceof AuthApiError) {
        const lower = String(err.message || '').toLowerCase()

        if (
          lower.includes('invalid refresh token') ||
          lower.includes('refresh token not found')
        ) {
          try {
            await supabase.auth.signOut()
          } catch {
            /* ignore */
          }

          useAuthStore.getState().logout()

          toast.error(
            'Your session has expired. Please sign in again.',
          )

          return
        }
      }

      const rawMessage = String(err?.message || '')
      const lower = rawMessage.toLowerCase()

      if (
        err?.name === 'AbortError' ||
        lower.includes('aborted')
      ) {
        toast.error(
          'Request was interrupted. Please check your connection and try again.',
        )
      } else {
        toast.error(rawMessage || 'Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020208] text-white">

      {/* ------------------------------------------------------------------ */}
      {/* Ambient background                                                  */}
      {/* ------------------------------------------------------------------ */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#00BFFF]/20 blur-[120px]" />

        <div className="absolute -right-40 top-[15%] h-[480px] w-[480px] rounded-full bg-[#BF00FF]/20 blur-[130px]" />

        <div className="absolute bottom-[-220px] left-[15%] h-[500px] w-[500px] rounded-full bg-[#00BFFF]/10 blur-[140px]" />

        <div
          className="
            absolute
            inset-0
            opacity-[0.045]
            [background-image:linear-gradient(rgba(0,191,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(191,0,255,0.8)_1px,transparent_1px)]
            [background-size:34px_34px]
            [mask-image:linear-gradient(to_bottom,black,transparent_80%)]
          "
        />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00BFFF] to-transparent shadow-[0_0_20px_#00BFFF]" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main                                                                 */}
      {/* ------------------------------------------------------------------ */}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8">

        {/* ---------------------------------------------------------------- */}
        {/* Brand                                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-7 text-center">

          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">

            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-25 blur-2xl" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20 shadow-[0_0_35px_rgba(0,191,255,0.2)]">
              <Sparkles
                size={27}
                className="text-[#00BFFF] drop-shadow-[0_0_12px_#00BFFF]"
              />
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-[-0.05em]">
            <span className="bg-gradient-to-r from-[#00BFFF] via-white to-[#BF00FF] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,191,255,0.25)]">
              MAiTROLL
            </span>
          </h1>

          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#00BFFF] opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]" />
            </span>

            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-100/50">
              Live Network
            </span>
          </div>

          <p className="mx-auto mt-4 max-w-[310px] text-sm leading-5 text-zinc-400">
            {isLogin
              ? 'Welcome back. Your network is waiting.'
              : 'Join the network. Create, connect, compete and get paid.'}
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Why join / Daily Pay                                              */}
        {/* ---------------------------------------------------------------- */}

        {!isLogin && (
          <div className="mb-5 overflow-hidden rounded-3xl border border-[#00BFFF]/15 bg-gradient-to-br from-[#00BFFF]/10 via-[#080812]/90 to-[#BF00FF]/10 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">

            <div className="mb-4 flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20">
                <Wallet
                  size={18}
                  className="text-[#00BFFF] drop-shadow-[0_0_7px_#00BFFF]"
                />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white">
                  Why Join MaiTroll?
                </p>

                <p className="mt-0.5 text-[9px] font-bold text-zinc-500">
                  More than a social network.
                </p>
              </div>
            </div>

            <div className="space-y-3">

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                  <Wallet
                    size={12}
                    className="text-emerald-300"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-black text-white">
                    Daily Pay Opportunities
                  </p>

                  <p className="mt-0.5 text-[9px] leading-4 text-zinc-500">
                    Eligible creators can earn money from qualifying
                    activity, broadcasts, battles and other platform
                    opportunities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#BF00FF]/10">
                  <Zap
                    size={12}
                    className="text-[#BF00FF]"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-black text-white">
                    Go Live & Build Your Audience
                  </p>

                  <p className="mt-0.5 text-[9px] leading-4 text-zinc-500">
                    Broadcast, battle, interact with viewers and grow
                    your presence inside the MaiTroll network.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00BFFF]/10">
                  <Users
                    size={12}
                    className="text-[#00BFFF]"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-black text-white">
                    Join the Community
                  </p>

                  <p className="mt-0.5 text-[9px] leading-4 text-zinc-500">
                    Connect with creators, viewers, competitors and
                    communities across the platform.
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-4 rounded-xl border border-yellow-400/10 bg-yellow-400/[0.04] px-3 py-2">
              <p className="text-[8px] font-bold leading-4 text-yellow-200/60">
                Earnings and Daily Pay opportunities are subject to
                eligibility, platform rules, applicable programs and
                payout requirements. Creating an account does not
                guarantee earnings.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Auth Card                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#070711]/90 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">

          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00BFFF] to-transparent opacity-80" />

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-black/40 p-1">

            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`relative rounded-xl py-2.5 text-[11px] font-black transition-all ${
                isLogin
                  ? 'bg-gradient-to-r from-[#00BFFF]/20 to-[#00BFFF]/10 text-white shadow-[0_0_18px_rgba(0,191,255,0.1)]'
                  : 'text-zinc-500'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`relative rounded-xl py-2.5 text-[11px] font-black transition-all ${
                !isLogin
                  ? 'bg-gradient-to-r from-[#BF00FF]/20 to-[#00BFFF]/10 text-white shadow-[0_0_18px_rgba(191,0,255,0.1)]'
                  : 'text-zinc-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mb-4">

            <h2 className="text-lg font-black text-white">
              {isLogin
                ? 'Welcome Back'
                : 'Create Your MaiTroll Account'}
            </h2>

            <p className="mt-1 text-[9px] font-bold text-zinc-600">
              {isLogin
                ? 'Sign in to continue to your network.'
                : 'Your username becomes your identity on MaiTroll.'}
            </p>
          </div>

          <form
            onSubmit={handleEmailAuth}
            className="space-y-3"
          >

            {/* Username */}
            {!isLogin && (
              <div className="relative">

                <User
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BF00FF]"
                />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/40 pl-11 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-zinc-700 focus:border-[#BF00FF]/50 focus:bg-[#BF00FF]/[0.04] focus:shadow-[0_0_25px_rgba(191,0,255,0.08)]"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">

              <Mail
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00BFFF]"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/40 pl-11 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-zinc-700 focus:border-[#00BFFF]/50 focus:bg-[#00BFFF]/[0.04] focus:shadow-[0_0_25px_rgba(0,191,255,0.08)]"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">

              <Lock
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BF00FF]"
              />

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={
                  isLogin
                    ? 'current-password'
                    : 'new-password'
                }
                className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/40 pl-11 pr-12 text-sm font-medium text-white outline-none transition placeholder:text-zinc-700 focus:border-[#BF00FF]/50 focus:bg-[#BF00FF]/[0.04] focus:shadow-[0_0_25px_rgba(191,0,255,0.08)]"
                required
                minLength={6}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-600 transition hover:text-white"
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
            </div>

            {/* Terms */}
            {!isLogin && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">

                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) =>
                    setAcceptedTerms(e.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#00BFFF]"
                />

                <span className="text-[9px] leading-4 text-zinc-500">
                  I accept the Terms and Agreements and acknowledge
                  the Privacy Policy.
                </span>
              </label>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="
                group
                relative
                flex
                h-13
                w-full
                items-center
                justify-center
                overflow-hidden
                rounded-2xl
                bg-gradient-to-r
                from-[#00BFFF]
                via-[#168cff]
                to-[#BF00FF]
                text-sm
                font-black
                text-white
                shadow-[0_0_30px_rgba(0,191,255,0.18)]
                transition-all
                active:scale-[0.98]
                disabled:opacity-50
              "
            >

              <span className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />

              <span className="relative flex items-center gap-2">

                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    {isLogin
                      ? 'Enter MaiTroll'
                      : 'Create My Account'}

                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </>
                )}

              </span>
            </button>
          </form>

          {/* Benefits on login */}
          {isLogin && (
            <div className="mt-5 grid grid-cols-3 gap-2">

              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-center">
                <Zap
                  size={13}
                  className="mx-auto text-[#00BFFF]"
                />
                <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-zinc-600">
                  Go Live
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-center">
                <Wallet
                  size={13}
                  className="mx-auto text-emerald-300"
                />
                <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-zinc-600">
                  Earn
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-center">
                <Users
                  size={13}
                  className="mx-auto text-[#BF00FF]"
                />
                <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-zinc-600">
                  Connect
                </p>
              </div>

            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Trust / benefits                                                 */}
        {/* ---------------------------------------------------------------- */}

        {!isLogin && (
          <div className="mt-5 space-y-2">

            <div className="flex items-center justify-center gap-2 text-[8px] font-bold text-zinc-600">
              <Check size={11} className="text-emerald-400" />
              Free to join
            </div>

            <div className="flex items-center justify-center gap-2 text-[8px] font-bold text-zinc-600">
              <Check size={11} className="text-emerald-400" />
              Create your creator identity
            </div>

            <div className="flex items-center justify-center gap-2 text-[8px] font-bold text-zinc-600">
              <Check size={11} className="text-emerald-400" />
              Explore earning opportunities
            </div>

          </div>
        )}

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mx-auto mt-6 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-600 transition hover:text-zinc-300"
        >
          ← Back to MaiTroll
        </button>

        <p className="mt-5 text-center text-[8px] font-bold text-zinc-800">
          MAiTROLL.COM • LIVE SOCIAL ENTERTAINMENT NETWORK
        </p>
      </div>

      <style>{`
        @keyframes auth-energy {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }

          20% {
            opacity: 1;
          }

          70% {
            opacity: 1;
          }

          100% {
            transform: translateX(220%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}