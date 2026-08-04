/**
 * Daily Reward System for Mai Troll
 * 
 * This system rewards:
 * - Broadcasters: 25 coins when they start a broadcast (once per day)
 * - Viewers: 10 coins when they join a live broadcast (once per day)
 * 
 * Rewards come from the Public Pool, not newly minted coins.
 */

import { supabase } from './supabase'
import { addCoins, recordCoinTransaction, type CoinTransactionType } from './coinTransactions'
import { createNotification } from './notifications'
import { loadSettings, useSetting } from './appSettingsStore'

// Types
export type RewardType = 'broadcaster_daily' | 'viewer_daily'

export interface DailyRewardResult {
  success: boolean
  rewardGiven: boolean
  amount: number
  message: string
  error?: string
}

export interface DailyRewardSettings {
  broadcasterRewardEnabled: boolean
  broadcasterRewardAmount: number
  broadcasterMinDurationSeconds: number
  viewerRewardEnabled: boolean
  viewerRewardAmount: number
  viewerMinStaySeconds: number
  viewerMinAccountAgeHours: number
  poolThreshold: number
  poolReductionPct: number
  failSafeMode: 'disable' | 'reduce'
}

// Setting keys (must match migration)
const SETTING_KEYS = {
  BROADCASTER_ENABLED: 'broadcaster_daily_reward_enabled',
  BROADCASTER_AMOUNT: 'broadcaster_daily_reward_amount',
  BROADCASTER_MIN_DURATION: 'broadcaster_reward_min_duration_seconds',
  VIEWER_ENABLED: 'viewer_daily_reward_enabled',
  VIEWER_AMOUNT: 'viewer_daily_reward_amount',
  VIEWER_MIN_STAY: 'viewer_reward_min_stay_seconds',
  VIEWER_MIN_ACCOUNT_AGE: 'viewer_reward_min_account_age_hours',
  POOL_THRESHOLD: 'daily_reward_pool_threshold',
  POOL_REDUCTION_PCT: 'daily_reward_pool_reduction_pct',
  FAIL_SAFE_MODE: 'daily_reward_fail_safe_mode'
} as const

// Default settings
const DEFAULT_SETTINGS: DailyRewardSettings = {
  broadcasterRewardEnabled: false,
  broadcasterRewardAmount: 0,
  broadcasterMinDurationSeconds: 60,
  viewerRewardEnabled: false,
  viewerRewardAmount: 0,
  viewerMinStaySeconds: 30,
  viewerMinAccountAgeHours: 24,
  poolThreshold: 10000,
  poolReductionPct: 50,
  failSafeMode: 'disable'
}

/**
 * Get all daily reward settings from app_settings
 */
export async function getDailyRewardSettings(): Promise<DailyRewardSettings> {
  try {
    const { data, error } = await supabase
      .from('admin_app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', Object.values(SETTING_KEYS))

    if (error) {
      console.error('Error loading daily reward settings:', error)
      return DEFAULT_SETTINGS
    }

    const settingsMap = new Map<string, any>()
    data?.forEach(row => {
      settingsMap.set(row.setting_key, row.setting_value)
    })

    return {
      broadcasterRewardEnabled: settingsMap.get(SETTING_KEYS.BROADCASTER_ENABLED) ?? DEFAULT_SETTINGS.broadcasterRewardEnabled,
      broadcasterRewardAmount: settingsMap.get(SETTING_KEYS.BROADCASTER_AMOUNT) ?? DEFAULT_SETTINGS.broadcasterRewardAmount,
      broadcasterMinDurationSeconds: settingsMap.get(SETTING_KEYS.BROADCASTER_MIN_DURATION) ?? DEFAULT_SETTINGS.broadcasterMinDurationSeconds,
      viewerRewardEnabled: settingsMap.get(SETTING_KEYS.VIEWER_ENABLED) ?? DEFAULT_SETTINGS.viewerRewardEnabled,
      viewerRewardAmount: settingsMap.get(SETTING_KEYS.VIEWER_AMOUNT) ?? DEFAULT_SETTINGS.viewerRewardAmount,
      viewerMinStaySeconds: settingsMap.get(SETTING_KEYS.VIEWER_MIN_STAY) ?? DEFAULT_SETTINGS.viewerMinStaySeconds,
      viewerMinAccountAgeHours: settingsMap.get(SETTING_KEYS.VIEWER_MIN_ACCOUNT_AGE) ?? DEFAULT_SETTINGS.viewerMinAccountAgeHours,
      poolThreshold: settingsMap.get(SETTING_KEYS.POOL_THRESHOLD) ?? DEFAULT_SETTINGS.poolThreshold,
      poolReductionPct: settingsMap.get(SETTING_KEYS.POOL_REDUCTION_PCT) ?? DEFAULT_SETTINGS.poolReductionPct,
      failSafeMode: settingsMap.get(SETTING_KEYS.FAIL_SAFE_MODE) ?? DEFAULT_SETTINGS.failSafeMode
    }
  } catch (error) {
    console.error('Error getting daily reward settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Check if user has already claimed a reward today
 */
export async function hasClaimedRewardToday(
  userId: string,
  rewardType: RewardType
): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const { data, error } = await supabase
      .from('daily_rewards')
      .select('id')
      .eq('user_id', userId)
      .eq('reward_type', rewardType)
      .eq('date', today)
      .maybeSingle()

    if (error) {
      console.error('Error checking daily reward:', error)
      return false // Allow on error to not block rewards
    }

    return !!data
  } catch (error) {
    console.error('Error checking daily reward claim:', error)
    return false
  }
}

/**
 * Get the Public Pool balance (admin pool coins)
 * The Public Pool is a system wallet that funds rewards
 */
export async function getPublicPoolBalance(): Promise<number> {
  try {
    // Check for admin_pool or create a system pool
    // For Mai Troll, we'll use a system-configured pool value
    // This could be stored in app_settings or a dedicated table
    
    const { data, error } = await supabase
      .from('admin_app_settings')
      .select('setting_value')
      .eq('setting_key', 'public_pool_balance')
      .maybeSingle()

    if (error || !data) {
      // Default pool balance if not configured
      return 1000000 // 1 million coins default
    }

    return parseInt(data.setting_value, 10) || 1000000
  } catch (error) {
    console.error('Error getting public pool balance:', error)
    return 1000000
  }
}

/**
 * Deduct from Public Pool and record the transaction
 */
export async function deductFromPublicPool(
  amount: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    const currentBalance = await getPublicPoolBalance()
    
    if (currentBalance < amount) {
      return { 
        success: false, 
        newBalance: currentBalance, 
        error: 'Public Pool insufficient funds' 
      }
    }

    // Deduct from pool (stored in app_settings for simplicity)
    const newBalance = currentBalance - amount
    
    const { error: updateError } = await supabase
      .from('admin_app_settings')
      .upsert({
        setting_key: 'public_pool_balance',
        setting_value: newBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' })

    if (updateError) {
      console.error('Error updating public pool balance:', updateError)
      return { success: false, newBalance: currentBalance, error: updateError.message }
    }

    // Never use a service role key from browser code. If RLS blocks this audit
    // row, the reward path should continue and server-side maintenance can
    // reconcile from admin_app_settings.
    await supabase
      .from('coin_transactions')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user ID
        amount: -amount,
        coin_delta: -amount,
        type: 'reward',
        coin_type: 'troll_coins',
        source_type: 'public_pool',
        source_id: metadata?.broadcast_id || null,
        description: `Daily reward payment: ${metadata?.reward_type}`,
        metadata: {
          ...metadata,
          pool_deduction: true,
          balance_after: newBalance
        },
        balance_after: newBalance,
        created_at: new Date().toISOString()
      })

    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Error deducting from public pool:', error)
    return { success: false, newBalance: 0, error: error.message }
  }
}

/**
 * Check if account meets minimum age requirement
 */
