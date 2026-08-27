import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import {
  getTierByLevel,
  getFillPercent,
  formatMultiplier,
  MAI_BAG_TIERS,
  type MaiBagTier,
} from './maiBagConfig'
import type { MaiBagState, MaiBagAnimationState, MaiBagProps } from './types'
import MaiBagProgress from './MaiBagProgress'
import MaiBagAnimation from './MaiBagAnimation'

type BagStatus = 'idle' | 'active' | 'full' | 'shaking' | 'breaking' | 'coins' | 'reward' | 'revealing-next'

function getAnimationState(status: BagStatus): MaiBagAnimationState {
  if (status === 'full') return 'full'
  if (status === 'shaking') return 'shaking'
  if (status === 'breaking') return 'breaking'
  if (status === 'coins') return 'coins'
  if (status === 'reward') return 'reward'
  if (status === 'revealing-next') return 'revealing-next'
  return 'idle'
}

export default function MaiBag({ streamId, className, compact = false, onAnimationComplete }: MaiBagProps) {
  const { user } = useAuthStore()
  const [bagState, setBagState] = useState<MaiBagState | null>(null)
  const [animationState, setAnimationState] = useState<BagStatus>('idle')
  const [reward, setReward] = useState<{ coins: number; bonus: number; newMultiplier: number; newTierName: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingValue, setPendingValue] = useState(0)
  const animationTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const processedEventsRef = useRef<Set<string>>(new Set())
  const isBroadcaster = user?.id === bagState?.broadcaster_id

  const tier: MaiBagTier = useMemo(() => {
    if (!bagState?.bag_level) return MAI_BAG_TIERS[0]
    return getTierByLevel(bagState.bag_level)
  }, [bagState?.bag_level])

  const fillPercent = useMemo(() => {
    if (!bagState) return 0
    return getFillPercent(bagState.current_value + pendingValue, bagState.capacity)
  }, [bagState, pendingValue])

  const fetchBagState = useCallback(async () => {
    if (!streamId) return
    try {
      const { data, error: fetchError } = await supabase.rpc('get_mai_bag_state', {
        p_broadcast_id: streamId,
      })
      if (fetchError) throw fetchError
      if (data?.success && data?.has_bag) {
        setBagState(data as MaiBagState)
      } else {
        setBagState(null)
      }
      setError(null)
    } catch (err) {
      console.warn('[MaiBag] fetch failed:', err)
      setError('Failed to load Mai Bag')
    } finally {
      setIsLoading(false)
    }
  }, [streamId])

  useEffect(() => {
    setIsLoading(true)
    fetchBagState()
  }, [fetchBagState])

  useEffect(() => {
    if (!streamId) return
    const channel = supabase
      .channel(`mai-bag:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mai_bag_events',
          filter: `broadcast_id=eq.${streamId}`,
        },
        (payload) => {
          const event = payload.new as any
          const eventId = event.id as string
          if (processedEventsRef.current.has(eventId)) return
          processedEventsRef.current.add(eventId)

          if (event.event_type === 'completed') {
            const newTier = getTierByLevel((event.new_multiplier / event.old_multiplier) * (bagState?.bag_level || 1))
            setReward({
              coins: event.reward_coins,
              bonus: event.broadcaster_bonus_coins,
              newMultiplier: event.new_multiplier,
              newTierName: newTier.name,
            })
            setAnimationState('full')

            if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
            animationTimerRef.current = setTimeout(() => setAnimationState('shaking'), 1800)
            animationTimerRef.current = setTimeout(() => setAnimationState('breaking'), 2800)
            animationTimerRef.current = setTimeout(() => setAnimationState('coins'), 3500)
            animationTimerRef.current = setTimeout(() => setAnimationState('reward'), 5200)
            animationTimerRef.current = setTimeout(() => {
              setAnimationState('revealing-next')
              void fetchBagState()
            }, 6800)
            animationTimerRef.current = setTimeout(() => {
              setAnimationState('idle')
              setReward(null)
              onAnimationComplete?.()
            }, 8200)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mai_bags',
          filter: `broadcast_id=eq.${streamId}`,
        },
        (payload) => {
          const updated = payload.new as any
          setBagState((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              current_value: updated.current_value ?? prev.current_value,
              capacity: updated.capacity ?? prev.capacity,
              multiplier: updated.multiplier ?? prev.multiplier,
              bag_level: updated.bag_level ?? prev.bag_level,
              updated_at: updated.updated_at ?? prev.updated_at,
            }
          })
          setPendingValue(0)
        }
      )
      .subscribe()

    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [streamId, fetchBagState, bagState?.bag_level, onAnimationComplete])

  // Reset processed events when bag level changes (new bag)
  useEffect(() => {
    processedEventsRef.current.clear()
  }, [bagState?.bag_level])

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <div className="h-2 w-16 rounded-full bg-white/10" />
      </div>
    )
  }

  if (error || !bagState) {
    return null
  }

  const isFull = fillPercent >= 100 && animationState === 'idle'
  if (isFull) {
    setAnimationState('full')
  }

  const displayTier = animationState === 'revealing-next' && reward
    ? getTierByLevel(tier.level + 1)
    : tier

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3',
          displayTier.glowClass,
          displayTier.borderClass,
          compact ? 'w-24' : 'w-32',
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className={cn('text-[10px] font-black uppercase tracking-widest', displayTier.textClass)}>
            Mai Bag
          </div>
          <div className={cn('text-[9px] font-mono font-bold', displayTier.textClass)}>
            {isBroadcaster ? 'HOST' : 'LIVE'}
          </div>
        </div>

        <div className={cn('font-black uppercase tracking-tight', displayTier.textClass, compact ? 'text-sm' : 'text-base')}>
          {displayTier.name}
        </div>

        <div className={cn('font-black', displayTier.textClass, compact ? 'text-lg' : 'text-2xl')}>
          ×{formatMultiplier(displayTier.multiplier)}
        </div>

        <MaiBagProgress fillPercent={fillPercent} tier={displayTier} compact={compact} />

        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono text-white/70">
            {Math.round(fillPercent)}%
          </div>
          <div className="text-[9px] font-mono text-white/50">
            {bagState.current_value?.toLocaleString() || 0}/{bagState.capacity?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {animationState !== 'idle' && (
          <MaiBagAnimation
            state={getAnimationState(animationState)}
            tier={displayTier}
            reward={reward ?? undefined}
            compact={compact}
            onComplete={() => {
              setAnimationState('idle')
              setReward(null)
              setPendingValue(0)
              onAnimationComplete?.()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
