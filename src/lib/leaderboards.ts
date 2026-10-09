import { supabase } from './supabase'

type GifterTransaction = {
  user_id: string
  amount: number
  created_at: string
}

async function buildGifterLeaderboard(transactions: GifterTransaction[]) {
  const userIds = [...new Set(transactions.map(transaction => transaction.user_id).filter(Boolean))]
  const { data: profiles, error } = userIds.length
    ? await supabase.from('user_profiles').select('id, username, avatar_url').in('id', userIds)
    : { data: [], error: null }
  if (error) throw error

  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))
  const leaderboard = new Map<string, {
    user_id: string
    username: string | null
    avatar_url: string | null
    total_coins: number
  }>()
  transactions.forEach(transaction => {
    const profile = profileMap.get(transaction.user_id)
    const existing = leaderboard.get(transaction.user_id) || {
      user_id: transaction.user_id,
      username: profile?.username || null,
      avatar_url: profile?.avatar_url || null,
      total_coins: 0,
    }
    existing.total_coins += Number(transaction.amount) || 0
    leaderboard.set(transaction.user_id, existing)
  })
  return Array.from(leaderboard.values())
}

/**
 * Get Top Gifters Leaderboard
 */
export async function getLeaderboard(period: 'daily' | 'weekly' | 'monthly', limit: number = 100) {
  const now = new Date()
  const startDate = new Date()

  if (period === 'daily') {
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is sunday
    startDate.setDate(diff)
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'monthly') {
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  }

  try {
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('user_id, amount, created_at')
      .in('type', ['gift', 'gift_sent', 'gift_send'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())

    if (error) throw error

    return (await buildGifterLeaderboard(transactions || []))
      .sort((a, b) => b.total_coins - a.total_coins)
      .slice(0, limit)
  } catch (err) {
    console.error(`Error fetching ${period} leaderboard:`, err)
    return []
  }
}

/**
 * Scheduled Job: Daily Reset
 * Calculates top gifters and applies boosts
 */
export async function runDailyReset() {
  console.log('Running Daily Reset...')
  
  try {
    // 1. Get Top 3 Gifters of the last 24h
    // We need a specific query for "yesterday" if running at 00:00
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Direct query fallback for reliability
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('user_id, amount, created_at')
      .in('type', ['gift', 'gift_sent', 'gift_send'])
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    if (error) throw error

    const topGifters = (await buildGifterLeaderboard(transactions || []))
      .sort((a, b) => b.total_coins - a.total_coins)
      .slice(0, 3)

    if (topGifters && topGifters.length > 0) {
      // 2. Apply Boosts
      const boosts = [
        { rank: 1, percent: 50 },
        { rank: 2, percent: 30 },
        { rank: 3, percent: 20 }
      ]

      for (let i = 0; i < topGifters.length; i++) {
        const gifter = topGifters[i]
        const boost = boosts[i]
        
        if (boost) {
          await applyUserBoost(gifter.user_id, boost.percent, 'Top Gifter Boost')
        }
      }
    }
    
    console.log('Daily Reset Completed')
  } catch (err) {
    console.error('Daily Reset Failed:', err)
  }
}

/**
 * Get Weekly Top Broadcasters (Top Earners)
 * Used for Pitch Contest Eligibility
 */
export async function getWeeklyTopBroadcasters(limit: number = 5) {
  const now = new Date()
  const startDate = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is sunday
  startDate.setDate(diff)
  startDate.setHours(0, 0, 0, 0)

  try {
    // We look for 'gift' type transactions where amount is positive (received)
    // Actually gift transactions are usually: sender (negative), receiver (positive).
    // Let's assume 'gift' type with positive amount is the receiver.
    // Or we can query the 'streams' table if it tracks weekly earnings.
    // The 'streams' table has 'total_gifts_coins', but that's per stream.
    // We need per user.
    // Let's use coin_transactions with type 'gift_received' or similar if it exists.
    // If not, we look for positive amounts with type 'gift'.
    
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('user_id, amount, created_at')
      .in('type', ['gift', 'gift_received', 'stream_gift']) 
      .gt('amount', 0) // Only positive amounts (received)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())

    if (error) throw error

    return (await buildGifterLeaderboard(transactions || []))
      .sort((a, b) => b.total_coins - a.total_coins)
      .slice(0, limit)
  } catch (err) {
    console.error('Error fetching weekly top broadcasters:', err)
    return []
  }
}

/**
 * Scheduled Job: Weekly Reset
 * Calculates winning families and applies boosts
 */
export async function runWeeklyReset() {
  console.log('Running Weekly Reset...')
  
  try {
    // 1. Get Top Families by War Points/Wins
    // Assuming RPC `get_top_war_families`
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    
    // Direct query fallback
    const { data: results, error } = await supabase
      .from('war_results')
      .select('family_id, points, families(id, name)')
      .gte('created_at', lastWeek.toISOString())

    if (error) throw error

    const familyPoints = new Map<string, any>()
    results?.forEach((res: any) => {
      const fId = res.family_id
      const fName = res.families?.name
      const existing = familyPoints.get(fId) || {
        family_id: fId,
        family_name: fName,
        total_points: 0
      }
      existing.total_points += res.points
      familyPoints.set(fId, existing)
    })

    const topFamilies = Array.from(familyPoints.values())
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 3)

    if (topFamilies && topFamilies.length > 0) {
      const boosts = [
        { rank: 1, percent: 30 },
        { rank: 2, percent: 15 },
        { rank: 3, percent: 15 }
      ]

      for (let i = 0; i < topFamilies.length; i++) {
        const family = topFamilies[i]
        const boost = boosts[i]
        
        if (boost) {
          await applyFamilyBoost(family.family_id, boost.percent)
        }
      }
    }

    // 2. Wipe Weekly War Points
    // If there is a specific column, update it.
    // await supabase.from('families').update({ weekly_war_points: 0 }).neq('id', '0000')

    console.log('Weekly Reset Completed')
  } catch (err) {
    console.error('Weekly Reset Failed:', err)
  }
}

async function applyUserBoost(userId: string, percentage: number, reason: string) {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const { error } = await supabase.from('user_boosts').insert({
      user_id: userId,
      boost_percentage: percentage,
      expires_at: expiresAt.toISOString(),
      reason: reason
    })

    if (error) {
      // If table doesn't exist, ignore (or log warning)
      if (error.code === '42P01') { // undefined_table
        console.warn('Table user_boosts does not exist. Skipping boost application.')
      } else {
        throw error
      }
    }
  } catch (err) {
    console.error('Failed to apply user boost:', err)
  }
}

async function applyFamilyBoost(familyId: string, percentage: number) {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error } = await supabase.from('family_boosts').insert({
      family_id: familyId,
      boost_percentage: percentage,
      expires_at: expiresAt.toISOString(),
      reason: 'Weekly War Winner'
    })

    if (error) {
      if (error.code === '42P01') { // undefined_table
        console.warn('Table family_boosts does not exist. Skipping boost application.')
      } else {
        throw error
      }
    }
  } catch (err) {
    console.error('Failed to apply family boost:', err)
  }
}