export async function checkAccountAge(
  userId: string,
  minAgeHours: number
): Promise<{ meetsRequirement: boolean; accountAgeHours: number }> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('created_at')
      .eq('id', userId)
      .single()

    if (error || !profile?.created_at) {
      // If we can't determine, assume old enough (generous)
      return { meetsRequirement: true, accountAgeHours: Infinity }
    }

    const createdAt = new Date(profile.created_at)
    const now = new Date()
    const ageMs = now.getTime() - createdAt.getTime()
    const ageHours = ageMs / (1000 * 60 * 60)

    return {
      meetsRequirement: ageHours >= minAgeHours,
      accountAgeHours: Math.floor(ageHours)
    }
  } catch (error) {
    console.error('Error checking account age:', error)
    // Default to true on error
    return { meetsRequirement: true, accountAgeHours: Infinity }
  }
}

/**
 * Record a daily reward claim in the database
 */
export async function recordDailyReward(
  userId: string,
  rewardType: RewardType,
  broadcastId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { error: insertError } = await supabase
      .from('daily_rewards')
      .insert({
        user_id: userId,
        reward_type: rewardType,
        date: today,
        broadcast_id: broadcastId,
        amount: amount,
        source: 'public_pool',
        created_at: new Date().toISOString()
      })

    if (insertError) {
      // Check for unique constraint violation (already claimed)
      if (insertError.code === '23505') {
        return { success: false, error: 'Reward already claimed today' }
      }
      console.error('Error recording daily reward:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error recording daily reward:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Calculate the effective reward amount based on pool status
 */
export async function calculateEffectiveRewardAmount(
  rewardType: RewardType
): Promise<{ amount: number; isReduced: boolean }> {
  const settings = await getDailyRewardSettings()
  const poolBalance = await getPublicPoolBalance()

  // Get base amount based on reward type
  const baseAmount = rewardType === 'broadcaster_daily' 
    ? settings.broadcasterRewardAmount 
    : settings.viewerRewardAmount

  // Check if pool is below threshold
  if (poolBalance >= settings.poolThreshold) {
    return { amount: baseAmount, isReduced: false }
  }

  // Pool is low - apply fail-safe
  if (settings.failSafeMode === 'disable') {
    return { amount: 0, isReduced: true }
  }

  // Reduce amount by percentage
  const reductionFactor = settings.poolReductionPct / 100
  const reducedAmount = Math.floor(baseAmount * (1 - reductionFactor))
  
  return { 
    amount: Math.max(1, reducedAmount), // At least 1 coin
    isReduced: true 
  }
}

/**
 * Send reward notification to user
 */
export async function sendRewardNotification(
  userId: string,
  rewardType: RewardType,
  amount: number
): Promise<void> {
  const isBroadcaster = rewardType === 'broadcaster_daily'
  
  const title = isBroadcaster 
    ? '🎉 Creator Reward' 
    : '🎉 Daily Reward'
  
  const message = isBroadcaster
    ? `You earned ${amount} coins for going live today!`
    : `You earned ${amount} coins for joining a live!`

  const metadata = {
    reward_type: rewardType,
    amount: amount,
    source: 'MaiTroll Public Pool',
    action_url: '/wallet'
  }

  await createNotification(
    userId,
    'system_announcement',
    title,
    `${message}\n\nSource: Mai Troll Public Pool`,
    metadata
  )
}

/**
 * Main function to issue a daily reward
 * This is the core logic that handles all the checks and rewards
 */
export async function issueDailyReward(
  userId: string,
  rewardType: RewardType,
  broadcastId: string,
  additionalCheck?: () => Promise<{ passed: boolean; reason?: string }>
): Promise<DailyRewardResult> {
  try {
    // 1. Get settings
    const settings = await getDailyRewardSettings()

    // 2. Check if reward type is enabled
    const isBroadcaster = rewardType === 'broadcaster_daily'
    const isEnabled = isBroadcaster 
      ? settings.broadcasterRewardEnabled 
      : settings.viewerRewardEnabled

    if (!isEnabled) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: `${rewardType} rewards are currently disabled`
      }
    }

    // 3. Check if already claimed today
    const hasClaimed = await hasClaimedRewardToday(userId, rewardType)
    if (hasClaimed) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'You have already claimed your daily reward'
      }
    }

    // 4. Run additional checks (e.g., account age, duration)
    if (additionalCheck) {
      const checkResult = await additionalCheck()
      if (!checkResult.passed) {
        return {
          success: true,
          rewardGiven: false,
          amount: 0,
          message: checkResult.reason || 'Additional check failed'
        }
      }
    }

    // 5. Calculate effective reward amount (considering pool status)
    const { amount, isReduced } = await calculateEffectiveRewardAmount(rewardType)
    
    if (amount <= 0) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'Rewards temporarily disabled due to low pool balance'
      }
    }

    // 6. Deduct from Public Pool
    const poolResult = await deductFromPublicPool(amount, {
      user_id: userId,
      reward_type: rewardType,
      broadcast_id: broadcastId,
      is_reduced: isReduced
    })

    if (!poolResult.success) {
      return {
        success: false,
        rewardGiven: false,
        amount: 0,
        message: 'Failed to deduct from pool: ' + poolResult.error,
        error: poolResult.error
      }
    }

    // 7. Add coins to user balance
    const addCoinsResult = await addCoins({
      userId,
      amount,
      type: 'reward',
      description: `${rewardType} reward`,
      sourceId: broadcastId,
      metadata: {
        reward_type: rewardType,
        source: 'public_pool',
        broadcast_id: broadcastId,
        is_reduced: isReduced
      }
    })

    if (!addCoinsResult.success) {
      // Rollback pool deduction
      await deductFromPublicPool(-amount, {
        user_id: userId,
        reward_type: rewardType,
        broadcast_id: broadcastId,
        rollback: true
      })
      
      return {
        success: false,
        rewardGiven: false,
        amount: 0,
        message: 'Failed to add coins to user: ' + addCoinsResult.error,
        error: addCoinsResult.error
      }
    }

    // 8. Record the reward claim
    await recordDailyReward(userId, rewardType, broadcastId, amount)

    // 9. Send notification
    await sendRewardNotification(userId, rewardType, amount)

    const reducedMsg = isReduced ? ' (reduced due to low pool)' : ''
    
    return {
      success: true,
      rewardGiven: true,
      amount,
      message: `Successfully issued ${amount} coin reward${reducedMsg}`
    }

  } catch (error: any) {
    console.error('Error issuing daily reward:', error)
    return {
      success: false,
      rewardGiven: false,
      amount: 0,
      message: 'An unexpected error occurred',
      error: error.message
    }
  }
}

/**
 * Get daily reward statistics (for admin)
 */
export async function getDailyRewardStats(
  startDate?: string,
  endDate?: string
): Promise<{
  totalRewards: number
  totalCoins: number
  broadcasterRewards: number
  viewerRewards: number
  recentRewards: Array<{
    user_id: string
    reward_type: string
    amount: number
    created_at: string
  }>
}> {
  try {
    let query = supabase
      .from('daily_rewards')
      .select('user_id, reward_type, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const rewards = data || []
    const totalCoins = rewards.reduce((sum, r) => sum + (r.amount || 0), 0)
    const broadcasterRewards = rewards.filter(r => r.reward_type === 'broadcaster_daily').length
    const viewerRewards = rewards.filter(r => r.reward_type === 'viewer_daily').length

    return {
      totalRewards: rewards.length,
      totalCoins,
      broadcasterRewards,
      viewerRewards,
      recentRewards: rewards
    }
  } catch (error) {
    console.error('Error getting daily reward stats:', error)
    return {
      totalRewards: 0,
      totalCoins: 0,
      broadcasterRewards: 0,
      viewerRewards: 0,
      recentRewards: []
    }
  }
}
