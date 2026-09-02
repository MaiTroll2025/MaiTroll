import React, { useEffect, useState } from 'react'
import { Sparkles, Sun, Zap } from 'lucide-react'

interface TrollWakeUpAnimationProps {
  onAnimationComplete: () => void
  duration?: number
}

type WakePhase = 'sleeping' | 'waking' | 'wakeup' | 'complete'

export function TrollWakeUpAnimation({
  onAnimationComplete,
  duration = 3000,
}: TrollWakeUpAnimationProps) {
  const [phase, setPhase] = useState<WakePhase>('sleeping')

  useEffect(() => {
    let mounted = true

    const wakeTimer = window.setTimeout(() => {
      if (mounted) setPhase('waking')
    }, 500)

    const mainWakeTimer = window.setTimeout(() => {
      if (mounted) setPhase('wakeup')
    }, 1200)

    const completeTimer = window.setTimeout(() => {
      if (!mounted) return

      setPhase('complete')
      onAnimationComplete()
    }, duration)

    return () => {
      mounted = false
      window.clearTimeout(wakeTimer)
      window.clearTimeout(mainWakeTimer)
      window.clearTimeout(completeTimer)
    }
  }, [duration, onAnimationComplete])

  const sparkles = [
    { x: '-180px', y: '-120px', delay: '0ms', rotate: '-20deg' },
    { x: '-120px', y: '-180px', delay: '70ms', rotate: '-5deg' },
    { x: '0px', y: '-220px', delay: '140ms', rotate: '0deg' },
    { x: '120px', y: '-180px', delay: '210ms', rotate: '10deg' },
    { x: '180px', y: '-100px', delay: '280ms', rotate: '25deg' },
    { x: '190px', y: '40px', delay: '350ms', rotate: '40deg' },
    { x: '120px', y: '150px', delay: '420ms', rotate: '55deg' },
    { x: '-120px', y: '150px', delay: '490ms', rotate: '-55deg' },
    { x: '-190px', y: '40px', delay: '560ms', rotate: '-40deg' },
  ]

  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden bg-[#050816] text-white">
      <style>{`
        @keyframes roomBrighten {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes trollSleep {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(3px) scale(1.015);
          }
        }

        @keyframes trollWake {
          0% {
            transform: translateY(10px) scale(0.95);
            opacity: 0;
          }
          45% {
            transform: translateY(-5px) scale(1.04);
            opacity: 1;
          }
          75% {
            transform: translateY(0) scale(1);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes trollStretch {
          0% {
            transform: scale(0.85) translateY(20px);
            opacity: 0;
          }
          40% {
            transform: scale(1.08) translateY(-8px);
            opacity: 1;
          }
          70% {
            transform: scale(0.98) translateY(2px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes alarmRing {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }

        @keyframes flash {
          0% {
            opacity: 0;
          }
          35% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes sparkleShoot {
          0% {
            transform: translate(0, 0) scale(0.2) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--x), var(--y)) scale(1) rotate(180deg);
            opacity: 0;
          }
        }

        @keyframes sunrise {
          0% {
            transform: translate(-50%, 120px) scale(0.5);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -100px) scale(1);
            opacity: 1;
          }
        }

        @keyframes zzzDisappear {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-50px);
          }
        }

        @keyframes textReveal {
          0% {
            opacity: 0;
            transform: translateY(25px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes neonPulse {
          0%, 100% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes gridRise {
          0% {
            transform: perspective(500px) rotateX(65deg) translateY(20px);
          }
          100% {
            transform: perspective(500px) rotateX(65deg) translateY(0);
          }
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-b from-[#070b24] via-[#0c1735] to-[#050816]" />

      <div
        className={`absolute inset-0 transition-all duration-1500 ${
          phase === 'wakeup' || phase === 'complete'
            ? 'opacity-100'
            : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(255,205,80,0.28) 0%, rgba(0,191,255,0.12) 35%, transparent 70%)',
        }}
      />

      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div
          className="absolute -bottom-40 left-0 h-[70%] w-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,191,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(191,0,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '70px 70px',
            animation: 'gridRise 2s ease-out forwards',
          }}
        />
      </div>

      <div
        className={`absolute right-[10%] top-[10%] transition-opacity duration-1000 ${
          phase === 'wakeup' || phase === 'complete'
            ? 'opacity-100'
            : 'opacity-30'
        }`}
      >
        <Sun
          className="h-20 w-20 text-yellow-300"
          style={{
            filter:
              'drop-shadow(0 0 15px rgba(253,224,71,0.8)) drop-shadow(0 0 40px rgba(253,224,71,0.4))',
            animation:
              phase === 'wakeup'
                ? 'sunrise 1.5s ease-out forwards'
                : undefined,
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="relative flex h-full w-full max-w-3xl flex-col items-center justify-center px-6">
          <div
            className={`absolute transition-all ${
              phase === 'waking' || phase === 'wakeup' || phase === 'complete'
                ? 'scale-90 opacity-0'
                : 'scale-100 opacity-100'
            }`}
            style={{
              transitionDuration: '500ms',
            }}
          >
            <div className="relative h-64 w-64">
              <div className="absolute inset-0 rounded-[40%] bg-gradient-to-br from-[#164d72] via-[#0d3150] to-[#08172e] shadow-[0_0_60px_rgba(0,191,255,0.25)]">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="text-7xl">😴</div>
                </div>
              </div>

              <div
                className="absolute -right-10 -top-12 text-4xl text-[#00BFFF]"
                style={{
                  animation:
                    phase === 'waking'
                      ? 'zzzDisappear 500ms ease-out forwards'
                      : undefined,
                }}
              >
                Z
              </div>

              <div
                className="absolute -right-2 -top-24 text-3xl text-[#BF00FF]"
                style={{
                  animation:
                    phase === 'waking'
                      ? 'zzzDisappear 600ms ease-out forwards'
                      : undefined,
                }}
              >
                z
              </div>

              <div
                className="absolute right-8 -top-32 text-xl text-[#00BFFF]"
                style={{
                  animation:
                    phase === 'waking'
                      ? 'zzzDisappear 700ms ease-out forwards'
                      : undefined,
                }}
              >
                z
              </div>
            </div>
          </div>

          {phase === 'waking' && (
            <div
              className="absolute"
              style={{
                animation: 'trollWake 800ms ease-out forwards',
              }}
            >
              <div className="relative h-64 w-64">
                <div className="absolute inset-0 rounded-[40%] bg-gradient-to-br from-[#00BFFF] via-[#1766a0] to-[#BF00FF] opacity-80 shadow-[0_0_80px_rgba(0,191,255,0.45)]" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-7xl">🤔</div>
                </div>

                <div className="absolute -left-10 top-1/2 text-3xl text-[#00BFFF]">
                  ⚡
                </div>

                <div className="absolute -right-10 top-1/3 text-3xl text-[#BF00FF]">
                  ⚡
                </div>
              </div>
            </div>
          )}

          {(phase === 'wakeup' || phase === 'complete') && (
            <>
              <div
                className="absolute"
                style={{
                  animation: 'trollStretch 1000ms ease-out forwards',
                }}
              >
                <div className="relative h-64 w-64">
                  <div className="absolute inset-0 rounded-[40%] bg-gradient-to-br from-[#00BFFF] via-[#1766a0] to-[#BF00FF] shadow-[0_0_100px_rgba(0,191,255,0.55)]" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-7xl">😎</div>
                  </div>

                  <div className="absolute -left-14 top-1/2 text-4xl">
                    🧌
                  </div>

                  <div className="absolute -right-14 top-1/2 text-4xl">
                    🧌
                  </div>
                </div>
              </div>

              <div
                className="absolute h-40 w-40 rounded-full border-4 border-yellow-300"
                style={{
                  animation: 'alarmRing 1s ease-out forwards',
                }}
              />

              <div
                className="absolute inset-0 bg-yellow-300/30 blur-3xl"
                style={{
                  animation: 'flash 1s ease-out forwards',
                }}
              />

              <div className="pointer-events-none absolute inset-0">
                {sparkles.map((sparkle, index) => (
                  <div
                    key={index}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      '--x': sparkle.x,
                      '--y': sparkle.y,
                      animation: `sparkleShoot 900ms ease-out ${sparkle.delay} forwards`,
                    } as React.CSSProperties}
                  >
                    <Sparkles
                      className="h-6 w-6 text-yellow-300"
                      style={{
                        transform: `rotate(${sparkle.rotate})`,
                        filter:
                          'drop-shadow(0 0 8px rgba(253,224,71,0.8))',
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <div
            className={`absolute bottom-20 text-center ${
              phase === 'wakeup' || phase === 'complete'
                ? 'opacity-100'
                : 'opacity-0'
            }`}
            style={{
              animation:
                phase === 'wakeup'
                  ? 'textReveal 600ms ease-out 300ms forwards'
                  : undefined,
            }}
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <Zap className="h-5 w-5 text-yellow-300" />

              <p className="text-2xl font-black sm:text-3xl">
                <span className="text-[#00BFFF]">MaiTroll</span>{' '}
                <span className="text-yellow-300">
                  is Waking Up!
                </span>{' '}
                🌅
              </p>

              <Sparkles className="h-5 w-5 text-[#BF00FF]" />
            </div>

            <p className="text-sm text-[#00BFFF]/80 sm:text-base">
              Get ready for some chaos...
            </p>
          </div>

          <div
            className={`absolute bottom-7 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/30 ${
              phase === 'complete' ? 'opacity-0' : ''
            }`}
          >
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#00BFFF]" />

            <span
              style={{
                animation: 'neonPulse 2s ease-in-out infinite',
              }}
            >
              Trolls Are Reporting For Duty
            </span>

            <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#BF00FF]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrollWakeUpAnimation