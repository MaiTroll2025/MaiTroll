import React, { useEffect, useMemo, useState } from 'react'
import { Moon, UserPlus, ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getChicagoTime,
  getSecondsUntilOpen,
} from '@/lib/maitrollOperatingHours'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { setSleepUnlocked } from '@/lib/appSleep'

interface SleepingTrollBedroomProps {
  countdownToOpen?: string
  onWakeUp?: () => void
  isStaff?: boolean
}

type Question = {
  prompt: string
  answer: string
}

function generateQuestion(): Question {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  const ops: Array<{ label: string; calc: () => number }> = [
    { label: '+', calc: () => a + b },
    { label: '-', calc: () => a - b },
    { label: '×', calc: () => a * b },
  ]
  const op = ops[Math.floor(Math.random() * ops.length)]
  const answer = String(op.calc())
  return { prompt: `${a} ${op.label} ${b} = ?`, answer }
}

export function SleepingTrollBedroom({
  countdownToOpen,
  onWakeUp,
  isStaff = false,
}: SleepingTrollBedroomProps) {
  const navigate = useNavigate()
  const [secondsUntilOpen, setSecondsUntilOpen] = useState<number | null>(null)
  const [showSignup, setShowSignup] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [question, setQuestion] = useState<Question>(() => generateQuestion())
  const [puzzleAnswer, setPuzzleAnswer] = useState('')
  const [puzzleBusy, setPuzzleBusy] = useState(false)

  const particles = useMemo(
    () => [
      { left: '8%', top: '22%', delay: '0s', duration: '4s' },
      { left: '24%', top: '70%', delay: '1s', duration: '5s' },
      { left: '48%', top: '18%', delay: '2s', duration: '6s' },
      { left: '72%', top: '62%', delay: '0.5s', duration: '4.5s' },
      { left: '91%', top: '30%', delay: '1.5s', duration: '5.5s' },
      { left: '64%', top: '84%', delay: '2.5s', duration: '6.5s' },
      { left: '14%', top: '44%', delay: '3s', duration: '5s' },
      { left: '83%', top: '78%', delay: '0.75s', duration: '4s' },
    ],
    [],
  )

  useEffect(() => {
    if (isStaff) return

    let mounted = true
    let wakeTriggered = false

    const updateCountdown = () => {
      if (!mounted) return

      const chicagoNow = getChicagoTime()
      const remaining = Math.max(0, getSecondsUntilOpen(chicagoNow))

      setSecondsUntilOpen(remaining)

      if (remaining <= 0 && !wakeTriggered) {
        wakeTriggered = true
        onWakeUp?.()
      }
    }

    updateCountdown()

    const interval = window.setInterval(updateCountdown, 1000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [isStaff, onWakeUp])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptedTerms) {
      toast.error('Please accept the terms and conditions')
      return
    }
    if (!signupEmail || !signupPassword || !signupUsername) {
      toast.error('Please fill in all fields')
      return
    }
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSignupLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            username: signupUsername,
          },
        },
      })
      if (error) throw error
      toast.success('Account created! Check your email to confirm.')
      setSignupEmail('')
      setSignupPassword('')
      setSignupUsername('')
      setAcceptedTerms(false)
      setShowSignup(false)
    } catch (err: any) {
      toast.error(err.message || 'Signup failed')
    } finally {
      setSignupLoading(false)
    }
  }

  const handlePuzzleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (puzzleBusy) return
    setPuzzleBusy(true)

    try {
      const solved = puzzleAnswer.trim() === question.answer
      if (!solved) {
        toast.error('Not quite — try again!')
        setQuestion(generateQuestion())
        setPuzzleAnswer('')
        return
      }

      setSleepUnlocked(question.answer)
      toast.success('Unlocked!')
      onWakeUp?.()
      navigate('/', { replace: true })
    } finally {
      setPuzzleBusy(false)
    }
  }

  if (isStaff) {
    return null
  }

  if (secondsUntilOpen === null) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050816]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#00BFFF]/20 border-t-[#00BFFF]" />
          <p className="text-sm text-white/60">
            Checking MaiTroll operating hours...
          </p>
        </div>
      </div>
    )
  }

  const hours = Math.floor(secondsUntilOpen / 3600)
  const minutes = Math.floor((secondsUntilOpen % 3600) / 60)
  const seconds = secondsUntilOpen % 60

  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-[9999] min-h-screen w-full overflow-hidden bg-[#050816] text-white">
      <style>{`
        @keyframes troll-breathe {
          0%, 100% {
            transform: translateY(0) scaleY(1);
          }
          50% {
            transform: translateY(2px) scaleY(1.015);
          }
        }

        @keyframes zzz-float {
          0% {
            opacity: 0;
            transform: translate(0, 12px) scale(0.7);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(35px, -75px) scale(1.15);
          }
        }

        @keyframes neon-pulse {
          0%, 100% {
            opacity: 0.45;
            box-shadow: 0 0 10px rgba(0,191,255,0.25);
          }
          50% {
            opacity: 1;
            box-shadow:
              0 0 20px rgba(0,191,255,0.55),
              0 0 40px rgba(191,0,255,0.25);
          }
        }

        @keyframes particle-float {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-18px);
            opacity: 0.8;
          }
        }

        @keyframes moon-glow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(191,0,255,0.4));
          }
          50% {
            filter: drop-shadow(0 0 22px rgba(191,0,255,0.8));
          }
        }

        @keyframes bed-glow {
          0%, 100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }

        .troll-breathe {
          animation: troll-breathe 4s ease-in-out infinite;
          transform-origin: center bottom;
        }

        .zzz-float {
          animation: zzz-float 4s ease-in-out infinite;
        }

        .neon-pulse {
          animation: neon-pulse 3s ease-in-out infinite;
        }

        .particle-float {
          animation: particle-float 5s ease-in-out infinite;
        }

        .moon-glow {
          animation: moon-glow 4s ease-in-out infinite;
        }

        .bed-glow {
          animation: bed-glow 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-b from-[#090d2a] via-[#101a3b] to-[#050816]" />

      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,191,255,0.18) 1px, transparent 1px),
              linear-gradient(90deg, rgba(191,0,255,0.12) 1px, transparent 1px)
            `,
            backgroundSize: '70px 70px',
            transform: 'perspective(500px) rotateX(58deg) scale(1.8)',
            transformOrigin: 'bottom center',
          }}
        />
      </div>

      <div className="absolute left-1/2 top-[-120px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#BF00FF]/10 blur-[100px]" />
      <div className="absolute bottom-[-150px] left-[-100px] h-[400px] w-[400px] rounded-full bg-[#00BFFF]/10 blur-[100px]" />
      <div className="absolute bottom-[-150px] right-[-100px] h-[400px] w-[400px] rounded-full bg-[#BF00FF]/10 blur-[100px]" />

      {particles.map((particle, index) => (
        <div
          key={index}
          className="particle-float absolute h-1 w-1 rounded-full bg-[#00BFFF]"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            boxShadow: '0 0 8px rgba(0,191,255,0.8)',
          }}
        />
      ))}

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="absolute right-6 top-6 opacity-80">
          <Moon
            className="moon-glow h-10 w-10 text-[#BF00FF]"
            strokeWidth={1.5}
          />
        </div>

        <div className="mb-5 text-center">
          <div className="mb-2 text-3xl font-black tracking-tight sm:text-4xl">
            <span className="text-[#00BFFF]">Mai</span>
            <span className="text-[#BF00FF]">Troll</span>
          </div>

          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
            The trolls have gone to bed
          </div>
        </div>

        <div className="relative mb-8 h-[290px] w-full max-w-[430px]">
          <div className="absolute bottom-0 left-1/2 h-16 w-[90%] -translate-x-1/2 rounded-[50%] bg-[#00BFFF]/10 blur-2xl" />

          <div className="absolute bottom-8 left-1/2 h-[150px] w-[88%] -translate-x-1/2 rounded-[40px] border border-[#00BFFF]/30 bg-gradient-to-b from-[#162657] to-[#090f25] shadow-[0_0_35px_rgba(0,191,255,0.18)]">
            <div className="bed-glow absolute inset-x-4 bottom-3 h-2 rounded-full bg-gradient-to-r from-[#00BFFF] via-[#BF00FF] to-[#00BFFF] blur-sm" />

            <div className="absolute left-5 top-[-12px] h-20 w-32 rotate-[-3deg] rounded-[35px] border border-white/10 bg-gradient-to-br from-white/10 to-[#101a3b] shadow-xl" />

            <div className="troll-breathe absolute left-1/2 top-[-65px] h-[145px] w-[220px] -translate-x-1/2">
              <div className="absolute left-1/2 top-0 h-[115px] w-[125px] -translate-x-1/2 rounded-[48%] border border-[#00BFFF]/40 bg-gradient-to-br from-[#164d72] via-[#0c314f] to-[#08172e] shadow-[0_0_30px_rgba(0,191,255,0.22)]">
                <div className="absolute left-1/2 top-[-34px] h-16 w-24 -translate-x-1/2">
                  <div className="absolute left-1/2 top-0 h-14 w-14 -translate-x-1/2 rotate-[45deg] rounded-[8px] bg-gradient-to-br from-[#BF00FF] to-[#00BFFF] opacity-80 shadow-[0_0_25px_rgba(191,0,255,0.45)]" />
                </div>

                <div className="absolute left-[22px] top-[48px] h-3 w-8 rounded-full bg-[#050816]" />
                <div className="absolute right-[22px] top-[48px] h-3 w-8 rounded-full bg-[#050816]" />

                <div className="absolute left-1/2 top-[68px] h-2 w-9 -translate-x-1/2 rounded-full bg-[#050816]" />

                <div className="absolute left-1/2 top-[82px] h-2 w-16 -translate-x-1/2 rounded-full bg-[#00BFFF]/20 blur-sm" />
              </div>

              <div className="absolute bottom-0 left-0 h-16 w-20 rotate-[12deg] rounded-[40%] bg-gradient-to-br from-[#164d72] to-[#08172e]" />
              <div className="absolute bottom-0 right-0 h-16 w-20 rotate-[-12deg] rounded-[40%] bg-gradient-to-br from-[#164d72] to-[#08172e]" />
            </div>
          </div>

          <div className="absolute bottom-0 left-1/2 h-5 w-[80%] -translate-x-1/2 rounded-full bg-black/50 blur-md" />

          <div className="zzz-float absolute left-[61%] top-[18%] text-2xl font-black text-[#00BFFF]">
            Z
          </div>
          <div
            className="zzz-float absolute left-[69%] top-[5%] text-xl font-black text-[#BF00FF]"
            style={{ animationDelay: '1.2s' }}
          >
            z
          </div>
          <div
            className="zzz-float absolute left-[75%] top-[-2%] text-sm font-black text-[#00BFFF]"
            style={{ animationDelay: '2.2s' }}
          >
            z
          </div>
        </div>

        <div className="w-full max-w-[520px] text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#00BFFF]" />

            <div className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <span>🧌</span>
              <span className="bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] bg-clip-text text-transparent">
                MaiTroll is Sleeping...
              </span>
            </div>

            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#BF00FF]" />
          </div>

          <p className="mb-2 text-sm text-white/60 sm:text-base">
            The trolls need their beauty sleep.
          </p>

          <p className="mb-7 text-xs text-white/40 sm:text-sm">
            MaiTroll wakes up at <span className="font-bold text-[#00BFFF]">10:00 AM</span>{' '}
            America/Chicago.
          </p>

          <div
            aria-live="polite"
            className="neon-pulse mx-auto mb-6 inline-flex items-center gap-3 rounded-2xl border border-[#00BFFF]/30 bg-black/30 px-6 py-4 backdrop-blur-xl"
          >
            <Moon className="h-5 w-5 text-[#BF00FF]" />

            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                Opening In
              </div>

              <div className="font-mono text-3xl font-black tracking-wider text-white sm:text-4xl">
                {formattedHours}:{formattedMinutes}:{formattedSeconds}
              </div>
            </div>
          </div>

          {/* Puzzle Section */}
          <form onSubmit={handlePuzzleSubmit} className="mx-auto w-full max-w-[360px] mb-6 rounded-2xl border border-[#00BFFF]/30 bg-black/40 p-5 backdrop-blur-xl">
            <p className="text-sm font-bold text-white">Solve this to enter</p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-black tracking-wide text-white">{question.prompt}</p>
            </div>
            <input
              value={puzzleAnswer}
              onChange={(e) => setPuzzleAnswer(e.target.value)}
              inputMode="numeric"
              pattern="[0-9\-]*"
              autoFocus
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-lg font-semibold text-white outline-none focus:border-[#00BFFF]/50"
              placeholder="Your answer"
            />
            <button
              type="submit"
              disabled={puzzleBusy || !puzzleAnswer.trim()}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
            >
              {puzzleBusy ? 'Checking...' : 'Unlock'}
            </button>
          </form>

          {/* Signup Section */}
          <div className="mb-6">
            {!showSignup ? (
              <button
                onClick={() => setShowSignup(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#00BFFF]/40 bg-[#00BFFF]/10 px-5 py-3 text-sm font-bold text-[#00BFFF] transition-all hover:border-[#00BFFF]/60 hover:bg-[#00BFFF]/20"
              >
                <UserPlus className="h-4 w-4" />
                Create Account While You Wait
              </button>
            ) : (
              <form onSubmit={handleSignup} className="mx-auto w-full max-w-[360px] space-y-3 rounded-2xl border border-[#00BFFF]/30 bg-black/40 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Create Account</h3>
                  <button
                    type="button"
                    onClick={() => setShowSignup(false)}
                    className="text-xs text-white/50 hover:text-white/80"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#00BFFF]/50"
                    required
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#00BFFF]/50"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 6 chars)"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder-white/30 outline-none focus:border-[#00BFFF]/50"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <label className="flex items-start gap-2 text-left">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/50">
                    I agree to the Terms of Service and Privacy Policy
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full rounded-lg bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {signupLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>
            )}
          </div>

          <p className="mb-1 text-sm font-semibold text-white/70">
            Don&apos;t wake the troll... 😴
          </p>

          <p className="text-xs text-white/35">
            Come back soon for 16 hours of pure chaos.
          </p>

          {countdownToOpen && (
            <div className="mt-5 text-[10px] text-white/20">
              Next opening: {countdownToOpen}
            </div>
          )}
        </div>

        <div className="absolute bottom-5 left-1/2 flex w-[min(420px,80%)] -translate-x-1/2 items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-transparent via-[#00BFFF] to-[#BF00FF] opacity-50" />
          <div className="h-1 w-2 rounded-full bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]" />
          <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-[#BF00FF] via-[#00BFFF] to-transparent opacity-50" />
        </div>
      </div>
    </div>
  )
}