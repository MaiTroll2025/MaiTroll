import React, { useEffect, useState, useRef } from 'react'
import { Trophy, Zap, Gift, ChevronRight, Star, Target, TrendingUp, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useLeagueProgress, type LevelUpEvent } from '../../hooks/useLeagueProgress'

interface LeagueProgressPanelProps {
  streamId?: string | null
  compact?: boolean
}

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = display
    const diff = value - start
    if (Math.abs(diff) < 1) { setDisplay(value); return }
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

function LevelUpAnimation({ event, onDismiss }: { event: LevelUpEvent; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 500)
    }, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="relative pointer-events-auto"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400/20 via-purple-500/20 to-cyan-400/20 blur-xl animate-pulse" />
            <div className="relative rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-slate-900/95 via-purple-950/90 to-slate-900/95 p-8 shadow-2xl shadow-yellow-500/20 backdrop-blur-xl min-w-[320px] text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border border-yellow-400/30"
              >
                {event.type === 'main_tier' ? (
                  <Trophy className="h-10 w-10 text-yellow-300" />
                ) : event.type === 'league_level' ? (
                  <Award className="h-10 w-10 text-purple-300" />
                ) : (
                  <TrendingUp className="h-10 w-10 text-cyan-300" />
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400/80">
                  {event.type === 'main_tier' ? 'Tier Up!' : event.type === 'league_level' ? 'League Level Up!' : 'Sub-Tier Up!'}
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  {event.current}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  from {event.previous}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="text-xs font-bold text-yellow-300">{event.reward.perk}</p>
                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-400" />
                    +{event.reward.trollCoins} coins
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-purple-400" />
                    +{event.reward.xp} XP
                  </span>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={onDismiss}
                className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Awesome!
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ProgressBar({
  progress,
  colorFrom,
  colorTo,
  height = 'h-3',
  animated = true,
  showGlow = true,
}: {
  progress: number
  colorFrom: string
  colorTo: string
  height?: string
  animated?: boolean
  showGlow?: boolean
}) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className={cn('relative overflow-hidden rounded-full bg-white/10', height)}>
      <motion.div
        initial={animated ? { width: 0 } : { width: `${clamped}%` }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn(
          'h-full rounded-full bg-gradient-to-r',
          colorFrom, colorTo,
          showGlow && 'shadow-[0_0_12px_rgba(34,211,238,0.3)]'
        )}
      />
    </div>
  )
}

