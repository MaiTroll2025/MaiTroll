import { supabase } from './supabase'
import { triggerMaiReaction } from './maiEngine'
import { calculateLevel, getXPForNextLevel } from './xp'

export type DnaEventType =
  | 'SENT_CHAOS_GIFT'
  | 'HELPED_SMALL_STREAMER'
  | 'WON_FAMILY_WAR'
  | 'LOST_FAMILY_WAR'
  | 'SILENT_WATCHER'
  | 'STREAM_EVENT'
  | 'PURCHASE_EVENT'
  | 'LEGACY_EVENT'
  | 'EPIC_GIFT_CHAOS'
  | 'HIGH_SPENDER'
  | 'PAYMENT_METHOD_LINKED'
  | 'STREAM_START'
  | 'WAR_BEGIN'
  | 'HIGH_SPENDER_EVENT'

export async function addXp(userId: string, amount: number, reason?: string) {
  // Skip for guest IDs
  if (!userId || userId.startsWith('TC-')) {
    console.log('Guest user detected, skipping XP add');
    return { data: null, error: null };
  }
  
  const { data, error } = await supabase.rpc('add_xp', { p_user_id: userId, p_amount: Math.max(0, Math.floor(amount)), p_reason: reason || null })

  // Family XP earning hook: Allocate XP to family stats
  if (data && amount > 0) {
    try {
      // Check if user is in a family
      const { data: familyMember } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .single()

      if (familyMember?.family_id) {
        const familyXpBonus = Math.floor(amount * 0.05) // 5% of earned XP goes to family
        if (familyXpBonus > 0) {
          // Use RPC function to atomically update family stats
          const { data: _familyResult, error: familyError } = await supabase.rpc('increment_family_stats', {
            p_family_id: familyMember.family_id,
            p_coin_bonus: 0,
            p_xp_bonus: parseInt(String(familyXpBonus))
          })

          if (familyError) {
            console.warn('Failed to update family stats for XP earning:', familyError)
          } else {
            console.log(`Allocated ${familyXpBonus} XP to family ${familyMember.family_id}`)
          }
        }

        // Track XP earning for family tasks
        try {
          const { trackXpEarning } = await import('./familyTasks')
          await trackXpEarning(userId, amount)
        } catch (taskErr) {
          console.warn('Failed to track XP earning for tasks:', taskErr)
        }

        // Track XP earning for active wars
        try {
          const { trackWarActivity } = await import('./familyWars')
          await trackWarActivity(userId, 'xp_earned', amount)
        } catch (warErr) {
          console.warn('Failed to track XP earning for wars:', warErr)
        }
      }
    } catch (familyErr) {
      console.warn('Family XP allocation failed:', familyErr)
      // Don't fail the main XP transaction for family allocation errors
    }
  }

  return { data, error }
}

export async function recordEvent(userId: string, eventType: DnaEventType, payload?: any) {
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload || {} })
  return { data, error }
}

export async function mutateDnaForUser(userId: string, eventType: DnaEventType, payload?: any) {
  return await recordEvent(userId, eventType, payload)
}

export async function recordAppEvent(userId: string, eventType: DnaEventType, metadata?: any) {
  const payload = metadata || {}
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload })
  try { await triggerMaiReaction(userId, eventType, payload) } catch {}
  return { data, error }
}

export function dnaClassFor(primary: string | null | undefined) {
  const key = String(primary || '').toUpperCase()
  if (key === 'CHAOS_DNA') return 'dna-chaos'
  if (key === 'MAD_TROLL_DNA') return 'dna-mad'
  if (key === 'GHOST_DNA') return 'dna-ghost'
  if (key === 'GUARDIAN_DNA') return 'dna-guardian'
  if (key === 'WARRIOR_DNA') return 'dna-warrior'
  if (key === 'LEGACY_DNA') return 'dna-legacy'
  if (key === 'GAMBLER_DNA') return 'dna-gambler'
  return ''
}

export async function currentIdentity(userId: string) {
  try {
    const { data: lvl, error: lvlError } = await supabase.from('user_stats').select('level, xp_total, xp_to_next_level, updated_at').eq('user_id', userId).maybeSingle()
    if (lvlError && lvlError.code !== 'PGRST116') {
      console.error('Error fetching user stats:', lvlError)
    }
    const { data: dna, error: dnaError } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
    if (dnaError && dnaError.code !== 'PGRST116') {
      console.error('Error fetching DNA profile:', dnaError)
    }
    
    // Calculate level info using the unified xp.ts functions
    const xpTotal = lvl?.xp_total || 0
    const level = calculateLevel(xpTotal)
    const { needed, percentage: _percentage } = getXPForNextLevel(xpTotal)
    const xpIntoLevel = needed > 0 ? xpTotal - (getXPForNextLevel(xpTotal - 1).current) : 0

    const levelData = {
      level: level,
      xp: xpIntoLevel,          // XP into current level (for progress bar)
      next_level_xp: needed     // XP needed for current level (for progress bar)
    }

    return { level: levelData, dna: dna || { primary_dna: null, traits: [] } }
  } catch (err) {
    console.error('Exception in currentIdentity:', err)
    return { level: { level: 1, xp: 0, next_level_xp: 100 }, dna: { primary_dna: null, traits: [] } }
  }
}

export async function getLevelProfile(userId: string) {
  try {
    const { data, error } = await supabase.from('user_stats').select('level, xp_total, xp_to_next_level, updated_at').eq('user_id', userId).maybeSingle()
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching level profile:', error)
    }
    if (data) {
      // Calculate level info using the unified xp.ts functions
      const xpTotal = data.xp_total || 0
      const level = calculateLevel(xpTotal)
      const { needed, percentage: _percentage } = getXPForNextLevel(xpTotal)
      const xpIntoLevel = needed > 0 ? Math.max(0, xpTotal - Math.max(0, xpTotal - needed)) : 0
      return {
        level: level,
        xp: xpIntoLevel,
        total_xp: xpTotal,
        next_level_xp: needed,
        remaining_xp: needed - xpIntoLevel,
        updated_at: data.updated_at || new Date().toISOString()
      }
    }
    return { level: 1, xp: 0, total_xp: 0, next_level_xp: 100, remaining_xp: 100, updated_at: new Date().toISOString() }
  } catch (err) {
    console.error('Exception in getLevelProfile:', err)
    return { level: 1, xp: 0, total_xp: 0, next_level_xp: 100, remaining_xp: 100, updated_at: new Date().toISOString() }
  }
}

export async function getDnaProfile(userId: string) {
  try {
    const { data, error } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching DNA profile:', error)
    }
    return data || { primary_dna: null, traits: [], aura_style: null, personality_scores: {}, evolution_score: 0 }
  } catch (err) {
    console.error('Exception in getDnaProfile:', err)
    return { primary_dna: null, traits: [], aura_style: null, personality_scores: {}, evolution_score: 0 }
  }
}

export async function getUserFullIdentity(userId: string) {
  const [lvl, dna, recentRes] = await Promise.all([
    getLevelProfile(userId),
    getDnaProfile(userId),
    supabase.from('troll_dna_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ])
  
  return { level: lvl, dna, events: recentRes.data || [] }
}
