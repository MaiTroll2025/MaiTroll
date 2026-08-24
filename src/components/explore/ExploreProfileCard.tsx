import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useUserFrame } from '@/hooks/useUserFrame'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { Coins, Gem, Crown, Newspaper } from 'lucide-react'

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function ExploreProfileCard() {
  const { user, profile } = useAuthStore()
  const { balances } = useCoins()
  const xpStore = useXPStore()
  const equippedFrame = useUserFrame(user?.id)

  const trollCoins = Number((balances as any)?.troll_coins ?? 0)
  const trollmonds = Number((profile as any)?.trollmonds ?? 0)
  const crowns = Number((profile as any)?.crowns ?? 0)
  const currentLevel = xpStore.level
  const displayName = profile?.display_name || profile?.username || 'Citizen'
  const avatarUrl = profile?.avatar_url

  const dateLine = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  if (!user) return null

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
        <Newspaper className="h-4 w-4 text-cyan-300" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80">
          Citizen Profile
        </span>
        <span className="ml-auto text-[9px] font-bold text-white/30">{dateLine}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative shrink-0 h-14 w-14 md:h-16 md:w-16">
          {avatarUrl ? (
            <ProfileFrame frame={equippedFrame} avatarUrl={avatarUrl} username={displayName} size="sm" fillParent />
          ) : (
            <div className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-lg font-black text-white ring-2 ring-cyan-400/50">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white md:text-base">{displayName}</p>
          <p className="text-[10px] font-bold text-cyan-300/80 md:text-xs">City Rank Lv. {currentLevel}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold md:text-xs">
            <span className="flex items-center gap-1 text-yellow-300">
              <Coins className="h-3 w-3" /> {formatCoins(trollCoins)}
            </span>
            <span className="flex items-center gap-1 text-purple-300">
              <Gem className="h-3 w-3" /> {formatCoins(trollmonds)}
            </span>
            {crowns > 0 && (
              <span className="flex items-center gap-1 text-amber-300">
                <Crown className="h-3 w-3" /> {crowns}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Link
          to={profile?.username ? `/profile/${profile.username}` : '/profile/setup'}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-cyan-400/30 hover:text-white"
        >
          View Full Profile
        </Link>
      </div>
    </div>
  )
}
