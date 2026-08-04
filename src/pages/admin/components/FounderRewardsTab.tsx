import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  Search, 
  Award, 
  Gift, 
  Star, 
  Rocket, 
  CheckCircle, 
  Loader2, 
  Shield,
  Crown,
  BadgeCheck,
  Sparkles,
  Users,
  Clock,
  AlertCircle
} from 'lucide-react'

interface TargetUser {
  id: string
  username: string
  display_name: string
  avatar_url: string
  role: string
  troll_coins: number
  is_banned?: boolean
}

interface RewardStatus {
  ceo_fam_badge: boolean
  agency_fee_waived: boolean
  early_supporter: boolean
  founder_status: boolean
}

interface GrantHistory {
  id: string
  reward_type: string
  target_username: string
  created_at: string
  admin_username: string
}

const REWARD_TYPES = [
  {
    id: 'ceo_fam_badge',
    label: '🏆 Exclusive CEO Fam Badge',
    description: 'Grants the legendary CEO Fam profile frame with golden crown animation',
    icon: Crown,
    color: 'amber',
    gradient: 'from-amber-500/20 to-yellow-500/20',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-200',
    iconBg: 'bg-amber-500/20',
  },
  {
    id: 'agency_fee_waived',
    label: '🎁 1 Free Agency Application Fee',
    description: 'Waives the agency application fee so the user can apply for free',
    icon: Gift,
    color: 'emerald',
    gradient: 'from-emerald-500/20 to-green-500/20',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-200',
    iconBg: 'bg-emerald-500/20',
  },
  {
    id: 'early_supporter',
    label: '⭐ Early Supporter Recognition',
    description: 'Grants Early Supporter badge displayed inside Mai Troll profile',
    icon: Star,
    color: 'blue',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-200',
    iconBg: 'bg-blue-500/20',
  },
  {
    id: 'founder_status',
    label: '🚀 Founder Status',
    description: 'Grants Founder status as one of the platform\'s first community members',
    icon: Rocket,
    color: 'purple',
    gradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-200',
    iconBg: 'bg-purple-500/20',
  },
]

