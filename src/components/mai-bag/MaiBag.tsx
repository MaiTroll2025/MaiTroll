import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
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
import type { MaiBagState, MaiBagAnimationState, MaiBagGiftOption, MaiBagProps } from './types'
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
  const [configurationOpen, setConfigurationOpen] = useState(false)
  const [giftOptions, setGiftOptions] = useState<MaiBagGiftOption[]>([])
  const [selectedGiftIds, setSelectedGiftIds] = useState<string[]>([])
  const [savingConfiguration, setSavingConfiguration] = useState(false)
  const animationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const processedEventsRef = useRef<Set<string>>(new Set())
  const isBroadcaster = user?.id === bagState?.broadcaster_id

  const queueAnimationStep = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(callback, delay)
    animationTimersRef.current.push(timeout)
    return timeout
  }, [])

  const openConfiguration = useCallback(async () => {
    if (!isBroadcaster || !bagState) return

    setConfigurationOpen(true)
    const [{ data: gifts }, { data: configuration }] = await Promise.all([
      supabase.from('gift_items').select('id, name, icon, coin_cost, value').order('coin_cost', { ascending: true }).limit(100),
      supabase.rpc('get_mai_bag_gift_configuration', { p_broadcast_id: streamId }),
    ])

    setGiftOptions((gifts || []) as MaiBagGiftOption[])
    setSelectedGiftIds(Array.isArray(configuration?.gift_ids) ? configuration.gift_ids.map(String) : [])
  }, [bagState, isBroadcaster, streamId])

  const saveConfiguration = useCallback(async () => {
    if (!isBroadcaster) return

    setSavingConfiguration(true)
    try {
      const { error: saveError } = await supabase.rpc('configure_mai_bag_gifts', {
        p_broadcast_id: streamId,
        p_gift_ids: selectedGiftIds,
      })
      if (saveError) throw saveError
      setConfigurationOpen(false)
    } catch (err) {
      console.warn('[MaiBag] gift configuration failed:', err)
    } finally {
      setSavingConfiguration(false)
    }
  }, [isBroadcaster, selectedGiftIds, streamId])

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
      } else if (data?.success && data?.has_bag === false) {
        const { data: stream, error: streamError } = await supabase
          .from('streams')
          .select('user_id, broadcaster_id')
          .eq('id', streamId)
          .maybeSingle()

        if (streamError) throw streamError

        const broadcasterId = stream?.broadcaster_id || stream?.user_id
        if (!broadcasterId) {
          setBagState(null)
          return
        }

        const { data: created, error: createError } = await supabase.rpc('get_or_create_mai_bag', {
          p_broadcast_id: streamId,
          p_broadcaster_id: broadcasterId,
        })

        if (createError) throw createError

        const createdBag = created?.bag
        setBagState(created?.success && createdBag
          ? {
              ...createdBag,
              bag_id: createdBag.id,
              has_bag: true,
            } as MaiBagState
          : null)
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

            animationTimersRef.current.forEach((timer) => clearTimeout(timer))
            animationTimersRef.current = []

            queueAnimationStep(() => setAnimationState('shaking'), 1800)
            queueAnimationStep(() => setAnimationState('breaking'), 2800)
            queueAnimationStep(() => setAnimationState('coins'), 3500)
            queueAnimationStep(() => setAnimationState('reward'), 5200)
            queueAnimationStep(() => {
              setAnimationState('revealing-next')
              void fetchBagState()
            }, 6800)
            queueAnimationStep(() => {
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
      animationTimersRef.current.forEach((timer) => clearTimeout(timer))
      animationTimersRef.current = []
      void supabase.removeChannel(channel)
    }
  }, [streamId, fetchBagState, bagState?.bag_level, onAnimationComplete, queueAnimationStep])

  useEffect(() => {
    if (fillPercent >= 100 && animationState === 'idle') {
      setAnimationState('full')
    }
  }, [animationState, fillPercent])

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

  const displayTier = animationState === 'revealing-next' && reward
    ? getTierByLevel(tier.level + 1)
    : tier

  return (
    <>
      <div
        className={cn(
          'relative flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2.5 backdrop-blur-xl',
          compact ? 'w-28' : 'w-36',
          className,
        )}
      >
        <div className="flex w-full items-center justify-between px-1">
          <div className={cn('text-[9px] font-black uppercase tracking-[0.18em]', displayTier.textClass)}>
            Mai Bag
          </div>
          <div className={cn('text-[8px] font-mono font-bold', displayTier.textClass)}>
            {isBroadcaster ? 'HOST' : 'LIVE'}
          </div>
        </div>

        <div className="relative mt-3 w-full">
          <div className={cn('absolute left-1/2 top-[-13px] h-7 w-12 -translate-x-1/2 rounded-t-full border-2 border-b-0', displayTier.borderClass)} />
          <button
            type="button"
            disabled={!isBroadcaster}
            onClick={() => void openConfiguration()}
            aria-label={isBroadcaster ? 'Configure Mai Bag gifts' : 'Mai Bag'}
            className={cn(
              'relative mx-auto flex aspect-[4/5] w-[84%] flex-col items-center justify-end overflow-hidden border-2 px-2 pb-2 pt-6 text-left shadow-2xl',
              displayTier.borderClass,
              displayTier.bgClass,
              displayTier.glowClass,
              isBroadcaster && 'cursor-pointer transition hover:scale-[1.03]',
            )}
            style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)' }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/25" />
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-white/15 bg-black/10 px-1">
              <ShoppingBag className={cn('h-6 w-6', displayTier.textClass)} />
              <div className={cn('text-[11px] font-black uppercase tracking-[0.16em]', displayTier.textClass)}>
                MAI
              </div>
              <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/75">
                {displayTier.name} Bag
              </div>
              <div className={cn('mt-1 text-xl font-black', displayTier.textClass)}>
                ×{formatMultiplier(displayTier.multiplier)}
              </div>
              <div className="mt-1 w-[82%]">
                <MaiBagProgress fillPercent={fillPercent} tier={displayTier} compact />
              </div>
              <div className="text-[8px] font-mono font-bold text-white/75">
                {Math.round(fillPercent)}% FULL
              </div>
            </div>
          </button>
        </div>

        <div className="text-[8px] font-mono text-white/45">
          {bagState.current_value?.toLocaleString() || 0}/{bagState.capacity?.toLocaleString() || 0} coins
        </div>
      </div>

      {configurationOpen && isBroadcaster && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfigurationOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white">Choose five bag gifts</h2>
                <p className="mt-1 text-[11px] text-white/55">This selection is private to you.</p>
              </div>
              <span className="text-xs font-bold text-cyan-200">{selectedGiftIds.length}/5</span>
            </div>
            <div className="mt-4 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {giftOptions.map((gift) => {
                const selected = selectedGiftIds.includes(gift.id)
                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => setSelectedGiftIds((current) => selected
                      ? current.filter((id) => id !== gift.id)
                      : current.length < 5 ? [...current, gift.id] : current)}
                    className={cn(
                      'rounded-xl border p-2 text-center transition',
                      selected
                        ? 'border-cyan-300 bg-cyan-400/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]',
                    )}
                  >
                    <span className="block text-xl">{gift.icon || '🎁'}</span>
                    <span className="mt-1 block truncate text-[10px] font-bold">{gift.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfigurationOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/60">Cancel</button>
              <button type="button" onClick={() => void saveConfiguration()} disabled={savingConfiguration || selectedGiftIds.length !== 5} className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">
                {savingConfiguration ? 'Saving...' : 'Save five gifts'}
              </button>
            </div>
          </div>
        </div>
      )}

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
