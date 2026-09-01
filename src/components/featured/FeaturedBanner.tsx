import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Flame, Sparkles, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FeaturedBroadcaster, FeaturedLiveEvent } from '../../types/featuredLive'

interface FeaturedBannerProps {
  broadcasters?: FeaturedBroadcaster[]
  event?: FeaturedLiveEvent | null
  onOpenLeaderboard?: () => void
}

export function FeaturedBanner({ broadcasters, event, onOpenLeaderboard }: FeaturedBannerProps) {
  const items = (broadcasters && broadcasters.length > 0 ? broadcasters : event?.broadcasters || [])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 8000)
    return () => window.clearTimeout(timer)
  }, [event?.cycle_id, items.map((item) => item.stream_id).join(',')])

  const headline = useMemo(() => {
    if (!items.length) return 'FEATURED LIVE'
    if (items.length > 1) return `${items.length} BROADCASTERS ARE NOW FEATURED`

    const name = items[0]?.username || 'Broadcaster'
    return `${name.toUpperCase()} IS NOW FEATURED`
  }, [items])

  const subline = useMemo(() => {
    if (!items.length) return 'Watch the live leaderboard'
    if (items.length > 1) return 'Premium live creators are now in the Featured rotation.'

    const item = items[0]
    const viewers = item.current_viewers ?? 0
    const likes = item.stream_likes ?? 0
    const coins = item.stream_coins ?? 0
    return `${viewers} viewers • ${likes.toLocaleString()} likes • ${coins.toLocaleString()} 🪙`
  }, [items])

  if (!items.length || !visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -14, scale: 0.98 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-3"
      >
        <motion.div
          initial={{ boxShadow: '0 0 0 rgba(34,211,238,0)' }}
          animate={{ boxShadow: '0 0 30px rgba(45,212,191,0.28), 0 0 55px rgba(168,85,247,0.18)' }}
          className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-[26px] border border-cyan-300/35 bg-slate-950/80 bg-gradient-to-r from-cyan-500/12 via-slate-950/90 to-violet-500/12 shadow-[0_0_45px_rgba(34,211,238,0.18)] backdrop-blur-xl"
        >
          <div className="relative overflow-hidden px-5 py-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.22),transparent_35%)]" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-500/12 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.2)]">
                <Crown className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Featured Live</span>
                  <span className="inline-flex items-center rounded-full border border-rose-400/35 bg-rose-500/10 px-1.5 py-0.5 text-[8px] text-rose-200">LIVE</span>
                </div>

                <p className="mt-1 truncate text-sm font-black text-white sm:text-base">{headline}</p>
                <p className="mt-1 text-[11px] text-slate-200/90">{subline}</p>
              </div>

              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Watch
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
