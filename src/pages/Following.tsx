import React, { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, UserProfile } from '../lib/supabase'
import { getGlowingTextStyle } from '../lib/perkEffects'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'
import {
  Users,
  UserPlus,
  Sparkles,
  Shield,
  Crown,
  ArrowLeft,
  Radio,
} from 'lucide-react'

interface FollowRow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
  following?: UserProfile
  follower?: UserProfile
}

export default function Following() {
  const { userId } = useParams()
  const { profile } = useAuthStore()

  const [rows, setRows] = useState<FollowRow[]>([])
  const [followers, setFollowers] = useState<FollowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')

  const targetId = userId || profile?.id
  const isOwnProfile = profile?.id === targetId

  const load = useCallback(async () => {
    try {
      setLoading(true)

      if (!targetId) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_follows')
        .select('*, following:user_profiles!user_follows_following_id_fkey(*)')
        .eq('follower_id', targetId)
        .order('created_at', { ascending: false })
        .limit(100)

      setRows(data || [])

      const { data: followerRows } = await supabase
        .from('user_follows')
        .select('*, follower:user_profiles!user_follows_follower_id_fkey(*)')
        .eq('following_id', targetId)
        .order('created_at', { ascending: false })
        .limit(100)

      const mappedFollowers = (followerRows || []).map((r: any) => ({
        ...r,
        follower: r.follower,
      })) as FollowRow[]

      setFollowers(mappedFollowers)
    } finally {
      setLoading(false)
    }
  }, [targetId])

  useEffect(() => {
    load()
  }, [load])

  const handleUnfollow = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to unfollow @${username}?`)) return

    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('id', id)

      if (error) throw error

      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success(`Unfollowed @${username}`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to unfollow user')
    }
  }

  const renderUserCard = (
    user: any,
    createdAt: string,
    unfollowId?: string
  ) => {
    const isGold =
      user?.is_gold ||
      user?.username_style === 'gold' ||
      user?.badge === 'president'

    const hasRgb =
      user?.rgb_username_expires_at &&
      new Date(user.rgb_username_expires_at) > new Date()

    let usernameClass =
      'text-lg font-black tracking-wide transition-all duration-300'

    let usernameStyle = {}

    if (isGold) {
      usernameClass += ' gold-username'
    } else if (hasRgb) {
      usernameClass += ' rgb-username'
    } else if (user?.glowing_username_color) {
      usernameStyle = getGlowingTextStyle(user.glowing_username_color)
    }

    return (
      <div
        key={unfollowId || user?.id}
        className="
          relative overflow-hidden
          rounded-3xl
          border border-cyan-500/20
          bg-gradient-to-br from-[#070B14] via-[#0B1020] to-[#06070D]
          backdrop-blur-2xl
          hover:border-cyan-400/60
          transition-all duration-300
          group
        "
      >
        {/* Glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.18),transparent_60%)]" />

        {/* Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative z-10 p-5">
          <div className="flex items-start justify-between gap-4">
            <Link
              to={`/profile/${user?.username}`}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-xl animate-pulse" />

                <img
                  src={
                    user?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`
                  }
                  alt={user?.username || ''}
                  className="
                    relative
                    w-16 h-16
                    rounded-full
                    border-2 border-cyan-400/60
                    object-cover
                    shadow-[0_0_25px_rgba(0,212,255,0.35)]
                  "
                />

                {user?.is_live && (
                  <div className="absolute -bottom-1 -right-1 bg-red-500 border border-white rounded-full p-1">
                    <Radio className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className={usernameClass}
                    style={usernameStyle}
                  >
                    @{user?.username}
                  </div>

                  {user?.is_verified && (
                    <div className="bg-cyan-500/20 border border-cyan-400/30 rounded-full p-1">
                      <Shield className="w-3 h-3 text-cyan-300" />
                    </div>
                  )}

                  {isGold && (
                    <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-full p-1">
                      <Crown className="w-3 h-3 text-yellow-300" />
                    </div>
                  )}
                </div>

                {user?.bio && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {user.bio}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <div className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
                    Troll Citizen
                  </div>

                  <div className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-semibold">
                    Connected {new Date(createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>

            {isOwnProfile && unfollowId && (
              <button
                onClick={() =>
                  handleUnfollow(unfollowId, user?.username || '')
                }
                className="
                  px-4 py-2
                  rounded-2xl
                  border border-red-500/30
                  bg-red-500/10
                  text-red-300
                  text-sm font-bold
                  hover:bg-red-500/20
                  hover:border-red-400/60
                  transition-all
                "
              >
                Unfollow
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050816] text-white relative">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_35%)]" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={profile?.username ? `/profile/${profile.username}` : '/'}
            className="
              inline-flex items-center gap-2
              text-cyan-300 hover:text-cyan-200
              mb-6
              transition-colors
            "
          >
            <ArrowLeft className="w-4 h-4" />
            Back To Profile
          </Link>

          <div
            className="
              relative overflow-hidden
              rounded-[32px]
              border border-cyan-500/20
              bg-gradient-to-br from-[#07111F] via-[#0A1224] to-[#070B14]
              p-8 md:p-10
              shadow-[0_0_50px_rgba(0,212,255,0.12)]
            "
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.18),transparent_45%)]" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                    <Users className="w-7 h-7 text-cyan-300" />
                  </div>

                  <div>
                    <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                      Social Network
                    </h1>

                    <p className="text-gray-400 mt-2">
                      Manage your Mai Troll connections and followers
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap mt-6">
                  <button
                    onClick={() => setActiveTab('following')}
                    className={`
                      px-6 py-3 rounded-2xl font-bold transition-all duration-300
                      flex items-center gap-2
                      ${
                        activeTab === 'following'
                          ? 'bg-cyan-500 text-black shadow-[0_0_30px_rgba(0,212,255,0.5)]'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:border-cyan-500/40 hover:text-cyan-300'
                      }
                    `}
                  >
                    <UserPlus className="w-4 h-4" />
                    Following
                    <span className="ml-1 text-xs opacity-80">
                      ({rows.length})
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('followers')}
                    className={`
                      px-6 py-3 rounded-2xl font-bold transition-all duration-300
                      flex items-center gap-2
                      ${
                        activeTab === 'followers'
                          ? 'bg-cyan-500 text-black shadow-[0_0_30px_rgba(0,212,255,0.5)]'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:border-cyan-500/40 hover:text-cyan-300'
                      }
                    `}
                  >
                    <Sparkles className="w-4 h-4" />
                    Followers
                    <span className="ml-1 text-xs opacity-80">
                      ({followers.length})
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-[260px]">
                <div className="rounded-2xl border border-cyan-500/20 bg-black/20 p-5">
                  <div className="text-gray-400 text-sm mb-2">
                    Following
                  </div>
                  <div className="text-3xl font-black text-cyan-300">
                    {rows.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-black/20 p-5">
                  <div className="text-gray-400 text-sm mb-2">
                    Followers
                  </div>
                  <div className="text-3xl font-black text-purple-300">
                    {followers.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div
            className="
              rounded-[32px]
              border border-cyan-500/20
              bg-gradient-to-br from-[#07111F] via-[#0A1224] to-[#070B14]
              p-16
              text-center
            "
          >
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
              <div className="absolute inset-0 rounded-full border-t-4 border-cyan-400 animate-spin" />
            </div>

            <h2 className="text-2xl font-black text-cyan-300 mb-2">
              Loading Connections
            </h2>

            <p className="text-gray-400">
              Syncing Mai Troll network...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'following' ? (
              rows.length === 0 ? (
                <div
                  className="
                    rounded-[32px]
                    border border-white/10
                    bg-white/[0.03]
                    p-16
                    text-center
                  "
                >
                  <Users className="w-16 h-16 text-cyan-400 mx-auto mb-6" />

                  <h2 className="text-3xl font-black mb-3">
                    No Following Yet
                  </h2>

                  <p className="text-gray-400 max-w-md mx-auto">
                    Start connecting with creators, broadcasters, and citizens
                    inside Mai Troll.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {rows.map((r) =>
                    renderUserCard(
                      r.following,
                      r.created_at,
                      r.id
                    )
                  )}
                </div>
              )
            ) : followers.length === 0 ? (
              <div
                className="
                  rounded-[32px]
                  border border-white/10
                  bg-white/[0.03]
                  p-16
                  text-center
                "
              >
                <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-6" />

                <h2 className="text-3xl font-black mb-3">
                  No Followers Yet
                </h2>

                <p className="text-gray-400 max-w-md mx-auto">
                  Grow your audience through broadcasts, battles, and content
                  across Mai Troll.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {followers.map((r) =>
                  renderUserCard(
                    r.follower,
                    r.created_at
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}