export default function FounderRewardsTab() {
  const { user, profile } = useAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingUser, setLoadingUser] = useState(false)
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null)
  const [rewardStatus, setRewardStatus] = useState<RewardStatus | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [grantHistory, setGrantHistory] = useState<GrantHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const isAdmin = !!profile && (profile.role === 'admin' || profile.is_admin === true || profile.role === 'secretary')

  const fetchRewardStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, role, troll_coins, is_banned')
        .eq('id', userId)
        .single()

      if (error) throw error

      // Check current reward status from metadata or separate columns
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('founder_rewards')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (rewardsError && rewardsError.code !== 'PGRST116') {
        console.error('Error fetching rewards:', rewardsError)
      }

      // Also check user_profiles for legacy reward flags
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('metadata, early_supporter, founder_status, ceo_fam_badge, agency_fee_waived')
        .eq('id', userId)
        .single()

      const meta = (profileData?.metadata as Record<string, boolean>) || {}

      setRewardStatus({
        ceo_fam_badge: rewardsData?.ceo_fam_badge || profileData?.ceo_fam_badge || meta.ceo_fam_badge || false,
        agency_fee_waived: rewardsData?.agency_fee_waived || profileData?.agency_fee_waived || meta.agency_fee_waived || false,
        early_supporter: rewardsData?.early_supporter || profileData?.early_supporter || meta.early_supporter || false,
        founder_status: rewardsData?.founder_status || profileData?.founder_status || meta.founder_status || false,
      })

      setTargetUser({
        id: data.id,
        username: data.username,
        display_name: data.display_name || data.username,
        avatar_url: data.avatar_url || '',
        role: data.role,
        troll_coins: data.troll_coins || 0,
        is_banned: data.is_banned,
      })
    } catch (err) {
      console.error('Error fetching reward status:', err)
      toast.error('Failed to load user reward status')
    }
  }, [])

  const loadGrantHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('founder_rewards_grants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        // Table might not exist yet, that's okay
        if (error.code === '42P01') {
          setGrantHistory([])
          return
        }
        throw error
      }

      setGrantHistory(data || [])
    } catch (err) {
      console.error('Error loading grant history:', err)
      setGrantHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGrantHistory()
  }, [loadGrantHistory])

  const handleLookupUser = async () => {
    const query = searchTerm.trim()
    if (!query) {
      toast.error('Enter a username or user ID')
      return
    }

    setLoadingUser(true)
    setTargetUser(null)
    setRewardStatus(null)

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
      
      let queryBuilder = supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, role, troll_coins, is_banned')
      
      if (isUuid) {
        queryBuilder = queryBuilder.or(`id.eq.${query},username.ilike.%${query}%`)
      } else {
        queryBuilder = queryBuilder.ilike('username', `%${query}%`)
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error('No matching user found')
        return
      }

      const row = data[0] as any
      await fetchRewardStatus(row.id)
    } catch (err) {
      console.error('Failed to lookup user:', err)
      toast.error('Failed to lookup user')
    } finally {
      setLoadingUser(false)
    }
  }

  const handleGrantReward = async (rewardType: string) => {
    if (!targetUser || !user) {
      toast.error('Select a user first')
      return
    }

    if (rewardStatus?.[rewardType as keyof RewardStatus]) {
      toast.error('This reward is already granted to this user')
      return
    }

    const rewardInfo = REWARD_TYPES.find(r => r.id === rewardType)
    const confirm = window.confirm(`Grant "${rewardInfo?.label}" to @${targetUser.username}?`)
    if (!confirm) return

    setSubmitting(rewardType)
    try {
      // Use the admin-actions edge function for granting rewards
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'grant_founder_reward',
          targetUserId: targetUser.id,
          rewardType,
          adminId: user.id,
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(`Successfully granted ${rewardInfo?.label} to @${targetUser.username}`)
      
      // Refresh status
      await fetchRewardStatus(targetUser.id)
      await loadGrantHistory()
    } catch (err: any) {
      console.error('Error granting reward:', err)
      
      // Fallback: try direct database update if edge function doesn't exist yet
      try {
        const fallbackSuccess = await handleFallbackGrant(rewardType)
        if (fallbackSuccess) {
          toast.success(`Successfully granted ${rewardInfo?.label} to @${targetUser.username}`)
          await fetchRewardStatus(targetUser.id)
          await loadGrantHistory()
          return
        }
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr)
      }
      
      toast.error(err.message || 'Failed to grant reward')
    } finally {
      setSubmitting(null)
    }
  }

  const handleFallbackGrant = async (rewardType: string): Promise<boolean> => {
    if (!targetUser || !user || !profile) return false

    // Try to update user_profiles metadata
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('metadata')
      .eq('id', targetUser.id)
      .single()

    const currentMeta = (currentProfile?.metadata as Record<string, any>) || {}
    const updatedMeta = { ...currentMeta, [rewardType]: true }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ metadata: updatedMeta })
      .eq('id', targetUser.id)

    if (updateError) throw updateError

    // Log the grant
    const { error: logError } = await supabase
      .from('founder_rewards_grants')
      .insert({
        user_id: targetUser.id,
        reward_type: rewardType,
        admin_id: user.id,
        admin_username: profile.username || 'admin',
        target_username: targetUser.username,
      })

    // Ignore log error if table doesn't exist
    if (logError && logError.code !== '42P01') {
      console.warn('Could not log grant:', logError)
    }

    return true
  }

  const getRewardIcon = (rewardType: string) => {
    const reward = REWARD_TYPES.find(r => r.id === rewardType)
    if (!reward) return Award
    return reward.icon
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-lg">
          <Award className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Founder Rewards</h2>
          <p className="text-sm text-gray-400">Grant exclusive rewards to selected community members</p>
        </div>
      </div>

      {/* User Search */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400" />
          Look Up User
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookupUser()}
              placeholder="Enter username or user ID..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            {loadingUser && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-cyan-400" />
            )}
          </div>
          <button
            onClick={handleLookupUser}
            disabled={loadingUser}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-semibold text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {/* Target User & Rewards */}
      {targetUser && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
          {/* User Info */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
            <img
              src={targetUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.id}`}
              alt={targetUser.username}
              className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-white/20"
            />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                @{targetUser.username}
                {targetUser.role === 'admin' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">Admin</span>
                )}
              </h3>
              <p className="text-slate-400">{targetUser.display_name}</p>
              <p className="text-sm text-slate-500">Role: {targetUser.role || 'user'} • Coins: {targetUser.troll_coins?.toLocaleString()}</p>
            </div>
            {targetUser.is_banned && (
              <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium">
                Banned
              </div>
            )}
          </div>

          {/* Reward Cards */}
          <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Available Rewards
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REWARD_TYPES.map((reward) => {
              const isGranted = rewardStatus?.[reward.id as keyof RewardStatus] || false
              const isSubmitting = submitting === reward.id
              const Icon = reward.icon

              return (
                <div
                  key={reward.id}
                  className={`rounded-xl border ${reward.borderColor} bg-gradient-to-br ${reward.gradient} p-5 transition-all ${
                    isGranted ? 'opacity-75' : 'hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${reward.iconBg}`}>
                      <Icon className={`w-6 h-6 ${reward.textColor}`} />
                    </div>
                    <div className="flex-1">
                      <h5 className={`font-bold ${reward.textColor}`}>{reward.label}</h5>
                      <p className="text-sm text-slate-400 mt-1">{reward.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    {isGranted ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Granted
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Not yet granted</span>
                    )}
                    <button
                      onClick={() => handleGrantReward(reward.id)}
                      disabled={isGranted || isSubmitting || targetUser.is_banned}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                        isGranted
                          ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                          : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Granting...
                        </>
                      ) : isGranted ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Done
                        </>
                      ) : (
                        <>
                          <BadgeCheck className="w-4 h-4" />
                          Grant
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grant History */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          Recent Grants
        </h3>
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : grantHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No grants recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grantHistory.map((grant) => {
              const Icon = getRewardIcon(grant.reward_type)
              return (
                <div
                  key={grant.id}
                  className="flex items-center gap-4 rounded-lg border border-white/5 bg-black/20 p-4"
                >
                  <div className="p-2 rounded-lg bg-white/5">
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      <span className="font-semibold">@{grant.target_username}</span>
                      {' '}
                      <span className="text-slate-400">received</span>
                      {' '}
                      <span className="font-medium text-cyan-300">{grant.reward_type.replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      by @{grant.admin_username} • {new Date(grant.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-cyan-400 mt-0.5" />
          <div className="text-sm text-slate-400">
            <p className="font-medium text-cyan-300 mb-1">Secretary Access</p>
            <p>
              As a Secretary, you can grant these exclusive rewards to selected users. 
              Each reward can only be granted once per user. These rewards are intended 
              for early community members who helped build Mai Troll.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
