import React, { useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MaiBagAnimationProps } from './types'
import { formatMultiplier } from './maiBagConfig'

const COIN_COUNT = 18
const PARTICLE_COUNT = 26

type Particle = {
  x: number
  y: number
  size: number
  delay: number
  duration: number
  rotate: number
}

type CoinBurst = {
  x: number
  y: number
  rotate: number
  delay: number
  duration: number
  scale: number
}

function Spark({ particle }: { particle: Particle }) {
  return (
    <motion.span
      className="absolute rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
      style={{
        width: particle.size,
        height: particle.size,
        left: '50%',
        top: '50%',
      }}
      initial={{
        x: 0,
        y: 0,
        opacity: 0,
        scale: 0,
      }}
      animate={{
        x: particle.x,
        y: particle.y,
        opacity: [0, 1, 1, 0],
        scale: [0, 1.4, 0.8, 0],
        rotate: particle.rotate,
      }}
      transition={{
        duration: particle.duration,
        delay: particle.delay,
        ease: 'easeOut',
      }}
    />
  )
}

function Coin({ coin }: { coin: CoinBurst }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 z-20"
      initial={{
        x: 0,
        y: 0,
        opacity: 1,
        scale: 0.35,
        rotate: 0,
      }}
      animate={{
        x: coin.x,
        y: [0, coin.y * 0.65, coin.y],
        opacity: [1, 1, 0],
        scale: [0.35, coin.scale, 0.8],
        rotate: coin.rotate,
      }}
      transition={{
        duration: coin.duration,
        delay: coin.delay,
        ease: [0.12, 0.8, 0.25, 1],
      }}
    >
      <div className="relative h-9 w-9">
        <div
          className="
            absolute inset-0 rounded-full
            border-2 border-yellow-100/80
            bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-600
            shadow-[0_0_18px_rgba(250,204,21,0.75)]
          "
        />

        <div
          className="
            absolute inset-[5px]
            flex items-center justify-center
            rounded-full
            border border-yellow-100/70
            bg-gradient-to-br from-yellow-300 to-amber-500
            text-[10px] font-black text-amber-900
          "
        >
          T
        </div>

        <div className="absolute left-1.5 top-1 h-2 w-2 rounded-full bg-white/80 blur-[1px]" />
      </div>
    </motion.div>
  )
}

