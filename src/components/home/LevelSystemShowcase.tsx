import React, { useCallback, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { useXPStore } from '@/stores/useXPStore'
import { getLevelName } from '@/lib/xp'
import { getUnlockedPerks, getUpcomingPerks, calculateNextLevelXp, getLevelUpReward } from '@/config/levelSystem'
import { Star, Shield, Zap, Gift, Crown, Radio, MessageCircle, Music, Palette } from 'lucide-react'
import { MaiTrollTheme } from '@/styles/trollCityTheme'

interface LevelSystemShowcaseProps {
  className?: string
}

export default function LevelSystemShowcase({ className }: LevelSystemShowcaseProps) {
  const { profile } = useAuthStore()
  const { level, progress, xpToNext, fetchXP, subscribeToXP } = useXPStore()
  const [loading, setLoading] = React.useState(true)

  // Format number with commas
  const formatNumber = (num: number) => num.toLocaleString()

  const unlockedPerks = getUnlockedPerks(level)
  const upcomingPerks = getUpcomingPerks(level)

  // Scale reward for 1-2000 level range (mirrors the sidebar xpStore tier formula)
  const getRewardForLevel = useCallback((targetLevel: number) => {
    if (targetLevel <= 10) return { coins: 50 }
    if (targetLevel <= 25) return { coins: 100 }
    if (targetLevel <= 40) return { coins: 150 }
    if (targetLevel <= 50) return { coins: 250 }
    if (targetLevel % 100 === 0) return { coins: 500 }
    if (targetLevel % 25 === 0) return { coins: 250 }
    if (targetLevel % 10 === 0) return { coins: 150 }
    return { coins: 0 }
  }, [])

  const levelName = getLevelName(level)

  useEffect(() => {
    if (profile?.id) {
      fetchXP(profile.id)
      setLoading(false)
    }
  }, [profile?.id, fetchXP])

  useEffect(() => {
    if (profile?.id) {
      subscribeToXP(profile.id)
    }
    return () => {
      // Cleanup: remove the Supabase channel when unmounting
      useXPStore.getState().unsubscribe()
    }
  }, [profile?.id, subscribeToXP])

  if (loading) {
    return (
      <div className={`${className} bg-white/5 rounded-xl p-4 space-y-3`}>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-purple-300 rounded-full animate-spin" />
        </div>
        <p className="text-center text-slate-400 text-xs">Loading level info...</p>
      </div>
    )
  }

  const availablePerks = upcomingPerks
  const nextLevelReward = getRewardForLevel(level + 1)
  const progressPercentage = Math.min((progress || 0), 100)
  const bonusCoins = xpToNext ? Math.ceil(xpToNext * 0.1) : 0

  return (
    <div className={`${className} bg-white/5 rounded-xl p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="font-semibold text-white text-lg flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Level System
        </h3>
        <div className="text-slate-400 text-xs">
          City Rank Lvl {level}
        </div>
      </div>

      {/* Level Name Badge */}
      <div className="text-center">
        <span className="inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-200">
          {levelName}
        </span>
      </div>

      {/* Level Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>XP Progress</span>
          <span>{formatNumber(progress || 0)}%</span>
        </div>
        <div className="w-full bg-slate-800/50 rounded-full h-2.5 overflow-hidden">
          <div
            className={`${MaiTrollTheme.gradients.primary} h-full transition-all duration-500`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        {xpToNext > 0 && (
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{formatNumber(xpToNext)} XP to next level</span>
            <span>+{formatNumber(bonusCoins)} bonus coins</span>
          </div>
        )}
      </div>

      {/* Next Level Reward */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Level {level + 1} Reward:</span>
          <span className="text-yellow-300">+{formatNumber(nextLevelReward.coins)} Coins</span>
        </div>
      </div>

      {/* Unlocked Perks */}
      {unlockedPerks.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Unlocked Perks:</span>
            <span>+{unlockedPerks.length} Active</span>
          </div>
          <div className="space-y-2">
            {unlockedPerks.slice(-3).map((perk) => (
              <div key={perk.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-colors cursor-default">
                {perk.icon && (
                  <div className="w-5 h-5 flex items-center justify-center text-[12px]">
                    {React.createElement(perk.icon, { className: 'w-4 h-4' })}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{perk.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded
                      ${perk.tier === 'citizen' ? 'bg-blue-600/20 text-blue-300' :
                        perk.tier === 'influencer' ? 'bg-purple-600/20 text-purple-300' :
                        perk.tier === 'legend' ? 'bg-yellow-600/20 text-yellow-300' :
                        'bg-red-600/20 text-red-300'
                      }
                    `}>
                      {perk.tier}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
          {unlockedPerks.length > 3 && (
            <div className="text-[10px] text-slate-500">Showing the latest 3 unlocked perks. Visit your profile to view all active rewards.</div>
          )}
        </>
      )}

      {/* Upcoming Perks */}
      {availablePerks.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Upcoming Perks:</span>
            <span>+{availablePerks.length} Available</span>
          </div>
          <div className="space-y-2">
            {availablePerks.map((perk) => (
              <div key={perk.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-colors cursor-default">
                {perk.icon && (
                  <div className="w-5 h-5 flex items-center justify-center text-[12px]">
                    {React.createElement(perk.icon, { className: "w-4 h-4" })}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{perk.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded
                      ${perk.tier === 'citizen' ? 'bg-blue-600/20 text-blue-300' :
                        perk.tier === 'influencer' ? 'bg-purple-600/20 text-purple-300' :
                        perk.tier === 'legend' ? 'bg-yellow-600/20 text-yellow-300' :
                        'bg-red-600/20 text-red-300'
                      }
                    `}>
                      {perk.tier}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer Tip */}
      <div className="text-center text-slate-500 text-[10px] italic mt-2 pt-2 border-t border-white/5">
        Earn XP by chatting, watching streams, sending gifts &amp; more!
      </div>
    </div>
  )
}