export default function LeagueProgressPanel({ streamId, compact = false }: LeagueProgressPanelProps) {
  const {
    state,
    subTierProgress,
    nextSubTier,
    scoreForNext,
    leagueLevelInfo,
    leagueLevelProgress,
    subTierColor,
    levelUpEvent,
    claimWeeklyGoal,
    dismissLevelUp,
  } = useLeagueProgress(streamId || null)

  if (!state) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-white/10 mb-3" />
        <div className="h-3 w-full rounded bg-white/10 mb-2" />
        <div className="h-3 w-3/4 rounded bg-white/10" />
      </div>
    )
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{state.mainTier === 'T0' ? '⚪' : '🏆'}</span>
            <span className="text-xs font-black text-white">{state.mainTier}{state.subTier}</span>
            <span className="text-[10px] text-slate-400">{state.mainTier === 'T0' ? 'Unranked' : ''}</span>
          </div>
          <span className="text-[10px] font-bold text-cyan-300">
            Lv.{state.leagueLevel}
          </span>
        </div>
        <ProgressBar
          progress={subTierProgress}
          colorFrom={subTierColor.split(' ')[0].replace('from-', 'from-')}
          colorTo={subTierColor.split(' ')[1].replace('to-', 'to-')}
          height="h-2"
          animated={false}
          showGlow={false}
        />
        <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
          <span>{state.leagueScore.toLocaleString()} pts</span>
          {nextSubTier && (
            <span>Next: {nextSubTier.full}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {levelUpEvent && (
        <LevelUpAnimation event={levelUpEvent} onDismiss={dismissLevelUp} />
      )}

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">T League</span>
            </div>
            <span className="text-[10px] text-slate-500">{state.seasonKey}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <motion.div
              key={state.mainTier + state.subTier}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br shadow-lg"
              style={{
                backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
              }}
            >
              <div className={cn('grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br shadow-lg', subTierColor)}>
                <span className="text-xl">{state.mainTier === 'T0' ? '⚪' : state.mainTier === 'T10' ? '🏆' : '🎯'}</span>
              </div>
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  {state.mainTier}{state.subTier}
                </h3>
                {nextSubTier && (
                  <ChevronRight className="h-3 w-3 text-slate-600" />
                )}
                {nextSubTier && (
                  <span className="text-[10px] text-slate-500">{nextSubTier.full}</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {state.leagueScore.toLocaleString()} league points
              </p>
            </div>
          </div>

          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>Sub-tier progress</span>
            <span className="font-bold text-white">{Math.round(subTierProgress)}%</span>
          </div>
          <ProgressBar
            progress={subTierProgress}
            colorFrom="from-cyan-500"
            colorTo="to-purple-500"
            height="h-3"
          />
          {scoreForNext && (
            <p className="mt-1 text-[9px] text-slate-500">
              {scoreForNext - state.leagueScore} pts to {nextSubTier?.full || 'next'}
            </p>
          )}
        </div>

        <div className="relative border-t border-white/5 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-3.5 w-3.5 text-pink-400" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">League Level</span>
            <span className="ml-auto text-xs font-black text-purple-300">{leagueLevelInfo.icon} {leagueLevelInfo.label}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Lv.{state.leagueLevel}</span>
            <span>Gifts sent: {state.totalGiftsSent.toLocaleString()}</span>
          </div>
          <ProgressBar
            progress={leagueLevelProgress}
            colorFrom="from-purple-500"
            colorTo="to-pink-500"
            height="h-2"
          />
          <p className="mt-1 text-[9px] text-slate-500">{leagueLevelInfo.perk}</p>
        </div>

        <div className="relative border-t border-white/5 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Weekly Goals</span>
            <span className="ml-auto text-[10px] text-slate-500">{state.weeklyGoalsCompleted}/4</span>
          </div>

          <div className="space-y-2">
            {state.weeklyGoals.map(goal => {
              const goalProgress = Math.min(100, Math.round((goal.current / goal.target) * 100))
              return (
                <div
                  key={goal.id}
                  className={cn(
                    'rounded-xl border p-2.5 transition-all',
                    goal.claimed
                      ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60'
                      : goal.completed
                      ? 'border-yellow-400/30 bg-yellow-400/5'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{goal.icon}</span>
                      <span className="text-[11px] font-bold text-white">{goal.title}</span>
                    </div>
                    {goal.claimed ? (
                      <span className="text-[9px] font-black text-emerald-400">Claimed</span>
                    ) : goal.completed ? (
                      <button
                        onClick={() => claimWeeklyGoal(goal.id)}
                        className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black text-yellow-300 hover:bg-yellow-400/20 transition-colors"
                      >
                        Claim +{goal.reward}
                      </button>
                    ) : (
                      <span className="text-[9px] text-slate-500">{goal.current}/{goal.target}</span>
                    )}
                  </div>
                  {!goal.claimed && (
                    <ProgressBar
                      progress={goalProgress}
                      colorFrom="from-cyan-600"
                      colorTo="to-cyan-400"
                      height="h-1.5"
                      animated={false}
                      showGlow={false}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Received</p>
            <p className="text-xs font-black text-white"><AnimatedNumber value={state.giftCoinsReceived} /></p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Streams</p>
            <p className="text-xs font-black text-white">{state.streamCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Live Min</p>
            <p className="text-xs font-black text-white"><AnimatedNumber value={Math.round(state.totalLiveMinutes)} /></p>
          </div>
        </div>
      </div>
    </>
  )
}