export default function MaiBagAnimation({
  state,
  tier,
  reward,
  onComplete,
  compact = false,
}: MaiBagAnimationProps) {
  const prevStateRef = useRef(state)

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (Math.PI * 2 * i) / PARTICLE_COUNT
        const distance = 100 + Math.random() * 170

        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 2 + Math.random() * 5,
          delay: Math.random() * 0.18,
          duration: 0.7 + Math.random() * 0.5,
          rotate: Math.random() * 360,
        }
      }),
    []
  )

  const coins = useMemo<CoinBurst[]>(
    () =>
      Array.from({ length: COIN_COUNT }, (_, i) => {
        const angle = Math.PI * 2 * (i / COIN_COUNT) + (Math.random() - 0.5) * 0.35
        const distance = 120 + Math.random() * 180

        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance + 80,
          rotate: (Math.random() - 0.5) * 900,
          delay: i * 0.035,
          duration: 1.05 + Math.random() * 0.45,
          scale: 0.8 + Math.random() * 0.65,
        }
      }),
    []
  )

  useEffect(() => {
    if (state !== prevStateRef.current && state === 'idle' && onComplete) {
      const timer = setTimeout(() => onComplete(), 0)
      return () => clearTimeout(timer)
    }

    prevStateRef.current = state
  }, [state, onComplete])

  if (state === 'idle') return null

  const isBagFull = state === 'full'
  const isShaking = state === 'shaking'
  const isBreaking = state === 'breaking'
  const isCoins = state === 'coins'
  const isReward = state === 'reward'
  const isRevealing = state === 'revealing-next'

  const rewardCoins = reward?.coins ?? 0
  const rewardBonus = reward?.bonus ?? 0
  const totalReward = rewardCoins + rewardBonus

  return (
    <div
      className={`
        fixed inset-0 z-[200]
        flex items-center justify-center
        pointer-events-none overflow-hidden
        ${compact ? 'p-4' : ''}
      `}
    >
      {/* Cinematic backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{
          opacity: isBreaking ? [0.7, 0.9, 0.72] : 0.78,
        }}
        transition={{
          duration: isBreaking ? 0.55 : 0.3,
        }}
      />

      {/* Ambient halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,215,80,0.22) 0%, rgba(255,180,0,0.08) 35%, transparent 70%)`,
        }}
        animate={{
          scale:
            isShaking
              ? [1, 1.08, 0.96, 1.12, 1]
              : isBreaking
                ? [1, 1.35, 0.8]
                : [1, 1.04, 1],
          opacity: isBreaking ? [0.5, 1, 0] : [0.7, 1, 0.7],
        }}
        transition={{
          duration: isBreaking ? 0.65 : 2,
          repeat: isBreaking ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="relative flex min-h-[420px] min-w-[340px] items-center justify-center"
        initial={{ scale: 0.82, opacity: 0, y: 20 }}
        animate={{
          scale: isBreaking ? [1, 1.08, 0.92, 1.18, 0.2] : 1,
          opacity: isBreaking ? [1, 1, 1, 1, 0] : 1,
          y: isBreaking ? [0, 0, 4, -4, 0] : 0,
        }}
        transition={{
          duration: isBreaking ? 0.65 : 0.35,
          ease: 'easeInOut',
        }}
      >
        <AnimatePresence mode="wait">

          {/* FULL BAG */}
          {isBagFull && (
            <motion.div
              key="full"
              className="relative flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.55, y: 40 }}
              animate={{
                opacity: 1,
                scale: [0.9, 1.04, 1],
                y: [25, -4, 0],
              }}
              transition={{
                duration: 0.7,
                ease: 'easeOut',
              }}
            >
              {/* Orbiting sparks */}
              <div className="absolute inset-[-100px]">
                {particles.slice(0, 12).map((particle, i) => (
                  <Spark key={i} particle={particle} />
                ))}
              </div>

              {/* Bag glow */}
              <motion.div
                className="absolute h-52 w-52 rounded-full blur-3xl"
                style={{
                  background: 'rgba(250, 204, 21, 0.25)',
                }}
                animate={{
                  scale: [0.9, 1.15, 0.95],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                }}
              />

              {/* Bag */}
              <motion.div
                className={`
                  relative z-10
                  flex h-52 w-44 flex-col items-center justify-center
                  rounded-[2rem]
                  border-2 ${tier.borderClass}
                  ${tier.bgClass}
                  ${tier.glowClass}
                  backdrop-blur-2xl
                  shadow-2xl
                `}
                animate={{
                  y: [0, -7, 0],
                  rotate: [-1, 1, -1],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {/* Top seal */}
                <div
                  className={`
                    absolute -top-5
                    h-10 w-24
                    rounded-full
                    border ${tier.borderClass}
                    ${tier.bgClass}
                    shadow-lg
                  `}
                />

                <div className="absolute top-1.5 h-2 w-16 rounded-full bg-white/20" />

                <div className="relative z-10 text-center">
                  <div className={`text-3xl font-black uppercase tracking-widest ${tier.textClass}`}>
                    {tier.name}
                  </div>

                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-white/60">
                    MAI BAG
                  </div>

                  <motion.div
                    className={`mt-5 text-5xl font-black ${tier.textClass}`}
                    animate={{
                      scale: [1, 1.08, 1],
                    }}
                    transition={{
                      duration: 1.3,
                      repeat: Infinity,
                    }}
                  >
                    ×{formatMultiplier(tier.multiplier)}
                  </motion.div>

                  <div className="mt-3 text-sm font-black tracking-widest text-white">
                    100% FULL
                  </div>
                </div>

                {/* shine */}
                <motion.div
                  className="absolute inset-y-0 -left-20 w-10 rotate-12 bg-white/20 blur-md"
                  animate={{
                    x: [-30, 220],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                />
              </motion.div>

              <motion.div
                className="mt-7 rounded-full border border-white/10 bg-black/30 px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white/70"
                animate={{
                  opacity: [0.55, 1, 0.55],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                Ready to open
              </motion.div>
            </motion.div>
          )}

          {/* SHAKING */}
          {isShaking && (
            <motion.div
              key="shaking"
              className="relative flex flex-col items-center"
              animate={{
                x: [0, -5, 6, -8, 9, -11, 12, -10, 7, 0],
                y: [0, -2, 2, -4, 4, -5, 5, -3, 2, 0],
                rotate: [0, -1, 1, -2, 2, -3, 3, -2, 1, 0],
              }}
              transition={{
                duration: 0.7,
                ease: 'easeInOut',
              }}
            >
              {/* Energy rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-yellow-300/30"
                  style={{
                    width: 180 + i * 55,
                    height: 180 + i * 55,
                  }}
                  animate={{
                    scale: [0.75, 1.25],
                    opacity: [0.65, 0],
                  }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.12,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              ))}

              <motion.div
                className={`
                  relative z-10
                  flex h-52 w-44 flex-col items-center justify-center
                  rounded-[2rem]
                  border-2 ${tier.borderClass}
                  ${tier.bgClass}
                  ${tier.glowClass}
                  backdrop-blur-2xl
                  shadow-2xl
                `}
                animate={{
                  boxShadow: [
                    '0 0 25px rgba(250,204,21,0.25)',
                    '0 0 55px rgba(250,204,21,0.6)',
                    '0 0 25px rgba(250,204,21,0.25)',
                  ],
                }}
                transition={{
                  duration: 0.45,
                  repeat: Infinity,
                }}
              >
                <div className={`text-3xl font-black uppercase tracking-widest ${tier.textClass}`}>
                  {tier.name}
                </div>

                <div className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-white/60">
                  MAI BAG
                </div>

                <motion.div
                  className={`mt-5 text-5xl font-black ${tier.textClass}`}
                  animate={{
                    scale: [1, 1.12, 1],
                  }}
                  transition={{
                    duration: 0.35,
                    repeat: Infinity,
                  }}
                >
                  ×{formatMultiplier(tier.multiplier)}
                </motion.div>

                <div className="mt-3 text-sm font-black uppercase tracking-widest text-yellow-200">
                  BREAKING
                </div>
              </motion.div>

              {/* Flying sparks */}
              {particles.slice(0, 18).map((particle, i) => (
                <Spark key={i} particle={particle} />
              ))}
            </motion.div>
          )}

          {/* BREAK */}
          {isBreaking && (
            <motion.div
              key="breaking"
              className="relative flex h-80 w-80 items-center justify-center"
              initial={{ scale: 0.7, opacity: 1 }}
              animate={{
                scale: [0.7, 1, 1.3, 2],
                opacity: [1, 1, 0.8, 0],
              }}
              transition={{
                duration: 0.65,
                ease: 'easeOut',
              }}
            >
              {/* White flash */}
              <motion.div
                className="absolute h-24 w-24 rounded-full bg-white blur-2xl"
                animate={{
                  scale: [0.5, 2.5, 4],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.55,
                }}
              />

              {/* Explosion rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2 border-yellow-200"
                  initial={{ width: 30, height: 30, opacity: 1 }}
                  animate={{
                    width: 280 + i * 80,
                    height: 280 + i * 80,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.55,
                    delay: i * 0.06,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* Burst particles */}
              {particles.map((particle, i) => (
                <Spark key={i} particle={particle} />
              ))}

              <motion.div
                className="relative z-10 text-7xl"
                animate={{
                  scale: [0.5, 1.5, 0],
                  rotate: [0, 20, -20],
                }}
                transition={{
                  duration: 0.55,
                }}
              >
                ✨
              </motion.div>
            </motion.div>
          )}

          {/* COINS */}
          {isCoins && (
            <motion.div
              key="coins"
              className="relative flex min-h-[400px] min-w-[360px] items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { delay: 1.3, duration: 0.25 },
              }}
            >
              {/* Coin explosion */}
              <div className="absolute left-1/2 top-1/2">
                {coins.map((coin, i) => (
                  <Coin key={i} coin={coin} />
                ))}
              </div>

              {/* Star particles */}
              <div className="absolute left-1/2 top-1/2">
                {particles.map((particle, i) => (
                  <Spark key={i} particle={particle} />
                ))}
              </div>

              {/* Center burst */}
              <motion.div
                className="absolute h-32 w-32 rounded-full bg-yellow-300/30 blur-2xl"
                animate={{
                  scale: [0.7, 1.5, 0.8],
                  opacity: [0.3, 0.9, 0.3],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                }}
              />

              {/* Reward card */}
              <motion.div
                className={`
                  absolute top-[235px]
                  z-30
                  min-w-[270px]
                  rounded-3xl
                  border ${tier.borderClass}
                  ${tier.bgClass}
                  ${tier.glowClass}
                  px-8 py-5
                  text-center
                  shadow-2xl
                  backdrop-blur-2xl
                `}
                initial={{
                  y: 35,
                  opacity: 0,
                  scale: 0.85,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                  scale: [0.9, 1.04, 1],
                }}
                transition={{
                  delay: 0.42,
                  duration: 0.55,
                  ease: 'easeOut',
                }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/60">
                  TROLL COINS
                </div>

                <motion.div
                  className="mt-1 text-4xl font-black text-yellow-300"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [0.8, 1.15, 1] }}
                  transition={{
                    delay: 0.55,
                    duration: 0.5,
                  }}
                >
                  +{rewardCoins.toLocaleString()}
                </motion.div>

                {rewardBonus > 0 && (
                  <motion.div
                    className="mt-1 text-xs font-bold text-white/70"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    Broadcast bonus +{rewardBonus.toLocaleString()}
                  </motion.div>
                )}

                <motion.div
                  className="mt-3 h-px bg-white/10"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7 }}
                />

                <motion.div
                  className="mt-2 text-xs font-black uppercase tracking-widest text-white/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  +{totalReward.toLocaleString()} TOTAL
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {/* FINAL REWARD */}
          {isReward && (
            <motion.div
              key="reward"
              className="relative flex flex-col items-center"
              initial={{
                scale: 0.65,
                opacity: 0,
                y: 30,
              }}
              animate={{
                scale: [0.8, 1.08, 1],
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.7,
                ease: 'easeOut',
              }}
            >
              <motion.div
                className="absolute -inset-20 rounded-full bg-yellow-300/20 blur-3xl"
                animate={{
                  scale: [0.8, 1.15, 0.8],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              />

              <div
                className={`
                  relative z-10
                  flex flex-col items-center
                  rounded-[2rem]
                  border ${tier.borderClass}
                  ${tier.bgClass}
                  ${tier.glowClass}
                  px-10 py-8
                  backdrop-blur-2xl
                  shadow-2xl
                `}
              >
                <motion.div
                  className="mb-3 text-5xl"
                  animate={{
                    rotate: [-8, 8, -5, 5, 0],
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    duration: 0.8,
                  }}
                >
                  🏆
                </motion.div>

                <div className="text-xs font-black uppercase tracking-[0.35em] text-white/60">
                  MAI BAG COMPLETE
                </div>

                <motion.div
                  className={`mt-3 text-3xl font-black ${tier.textClass}`}
                  animate={{
                    scale: [1, 1.08, 1],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                  }}
                >
                  {tier.name} BAG
                </motion.div>

                <motion.div
                  className="mt-4 text-4xl font-black text-yellow-300"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: 'spring',
                    stiffness: 250,
                    damping: 12,
                  }}
                >
                  +{rewardCoins.toLocaleString()}
                </motion.div>

                <div className="mt-1 text-sm font-bold text-white/70">
                  TROLL COINS
                </div>

                {rewardBonus > 0 && (
                  <div className="mt-3 rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-white/70">
                    Broadcast bonus +{rewardBonus.toLocaleString()}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* NEXT BAG */}
          {isRevealing && (
            <motion.div
              key="revealing"
              className="relative flex flex-col items-center"
              initial={{
                scale: 0.55,
                opacity: 0,
                rotateY: 90,
                y: 25,
              }}
              animate={{
                scale: [0.85, 1.06, 1],
                opacity: 1,
                rotateY: 0,
                y: 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 170,
                damping: 13,
              }}
            >
              <motion.div
                className="absolute -inset-16 rounded-full bg-yellow-300/15 blur-3xl"
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />

              <div
                className={`
                  relative z-10
                  flex h-56 w-48 flex-col items-center justify-center
                  rounded-[2rem]
                  border-2 ${tier.borderClass}
                  ${tier.bgClass}
                  ${tier.glowClass}
                  backdrop-blur-2xl
                  shadow-2xl
                `}
              >
                <div className={`text-3xl font-black uppercase tracking-widest ${tier.textClass}`}>
                  {tier.name}
                </div>

                <div className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-white/60">
                  NEXT BAG
                </div>

                <motion.div
                  className={`mt-5 text-5xl font-black ${tier.textClass}`}
                  animate={{
                    y: [0, -5, 0],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  ×{formatMultiplier(tier.multiplier)}
                </motion.div>
              </div>

              <motion.div
                className="mt-6 rounded-full border border-white/10 bg-black/30 px-5 py-2 text-xs font-black uppercase tracking-[0.3em] text-white/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                Keep going
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

