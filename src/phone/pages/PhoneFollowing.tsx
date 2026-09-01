
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase, UserProfile } from '../../lib/supabase'
import {
  getTierFromXp,
  formatTierLabel,
  getLeagueTier,
} from '../../lib/leagueHelpers'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Radio,
  UserPlus,
  Users,
  Shield,
  Crown,
} from 'lucide-react'

interface FollowRow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
  following?: UserProfile
  follower?: UserProfile
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

    if (currLvl >= 10000) {
      return currLvl
    }
  }
}

export default function PhoneFollowing() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const { userId, username } = useParams<{
    userId?: string
    username?: string
  }>()

  const [rows, setRows] = useState<FollowRow[]>([])
  const [followers, setFollowers] = useState<FollowRow[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<
    'following' | 'followers'
  >('following')

  const [counts, setCounts] = useState({
    following: 0,
    followers: 0,
  })

  const targetId = userId || profile?.id
  const targetUsername = username || profile?.username

  const load = useCallback(async () => {
    try {
      setLoading(true)

      let resolvedTargetId = targetId || null

      /*
       * Resolve /following/:userId where the param may actually
       * be a username.
       */
      if (
        userId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          userId,
        )
      ) {
        const { data: byUsername, error } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', userId)
          .maybeSingle()

        if (error) {
          console.error(
            '[PhoneFollowing] Username lookup failed:',
            error,
          )
        }

        resolvedTargetId = byUsername?.id || resolvedTargetId
      }

      /*
       * Resolve username route when no userId was supplied.
       */
      if (!resolvedTargetId && targetUsername) {
        const { data: profileByUsername, error } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', targetUsername)
          .maybeSingle()

        if (error) {
          console.error(
            '[PhoneFollowing] Profile lookup failed:',
            error,
          )
        }

        resolvedTargetId = profileByUsername?.id || null
      }

      if (!resolvedTargetId) {
        setRows([])
        setFollowers([])
        setCounts({
          following: 0,
          followers: 0,
        })

        toast.error('User not found')
        return
      }

      /*
       * IMPORTANT:
       * These queries intentionally match the working desktop
       * Following component.
       *
       * Do not restrict user_profiles to a partial column list.
       */

      const [
        followingResult,
        followersResult,
        followingCountResult,
        followersCountResult,
      ] = await Promise.all([
        supabase
          .from('user_follows')
          .select(
            '*, following:user_profiles!user_follows_following_id_fkey(*)',
          )
          .eq('follower_id', resolvedTargetId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('user_follows')
          .select(
            '*, follower:user_profiles!user_follows_follower_id_fkey(*)',
          )
          .eq('following_id', resolvedTargetId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('user_follows')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('follower_id', resolvedTargetId),

        supabase
          .from('user_follows')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('following_id', resolvedTargetId),
      ])

      /*
       * Surface actual Supabase errors instead of silently
       * turning them into empty lists.
       */

      if (followingResult.error) {
        console.error(
          '[PhoneFollowing] Following query failed:',
          followingResult.error,
        )
      }

      if (followersResult.error) {
        console.error(
          '[PhoneFollowing] Followers query failed:',
          followersResult.error,
        )
      }

      if (followingCountResult.error) {
        console.error(
          '[PhoneFollowing] Following count failed:',
          followingCountResult.error,
        )
      }

      if (followersCountResult.error) {
        console.error(
          '[PhoneFollowing] Followers count failed:',
          followersCountResult.error,
        )
      }

      setRows((followingResult.data || []) as FollowRow[])
      setFollowers((followersResult.data || []) as FollowRow[])

      setCounts({
        following: followingCountResult.count || 0,
        followers: followersCountResult.count || 0,
      })
    } catch (error) {
      console.error('[PhoneFollowing] Load failed:', error)

      setRows([])
      setFollowers([])

      toast.error('Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [targetId, targetUsername, userId])

  useEffect(() => {
    load()
  }, [load])

  const handleUnfollow = async (
    id: string,
    username: string,
  ) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('id', id)

      if (error) {
        console.error(
          '[PhoneFollowing] Unfollow failed:',
          error,
        )
        throw error
      }

      setRows((prev) =>
        prev.filter((row) => row.id !== id),
      )

      setCounts((prev) => ({
        ...prev,
        following: Math.max(0, prev.following - 1),
      }))

      toast.success(`Unfollowed @${username}`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to unfollow user')
    }
  }

  const renderUserCard = (
    user: UserProfile | undefined,
    createdAt: string,
    unfollowId?: string,
  ) => {
    if (!user) return null

    const totalXp = Math.max(
      0,
      Number(user.total_xp) || 0,
    )

    const userLevel = computeLevelFromXp(totalXp)
    const tierLabel = formatTierLabel(
      getTierFromXp(totalXp),
    )
    const leagueLabel = getLeagueTier(userLevel)

    const isGold =
      user.is_gold ||
      user.username_style === 'gold' ||
      user.badge === 'president'

    const isRgb =
      user.rgb_username_expires_at &&
      new Date(user.rgb_username_expires_at) > new Date()

    return (
      <div
        key={unfollowId || user.id}
        className="
          relative overflow-hidden
          rounded-2xl
          border border-cyan-500/20
          bg-gradient-to-br
          from-[#07111F]
          via-[#0A1224]
          to-[#070B14]
          p-4
          shadow-[0_0_25px_rgba(0,212,255,0.05)]
          active:scale-[0.98]
          transition-all
        "
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          {/* Avatar */}
          <button
            type="button"
            onClick={() =>
              user.username &&
              navigate(`/profile/${user.username}`)
            }
            className="relative shrink-0"
          >
            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl" />

            <img
              src={
                user.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`
              }
              alt={user.username || ''}
              className="
                relative
                h-12 w-12
                rounded-full
                border-2 border-cyan-400/50
                object-cover
              "
            />

            {user.is_live && (
              <div
                className="
                  absolute
                  -bottom-0.5
                  -right-0.5
                  flex h-4 w-4
                  items-center justify-center
                  rounded-full
                  border border-white
                  bg-red-500
                "
              >
                <Radio className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>

          {/* User information */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  user.username &&
                  navigate(`/profile/${user.username}`)
                }
                className={`
                  truncate
                  text-sm
                  font-black
                  tracking-wide
                  ${
                    isGold
                      ? 'text-yellow-300'
                      : isRgb
                        ? 'text-cyan-300'
                        : 'text-white'
                  }
                `}
              >
                @{user.username || 'unknown'}
              </button>

              {user.is_verified && (
                <span
                  className="
                    flex h-4 w-4
                    items-center justify-center
                    rounded-full
                    bg-cyan-500/20
                    border border-cyan-400/30
                  "
                >
                  <Shield className="h-2.5 w-2.5 text-cyan-300" />
                </span>
              )}

              {isGold && (
                <span
                  className="
                    flex h-4 w-4
                    items-center justify-center
                    rounded-full
                    bg-yellow-500/20
                    border border-yellow-400/30
                  "
                >
                  <Crown className="h-2.5 w-2.5 text-yellow-300" />
                </span>
              )}

              {user.is_live && (
                <span
                  className="
                    rounded-full
                    bg-red-500/20
                    px-2 py-0.5
                    text-[9px]
                    font-black
                    uppercase
                    tracking-wider
                    text-red-300
                  "
                >
                  Live
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {user.role && (
                <span
                  className="
                    rounded-full
                    bg-purple-500/10
                    px-2 py-0.5
                    text-[9px]
                    font-bold
                    capitalize
                    text-purple-300
                  "
                >
                  {user.role.replace(/_/g, ' ')}
                </span>
              )}

              <span
                className="
                  rounded-full
                  bg-cyan-500/10
                  px-2 py-0.5
                  text-[9px]
                  font-bold
                  text-cyan-300
                "
              >
                Lvl {userLevel}
              </span>

              <span
                className="
                  rounded-full
                  bg-emerald-500/10
                  px-2 py-0.5
                  text-[9px]
                  font-bold
                  text-emerald-300
                "
              >
                {tierLabel}
              </span>
            </div>

            <p className="mt-1 truncate text-[9px] text-white/30">
              {leagueLabel}
            </p>

            <p className="mt-0.5 text-[9px] text-white/20">
              Connected{' '}
              {new Date(createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Unfollow */}
          {activeTab === 'following' && unfollowId && (
            <button
              type="button"
              onClick={() =>
                handleUnfollow(
                  unfollowId,
                  user.username || '',
                )
              }
              className="
                shrink-0
                rounded-xl
                border border-red-500/30
                bg-red-500/10
                px-3 py-2
                text-[9px]
                font-black
                text-red-300
                active:scale-95
              "
            >
              Unfollow
            </button>
          )}
        </div>
      </div>
    )
  }

  const displayedRows =
    activeTab === 'following' ? rows : followers

  return (
    <div className="min-h-screen w-full bg-[#05010f] text-white pb-8">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/10 blur-[120px]" />

        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[120px]" />

        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header
        className="
          sticky top-0 z-50
          border-b border-white/10
          bg-[#05010f]/90
          backdrop-blur-2xl
        "
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border border-white/10
              bg-white/5
              active:scale-95
            "
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Connections
            </h1>

            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              {activeTab === 'following'
                ? 'Following'
                : 'Followers'}
            </p>
          </div>

          <div className="h-10 w-10" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`
              flex-1
              rounded-xl
              border
              py-2.5
              text-[10px]
              font-black
              uppercase
              tracking-wider
              transition-all
              ${
                activeTab === 'following'
                  ? 'border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]'
                  : 'border-white/10 bg-white/[0.03] text-white/50'
              }
            `}
          >
            <UserPlus
              size={14}
              className="mr-1 inline"
            />

            Following ({counts.following})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followers')}
            className={`
              flex-1
              rounded-xl
              border
              py-2.5
              text-[10px]
              font-black
              uppercase
              tracking-wider
              transition-all
              ${
                activeTab === 'followers'
                  ? 'border-[#BF00FF]/30 bg-[#BF00FF]/10 text-[#BF00FF]'
                  : 'border-white/10 bg-white/[0.03] text-white/50'
              }
            `}
          >
            <Users
              size={14}
              className="mr-1 inline"
            />

            Followers ({counts.followers})
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 space-y-3 px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="
                h-10 w-10
                animate-spin
                rounded-full
                border-2
                border-[#00BFFF]
                border-t-transparent
              "
            />

            <p className="mt-4 text-xs text-white/40">
              Loading connections...
            </p>
          </div>
        ) : displayedRows.length === 0 ? (
          <div
            className="
              flex flex-col
              items-center
              justify-center
              py-20
              text-center
            "
          >
            <Users
              size={48}
              className={
                activeTab === 'following'
                  ? 'text-[#00BFFF]/20'
                  : 'text-[#BF00FF]/20'
              }
            />

            <p className="mt-4 text-sm font-black text-white/40">
              No{' '}
              {activeTab === 'following'
                ? 'Following'
                : 'Followers'}{' '}
              Yet
            </p>

            <p className="mt-1 max-w-xs text-[10px] text-white/20">
              {activeTab === 'following'
                ? 'Start connecting with creators and citizens inside Mai Troll.'
                : 'Grow your audience through broadcasts, battles, and content across Mai Troll.'}
            </p>
          </div>
        ) : (
          displayedRows.map((row) =>
            renderUserCard(
              activeTab === 'following'
                ? row.following
                : row.follower,
              row.created_at,
              activeTab === 'following'
                ? row.id
                : undefined,
            ),
          )
        )}
      </main>
    </div>
  )
}
