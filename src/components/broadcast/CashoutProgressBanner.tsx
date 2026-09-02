import { motion, AnimatePresence } from 'framer-motion'
import { Coins, TrendingUp, Zap } from 'lucide-react'
import { type CashoutTier } from '@/config/coinConfig'

interface CashoutProgressBannerProps {
  isVisible: boolean
  currentBalance: number
  nextTier: CashoutTier | null
  amountRemaining: number
  progressPercent: number
  isCashoutReady: boolean
  onClick?: () => void
  isMobile?: boolean
}

export default function CashoutProgressBanner({
  isVisible,
  currentBalance,
  nextTier,
  amountRemaining,
  progressPercent,
  isCashoutReady,
  onClick,
  isMobile = false,
}: CashoutProgressBannerProps) {
  const displayTier = nextTier ?? { coins: 0, usd: 0, name: 'MAX', color: '#ffd700' }
  const displayRemaining = nextTier ? amountRemaining : 0
  const displayProgress = nextTier ? Math.min(100, Math.max(0, progressPercent)) : 100

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`pointer-events-auto absolute z-[60] ${
            isMobile ? 'top-3 left-3 right-3' : 'top-4 left-4 right-4 md:left-auto md:right-6 md:w-[360px]'
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-2xl border backdrop-blur-2xl ${
              isCashoutReady
                ? 'border-emerald-400/40 bg-emerald-950/80 shadow-[0_0_30px_rgba(52,211,153,0.25)]'
                : 'border-cyan-400/25 bg-slate-950/85 shadow-[0_0_28px_rgba(45,212,191,0.15)]'
            } ${onClick && isCashoutReady ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            role={onClick && isCashoutReady ? 'button' : undefined}
            tabIndex={onClick && isCashoutReady ? 0 : undefined}
            onKeyDown={
              onClick && isCashoutReady
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onClick()
                    }
                  }
                : undefined
            }
          >
            {isCashoutReady && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10" />
            )}

            <div className={`relative p-3 ${isMobile ? 'p-3' : 'p-4'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isCashoutReady
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {isCashoutReady ? <Zap className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                  </div>
                  <div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        isCashoutReady ? 'text-emerald-300' : 'text-cyan-200/80'
                      }`}
                    >
                      {isCashoutReady ? 'CASHOUT READY' : 'GIFT RECEIVED'}
                    </p>
                    <p className={`font-black text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {isCashoutReady
                        ? `$${displayTier.usd.toFixed(2)} AVAILABLE`
                        : `$${displayRemaining.toFixed(2)} UNTIL CASHOUT`}
                    </p>
                  </div>
                </div>
                {isCashoutReady && onClick && (
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 animate-pulse">
                    TAP
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: isCashoutReady
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                        boxShadow: isCashoutReady
                          ? '0 0 12px rgba(52,211,153,0.4)'
                          : '0 0 12px rgba(45,212,191,0.3)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${displayProgress}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.8 }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold text-white/60">
                    ${currentBalance.toFixed(2)} / ${displayTier.usd.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-white/50">
                <TrendingUp className="h-3 w-3" />
                <span>
                  {currentBalance.toLocaleString()} coins
                  {isCashoutReady ? ' — ready to cash out' : ` to ${displayTier.name}`}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
