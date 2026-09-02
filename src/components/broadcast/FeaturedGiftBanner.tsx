import React, { useEffect, useMemo, useState } from 'react'
import { Gift, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeaturedGift } from '@/hooks/useFeaturedGift'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { generateUUID } from '@/lib/uuid'

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function FeaturedGiftBanner({ streamId, broadcasterId, isMobile = false }: { streamId: string; broadcasterId: string; isMobile?: boolean }) {
  const { user } = useAuthStore()
  const { gift, remainingMs, isActive, refresh } = useFeaturedGift()
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; reward?: number } | null>(null)

  useEffect(() => {
    if (!isActive) return
    const interval = window.setInterval(() => {
      refresh()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isActive, refresh])

  const rewardEstimate = useMemo(() => {
    if (!gift) return 0
    return Math.max(0, Math.floor(gift.price * 0.05))
  }, [gift])

  if (!isActive || !gift) return null

  const handleSend = async () => {
    if (!user || !gift) return
    setIsSending(true)
    setResult(null)

    try {
      const txnKey = `${user.id}_${streamId || 'nostream'}_${gift.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const { data, error } = await supabase.rpc('send_featured_gift_with_reward', {
        p_sender_id: user.id,
        p_receiver_id: broadcasterId,
        p_stream_id: streamId || null,
        p_gift_id: gift.id,
        p_quantity: 1,
        p_metadata: {
          txn_key: txnKey,
          featured_gift: true,
        },
      })

      if (error) {
        setResult({ success: false, message: error.message || 'Failed to send featured gift' })
        return
      }

      if (data && typeof data === 'object' && data.success) {
        setResult({
          success: true,
          message: data.message || 'Featured gift sent!',
          reward: data.reward_amount || rewardEstimate,
        })
        setTimeout(() => setResult(null), 4000)
      } else {
        setResult({ success: false, message: data?.message || 'Failed to send featured gift' })
      }
    } catch {
      setResult({ success: false, message: 'An unexpected error occurred' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="pointer-events-auto">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950/90 shadow-[0_0_35px_rgba(34,211,238,0.15)] backdrop-blur-xl',
          isMobile ? 'mx-3 mt-3 p-3' : 'mx-6 mt-4 p-4'
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-violet-600/20 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-500/10">
            {gift.thumbnail_url ? (
              <img src={gift.thumbnail_url} alt={gift.name} className="h-9 w-9 object-contain" />
            ) : (
              <Gift className="h-6 w-6 text-cyan-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
                Featured Gift
              </p>
            </div>
            <p className={cn('font-black text-white', isMobile ? 'text-sm' : 'text-base')}>
              {gift.name}
            </p>
            <p className={cn('font-bold text-white/70', isMobile ? 'text-[11px]' : 'text-xs')}>
              {gift.price.toLocaleString()} 🪙
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className={cn('font-black text-emerald-300', isMobile ? 'text-[10px]' : 'text-xs')}>
              5% BACK
            </p>
            <p className={cn('font-bold text-white/60', isMobile ? 'text-[9px]' : 'text-[11px]')}>
              +{rewardEstimate} coins
            </p>
            <p className={cn('font-mono font-bold text-white/50', isMobile ? 'text-[9px]' : 'text-[10px]')}>
              {formatTime(remainingMs)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className={cn(
            'mt-3 w-full rounded-xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/15 to-violet-500/15 font-black uppercase tracking-[0.18em] text-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.08)]',
            isMobile ? 'h-10 text-[11px]' : 'h-11 text-xs',
            isSending && 'opacity-70'
          )}
        >
          {isSending ? 'Sending...' : 'Send Featured Gift'}
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={cn(
                'mt-3 flex items-center gap-2 rounded-xl border px-3 py-2',
                result.success
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-400/30 bg-red-500/10 text-red-300'
              )}
            >
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <div className="min-w-0">
                <p className={cn('font-black', isMobile ? 'text-[11px]' : 'text-xs')}>
                  {result.message}
                </p>
                {result.success && result.reward ? (
                  <p className={cn('font-bold text-emerald-200/80', isMobile ? 'text-[9px]' : 'text-[10px]')}>
                    +{result.reward} coins back
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
