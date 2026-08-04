import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useDriverTest } from '@/lib/hooks/useVehicleSystem'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  Car,
  Sparkles,
  CheckCircle,
  Loader2,
  ArrowLeft,
  KeyRound,
} from 'lucide-react'

export default function DriverTest() {
  const navigate = useNavigate()
  const { license, grantLicense, takeTest, loading } = useDriverTest()

  const [granting, setGranting] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationComplete, setCelebrationComplete] = useState(false)

  const alreadyLicensed = license?.status === 'active'

  const handleGrantLicense = async () => {
    if (granting || loading) return

    try {
      setGranting(true)

      /**
       * Prefer new grantLicense().
       * Fallback to takeTest() so this page still works if Vite has not refreshed types yet.
       */
      const response =
        typeof grantLicense === 'function'
          ? await grantLicense()
          : await takeTest()

      if (!response.success || !response.passed) {
        toast.error(response.message || 'Unable to grant license. Please try again.')
        return
      }

      toast.success('MaiTroll license granted!')

      setShowCelebration(true)

      window.setTimeout(() => {
        setCelebrationComplete(true)

        window.setTimeout(() => {
          navigate('/neighborhood-setup')
        }, 1400)
      }, 2200)
    } catch (error) {
      console.error('Failed to grant Mai Troll license:', error)
      toast.error('Unable to grant license. Please try again.')
    } finally {
      setGranting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/40">
        <div className="relative border-b border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%)] p-6 sm:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200 shadow-lg shadow-cyan-950/40">
                <Car size={16} />
                Mai Troll License Center
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Get Your Mai Troll License
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                The written driver test has been removed. Tap the button below to instantly
                grant your Mai Troll license and unlock neighborhood driving access.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 p-4 text-left md:text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                License Status
              </div>

              <div className="mt-2">
                {alreadyLicensed ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  >
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Licensed
                  </Badge>
                ) : license ? (
                  <Badge
                    variant="outline"
                    className="border-yellow-400/40 bg-yellow-500/10 text-yellow-200"
                  >
                    License inactive
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-slate-600 bg-slate-900/80 text-slate-200"
                  >
                    No license yet
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-cyan-200">
                <KeyRound size={22} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Instant License Grant</h2>
                <p className="mt-1 text-sm text-slate-400">
                  No quiz. No questions. Just activate the license.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-slate-950/70 p-5">
              {alreadyLicensed ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">
                      You already have a license.
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Your Mai Troll driver access is active.
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate('/neighborhood-setup')}
                    className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 sm:w-auto"
                  >
                    Go to Neighborhood
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-bold text-white">
                    Ready to activate your license?
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Click the button below. Mai Troll will save your license to the backend
                    and mark it active.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={handleGrantLicense}
                      disabled={granting || loading}
                      className="w-full bg-cyan-500 font-bold text-slate-950 shadow-lg shadow-cyan-950/50 hover:bg-cyan-400 sm:w-auto"
                    >
                      {granting || loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Granting License...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Get License
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => navigate('/neighborhood-setup')}
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Neighborhood
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-purple-400/20 bg-purple-950/10 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white">License Access</h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                Your Mai Troll license lets the neighborhood and vehicle system recognize you as licensed.
              </div>

              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                Officers and BroadOfficers can still check your license status.
              </div>

              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                Insurance and violations can still affect driving permissions later.
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="relative text-center">
            <div className="absolute -inset-20 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <Sparkles
                  key={i}
                  className="absolute animate-pulse text-yellow-300"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                    animationDelay: `${i * 0.18}s`,
                    animationDuration: '2s',
                  }}
                  size={24}
                />
              ))}
            </div>

            <div className="relative z-10 max-w-md rounded-3xl border border-emerald-400/50 bg-emerald-950/95 p-8 shadow-2xl shadow-emerald-500/30">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <CheckCircle className="h-20 w-20 text-emerald-300" />
                  <div className="absolute -inset-4 animate-ping rounded-full border-2 border-emerald-400 opacity-20" />
                </div>
              </div>

              <h2 className="mb-4 text-3xl font-black text-white">
                🎉 LICENSE GRANTED! 🎉
              </h2>

              <p className="mb-6 text-lg text-emerald-100">
                Welcome to Mai Troll drivers. Your license is now active.
              </p>

              {!celebrationComplete ? (
                <div className="flex items-center justify-center gap-2 text-emerald-200">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Preparing your Mai Troll access...
                </div>
              ) : (
                <div className="animate-bounce text-emerald-200">
                  🚗 Entering Mai Troll streets...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}