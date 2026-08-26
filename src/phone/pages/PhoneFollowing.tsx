import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { getTierFromXp, formatTierLabel, getLeagueTier } from '../../lib/leagueHelpers'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Radio,
  UserPlus,
  Users,
} from 'lucide-react'

interface FollowRow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
  following?: {
    id: string
    username: string | null
    avatar_url: string | null
    role: string | null
    tier: string | null
    total_xp: number | null
    is_live: boolean | null
    is_admin: boolean | null
  }
}

function computeLevelFromXp(totalXp: number) {
  let currLvl = 1
  let xpAccum = 0
  let xpNeeded = 100

  while (true) {
    if (currLvl < 50) {
      xpNeeded = Math.floor(100 * Math.pow(1.1, currLvl - 1))
    } else {
      xpNeeded = 10000
    }

    if (totalXp < xpAccum + xpNeeded) {
      return currLvl
    }

    xpAccum += xpNeeded
    currLvl++
    if (currLvl >= 10000) return currLvl
  }
}

export default function PhoneFollowing() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const [rows, setRows] = useState<FollowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')
  const [counts, setCounts] = useState({ following: 0, followers: 0 })

  const targetId = profile?.id

  const load = useCallback(async () => {
    try {
      setLoading(true)

      if (!targetId) {
        setLoading(false)
        return
      }

      if (activeTab === 'following') {
        const { data } = await supabase
          .from('user_follows')
          .select('*, following:user_profiles!user_follows_following_id_fkey(id, username, avatar_url, role, tier, total_xp, is_live, is_admin)')
          .eq('follower_id', targetId)
          .order('created_at', { ascending: false })
          .limit(100)

        setRows(data || [])
      } else {
        const { data } = await supabase
          .from('user_follows')
          .select('*, follower:user_profiles!user_follows_follower_id_fkey(id, username, avatar_url, role, tier, total_xp, is_live, is_admin)')
          .eq('following_id', targetId)
          .order('created_at', { ascending: false })
          .limit(100)

        const mapped = (data || []).map((r: any) => ({
          ...r,
          following: r.follower,
        })) as FollowRow[]

        setRows(mapped)
      }

      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', targetId)

      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', targetId)

      setCounts({
        following: followingCount || 0,
        followers: followersCount || 0,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [targetId, activeTab])

  useEffect(() => {
    load()
  }, [load])

  const handleUnfollow = async (id: string, username: string) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('id', id)

      if (error) throw error

      setRows((prev) => prev.filter((r) => r.id !== id))
      setCounts((prev) => ({ ...prev, following: Math.max(0, prev.following - 1) }))
      toast.success(`Unfollowed @${username}`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to unfollow user')
    }
  }

  const renderUserCard = (user: FollowRow['following'], createdAt: string, unfollowId?: string) => {
    if (!user) return null

    const totalXp = Math.max(0, Number(user.total_xp) || 0)
    const userLevel = computeLevelFromXp(totalXp)
    const tierLabel = formatTierLabel(getTierFromXp(totalXp))
    const leagueLabel = getLeagueTier(userLevel)

    return (
      <div
        className="
          relative overflow-hidden
          rounded-2xl
          border border-white/10
          bg-white/[0.03]
          p-4
          active:scale-[0.98]
          transition-all
        "
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => user.username && navigate(`/profile/${user.username}`)}
            className="relative shrink-0"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username || ''}
                className="h-12 w-12 rounded-full border-2 border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/10 bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-sm font-black text-white">
                {user.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            {user.is_live && (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border border-white">
                <Radio className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => user.username && navigate(`/profile/${user.username}`)}
                className="truncate text-sm font-black text-white"
              >
                @{user.username || 'unknown'}
              </button>
              {user.is_live && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-300 uppercase tracking-wider">
                  Live
                </span>
              )}
              {user.is_admin && (
                <span className="rounded-full bg-[#00BFFF]/20 px-2 py-0.5 text-[10px] font-black text-[#00BFFF] uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {user.role && (
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 capitalize">
                  {user.role.replace(/_/g, ' ')}
                </span>
              )}
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                Lvl {userLevel}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {tierLabel}
              </span>
            </div>

            <p className="mt-1 truncate text-[10px] text-white/30">
              {leagueLabel}
            </p>
          </div>

          {activeTab === 'following' && unfollowId && (
            <button
              type="button"
              onClick={() => handleUnfollow(unfollowId, user.username || '')}
              className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-300 active:scale-95"
            >
              Unfollow
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#05010f] text-white pb-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/10 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05010f]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Connections
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              {activeTab === 'following' ? 'Following' : 'Followers'}
            </p>
          </div>

          <div className="h-10 w-10" />
        </div>

        <div className="flex gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`flex-1 rounded-xl border py-2.5 text-[10px] font-black uppercase tracking-wider transition ${
              activeTab === 'following'
                ? 'border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]'
                : 'border-white/10 bg-white/[0.03] text-white/50'
            }`}
          >
            <UserPlus size={14} className="mr-1 inline" />
            Following ({counts.following})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('followers')}
            className={`flex-1 rounded-xl border py-2.5 text-[10px] font-black uppercase tracking-wider transition ${
              activeTab === 'followers'
                ? 'border-[#BF00FF]/30 bg-[#BF00FF]/10 text-[#BF00FF]'
                : 'border-white/10 bg-white/[0.03] text-white/50'
            }`}
          >
            <Users size={14} className="mr-1 inline" />
            Followers ({counts.followers})
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00BFFF] border-t-transparent" />
            <p className="mt-4 text-xs text-white/40">Loading connections...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={48} className="text-white/10" />
            <p className="mt-4 text-sm font-black text-white/40">
              No {activeTab === 'following' ? 'Following' : 'Followers'} Yet
            </p>
            <p className="mt-1 text-[10px] text-white/20">
              Start connecting with creators and citizens inside Mai Troll.
            </p>
          </div>
        ) : (
          rows.map((r) =>
            renderUserCard(
              r.following,
              r.created_at,
              activeTab === 'following' ? r.id : undefined,
            ),
          )
        )}
      </main>
    </div>
  )
}
