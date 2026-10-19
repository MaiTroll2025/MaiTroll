import React, { useEffect } from 'react'
import { Zap, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useBattlePot } from '@/hooks/useBattlePot'

interface BattlePotProps {
  broadcasterId: string
  streamId?: string | null
  isMobile?: boolean
  compact?: boolean
  canManageRounds?: boolean
  onBattleStart?: () => void
  onBattlePotReadinessChange?: (isReady: boolean) => void
  className?: string
}

const INITIAL_UNLOCK_TARGET = 100
const SUBSEQUENT_BATTLE_TARGET = 10

export function BattlePot({
  broadcasterId,
  streamId,
  isMobile = false,
  compact = false,
  canManageRounds = false,
  onBattleStart,
  onBattlePotReadinessChange,
  className,
}: BattlePotProps) {
  const {
    state,
    loading,
    error,
    creatingRound,
    createNextRound,
  } = useBattlePot({
    broadcasterId,
    streamId,
    onRoundReached: () => {
      toast.success('Battle pot target reached! Preparing battle...')
    },
    onBattleStarted: () => {
      toast.success('Battle starting!')
      onBattleStart?.()
    },
  })

  const isBattlePotReady =
    state?.round_type === 'subsequent_battle' &&
    state.status === 'reached' &&
    state.collected_coins >= state.target_coins

  useEffect(() => {
    onBattlePotReadinessChange?.(!loading && isBattlePotReady)
  }, [isBattlePotReady, loading, onBattlePotReadinessChange])

  const handleCreateNextRound = async () => {
    const result = await createNextRound()
    if (result.success) {
      toast.success('New battle pot round opened')
    }
  }

  if (loading) {
    return (
      <div className={cn(
        compact
          ? 'flex h-10 shrink-0 items-center gap-2 text-[10px] text-zinc-500 animate-pulse'
          : 'flex items-center gap-2 text-xs text-zinc-500 animate-pulse',
        className,
      )}>
        <Loader2 size={14} className="animate-spin" />
        Loading battle pot...
      </div>
    )
  }

  if (!state) {
    if (error) {
      if (compact) {
        return (
          <div className={cn('shrink-0 truncate text-[10px] font-semibold text-red-200', className)}>
            Battle Pot unavailable
          </div>
        )
      }
      return (
        <div className={cn('rounded-xl border border-red-500/30 bg-red-950/70 px-3 py-2 text-xs text-red-200', className)}>
          Battle Pot unavailable: {error}
        </div>
      )
    }
    return null
  }

  const isUnlocked = state.unlocked
  const target = isUnlocked ? SUBSEQUENT_BATTLE_TARGET : INITIAL_UNLOCK_TARGET
  const progress = state.target_coins > 0 ? (state.collected_coins / state.target_coins) * 100 : 0
  const remaining = state.remaining
  const isOpen = state.status === 'open'
  const isReached = state.status === 'reached'
  const isBattleStarted = state.status === 'battle_started'

  if (compact) {
    return (
      <div className={cn('relative flex h-10 min-w-0 shrink-0 items-center gap-2 rounded-xl border border-amber-400/30 bg-slate-950/85 px-2 text-white shadow-lg backdrop-blur-md', className)}>
        <div className="flex min-w-0 items-center gap-1.5">
          {isUnlocked
            ? <Zap size={14} className="shrink-0 text-emerald-300" />
            : <Lock size={14} className="shrink-0 text-amber-300" />}
          <span className="hidden truncate text-[10px] font-black uppercase tracking-wide xl:inline">
            Battle Pot
          </span>
          <span className="shrink-0 text-[10px] font-bold text-amber-100">
            {state.round_id
              ? `${state.collected_coins.toLocaleString()}/${target}`
              : `${target} coins`}
          </span>
        </div>
        {!state.round_id && isUnlocked && canManageRounds ? (
          <button
            type="button"
            onClick={handleCreateNextRound}
            disabled={creatingRound}
            className="h-7 shrink-0 rounded-lg bg-emerald-500 px-2 text-[9px] font-black uppercase disabled:opacity-50"
          >
            {creatingRound ? 'Opening' : 'Open Round'}
          </button>
        ) : (
          <span className="hidden truncate text-[9px] font-semibold text-white/70 2xl:inline">
            {isReached
              ? 'Target reached'
              : isBattleStarted
                ? 'Battle starting'
                : isOpen
                  ? 'Gift to fill'
                  : `${remaining.toLocaleString()} remaining`}
          </span>
        )}
        <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={cn('rounded-xl border border-amber-400/30 bg-slate-950/85 p-2.5 text-white shadow-lg backdrop-blur-md', className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {isUnlocked
              ? <Zap size={14} className="shrink-0 text-emerald-300" />
              : <Lock size={14} className="shrink-0 text-amber-300" />}
            <span className="truncate text-[10px] font-black uppercase tracking-wide">
              {isUnlocked ? 'Next Random Battle' : 'Unlock Random Battles'}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-amber-100">
            {state.round_id
              ? `${state.collected_coins.toLocaleString()} / ${target.toLocaleString()}`
              : `${target} coins`}
          </span>
        </div>
        {state.round_id && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          {!state.round_id && isUnlocked && canManageRounds ? (
            <button
              type="button"
              onClick={handleCreateNextRound}
              disabled={creatingRound}
              className="h-8 w-full rounded-lg bg-emerald-500 px-3 text-[10px] font-black uppercase disabled:opacity-50"
            >
              {creatingRound ? 'Opening…' : 'Open 10-Gift-Coin Round'}
            </button>
          ) : !state.round_id && isUnlocked ? (
            <span className="text-[10px] font-semibold text-white/70">
              Waiting for the broadcaster to open the next round
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-white/70">
              {isReached
                ? 'Target reached — battle ready'
                : isBattleStarted
                  ? 'Battle starting'
                  : isOpen
                    ? 'Send a gift to fill this pot'
                    : `${remaining.toLocaleString()} coins remaining`}
            </span>
          )}
        </div>
        {error && <p className="mt-1.5 text-[10px] text-red-300">{error}</p>}
      </div>
    )
  }

  // Before unlock: show the initial Battle Pot.
  if (!isUnlocked) {
    return (
      <div
        className={cn(
          'relative flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-900/20 p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(245,158,11,0.15)]',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-100 uppercase tracking-wider">
            Unlock Random Battles
          </h3>
        </div>

        <p className="text-xs text-amber-300/80 leading-relaxed">
          Gifts sent to the broadcaster fill this target. Battle access stays
          unlocked permanently once the gift-funded target is reached.
        </p>

        {/* Progress header */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-zinc-400">Progress</p>
            <p className="text-lg font-bold text-white">
              {state.collected_coins.toLocaleString()} / {target.toLocaleString()} coins
            </p>
          </div>
          <p className="text-xs font-bold text-amber-300">
            {remaining.toLocaleString()} remaining
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 rounded-full bg-zinc-800/50 overflow-hidden border border-zinc-700/50">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              'bg-gradient-to-r from-amber-400 to-orange-400',
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {isOpen && (
          <p className="mt-2 text-xs font-semibold text-amber-200">
            Send the broadcaster a gift to add its coin value to the pot.
          </p>
        )}

        {error && (
          <p className="text-xs text-red-400/90 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
            {error}
          </p>
        )}
      </div>
    )
  }

  // After unlock: show the next 10-coin Battle Pot.
  if (!state.round_id) {
    // No open round — show unlocked state with option to create next round
    return (
      <div
        className={cn(
          'relative flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(34,197,94,0.15)]',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-emerald-100 uppercase tracking-wider">
            Random Battles Unlocked
          </h3>
        </div>

        <p className="text-xs text-emerald-300/80">
          Permanent battle access is active. Gifts sent to the broadcaster fill a
          new 10-coin target for each battle.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400">Next battle</span>
          <span className="text-xs font-bold text-emerald-300">
            10 gift coins required
          </span>
        </div>

        {canManageRounds ? (
          <button
            onClick={handleCreateNextRound}
            disabled={creatingRound}
            className={cn(
              'mt-4 w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-50',
              creatingRound
                ? 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 cursor-not-allowed'
                : 'bg-emerald-500 border border-emerald-400/50 text-white hover:bg-emerald-400 active:scale-95',
            )}
          >
            {creatingRound ? <Loader2 size={14} className="animate-spin mr-2" /> : 'Open Next Battle Round'}
          </button>
        ) : (
          <p className="text-xs text-emerald-300/80">
            Waiting for the broadcaster to open the next battle round.
          </p>
        )}
      </div>
    )
  }

  // Active round after unlock
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(34,197,94,0.15)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-bold text-emerald-100 uppercase tracking-wider">
          Next Battle: {state.round_type === 'subsequent_battle' ? '10 Gift Coins' : 'Gift Round'}
        </h3>
      </div>

      <p className="text-xs text-emerald-300/80">
        {isBattleStarted
          ? 'Battle starting — gift progress is locked for this round.'
          : 'Gifts sent to the broadcaster fill the next random battle target.'}
      </p>

      {/* Progress header */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-400">Progress</p>
          <p className="text-lg font-bold text-white">
            {state.collected_coins.toLocaleString()} / {target.toLocaleString()} coins
          </p>
        </div>
        <p className="text-xs font-bold text-emerald-300">
          {remaining.toLocaleString()} remaining
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-zinc-800/50 overflow-hidden border border-zinc-700/50">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            'bg-gradient-to-r from-emerald-400 to-cyan-400',
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Status */}
      {isBattleStarted && (
        <div className="flex items-center gap-2 mt-2">
          <Loader2 size={14} className="animate-spin text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300">Battle starting…</span>
        </div>
      )}

      {isOpen && !isBattleStarted && (
        <p className="mt-2 text-xs font-semibold text-emerald-200">
          Send a gift to the broadcaster to fill this pot.
        </p>
      )}

      {isReached && (
        <div className="flex items-center gap-2 mt-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300">
            Target reached — battle ready to start
          </span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400/90 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
          {error}
        </p>
      )}
    </div>
  )
}
