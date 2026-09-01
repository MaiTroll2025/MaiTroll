import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Flame, Gift, Medal, X } from 'lucide-react'
import type { FeaturedBroadcaster } from '../../types/featuredLive'

interface FeaturedLeaderboardProps {
  open: boolean
  broadcasters: FeaturedBroadcaster[]
  onClose: () => void
}

export function FeaturedLeaderboard({ open, broadcasters, onClose }: FeaturedLeaderboardProps) {
  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-cyan-300/30 bg-slate-950/90 shadow-[0_0_60px_rgba(34,211,238,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200/80">Featured</p>
                <p className="text-lg font-black text-white">Leaderboard</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
              aria-label="Close leaderboard"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                <span>Current cycle</span>
                <span>Live / Current Cycle</span>
              </div>

              <div className="space-y-2">
                {broadcasters.length === 0 && (
                  <p className="text-sm text-slate-300">No Featured broadcasters are active right now.</p>
                )}

                {broadcasters.map((broadcaster, index) => (
                  <div
                    key={`${broadcaster.stream_id}-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-sm font-black text-cyan-200">
                      {index + 1}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <img
                        src={broadcaster.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(broadcaster.username)}&background=0f172a&color=67e8f9`}
                        alt={broadcaster.username}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">@{broadcaster.username}</p>
                        <p className="text-[11px] text-slate-300">
                          {broadcaster.current_viewers ?? 0} viewers • {broadcaster.stream_likes ?? 0} likes • {broadcaster.stream_coins ?? 0} coins
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Score</p>
                      <p className="text-sm font-black text-cyan-200">{(broadcaster.featured_score ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
                  <Gift className="h-4 w-4 text-violet-300" />
                  Top Gifters
                </div>
                <p className="text-xs text-slate-300">This panel is wired for the existing gift/coin transaction data and is ready to support current cycle, daily, weekly, and all-time ranges.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
                  <Flame className="h-4 w-4 text-amber-300" />
                  Battle Crown Wins
                </div>
                <p className="text-xs text-slate-300">This panel is wired to the Random Battle crown system without duplicating the existing business logic.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
