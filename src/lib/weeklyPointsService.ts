import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export type WeeklyPointAction = 'share' | 'follow' | 'invite' | 'gift'

export interface WeeklyLeaderboardRow {
  rank: number
  user_id: string
  username: string | null
  avatar_url: string | null
  display_name: string | null
  total_points: number
  base_points: number
  multiplier: number
  sent_troll_coin_gift: boolean
}

export interface WeeklyUserSummary {
  success: boolean
  week_id: string
  user_id: string
  rank: number | null
  base_points: number
  total_points: number
  multiplier: number
  sent_troll_coin_gift: boolean
  actions: {
    share: boolean
    follow: boolean
    invite: boolean
    gift: boolean
  }
  message?: string
}

export interface WeeklyAwardResult {
  success: boolean
  week_id?: string
  action?: string
  duplicate?: boolean
  awarded?: number
  multiplier?: number
  total_points?: number
  message?: string
}

export interface WeeklyWeekDates {
  week_id: string
  week_start: string
  week_end: string
  is_current: boolean
}

const ACTION_POINTS: Record<WeeklyPointAction, number> = {
  share: 5,
  follow: 1,
  invite: 1,
  gift: 1,
}

const WEEKLY_POINTS_ENABLED_KEY = 'weekly_points_enabled'

export function isWeeklyPointsEnabled(): boolean {
  try {
    return localStorage.getItem(WEEKLY_POINTS_ENABLED_KEY) !== 'disabled'
  } catch {
    return true
  }
}

export function setWeeklyPointsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(WEEKLY_POINTS_ENABLED_KEY, enabled ? 'enabled' : 'disabled')
  } catch {}
}

export async function getCurrentWeekId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('weekly_get_current_week')
    if (error) throw error
    return (data as unknown as string) ?? null
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to fetch current week id:', err?.message || err)
    return null
  }
}

export async function getWeekDates(weekId?: string): Promise<WeeklyWeekDates | null> {
  try {
    const { data, error } = await supabase.rpc('weekly_get_week_dates', {
      p_week_id: weekId ?? null,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return row as unknown as WeeklyWeekDates
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to fetch week dates:', err?.message || err)
    return null
  }
}

export async function getWeeklyLeaderboard(
  weekId?: string,
  limit: number = 100
): Promise<WeeklyLeaderboardRow[]> {
  try {
    const { data, error } = await supabase.rpc('weekly_get_leaderboard', {
      p_week_id: weekId ?? null,
      p_limit: limit,
    })
    if (error) throw error
    return (Array.isArray(data) ? data : []) as unknown as WeeklyLeaderboardRow[]
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to fetch leaderboard:', err?.message || err)
    return []
  }
}

export async function getCurrentUserSummary(weekId?: string): Promise<WeeklyUserSummary | null> {
  const { user } = useAuthStore.getState()
  if (!user) return null

  try {
    const { data, error } = await supabase.rpc('weekly_get_user_summary', {
      p_week_id: weekId ?? null,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return row as unknown as WeeklyUserSummary
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to fetch user summary:', err?.message || err)
    return null
  }
}

export async function awardPoint(action: WeeklyPointAction): Promise<WeeklyAwardResult> {
  const { user } = useAuthStore.getState()
  if (!user) {
    return { success: false, message: 'You must be logged in to earn points' }
  }
  if (!isWeeklyPointsEnabled()) {
    return { success: false, message: 'Weekly points are disabled', week_id: undefined }
  }

  const basePoints = ACTION_POINTS[action] ?? 0

  try {
    const { data, error } = await supabase.rpc('weekly_award_point', {
      p_action: action,
      p_base_points: basePoints,
    })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    const result = row as unknown as WeeklyAwardResult

    if (result.success && !result.duplicate) {
      if (action === 'share') {
        toast.success(`+${result.awarded} Weekly 🌟 Share bonus`)
      } else if (action === 'follow') {
        toast.success(`+${result.awarded} Weekly 📌 Follow`)
      } else if (action === 'invite') {
        toast.success(`+${result.awarded} Weekly ✉️ Invite`)
      }
    } else if (result.duplicate) {
      // Idempotent re-award: silent, user already has the points for this action.
      return result
    }

    return result
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to award point:', err?.message || err)
    return { success: false, message: err?.message || 'Failed to award point' }
  }
}

export async function awardSharePoint(): Promise<WeeklyAwardResult> {
  return awardPoint('share')
}

export async function awardFollowPoint(): Promise<WeeklyAwardResult> {
  return awardPoint('follow')
}

export async function awardInvitePoint(): Promise<WeeklyAwardResult> {
  return awardPoint('invite')
}

export async function awardGiftPoint(): Promise<WeeklyAwardResult> {
  const { user } = useAuthStore.getState()
  if (!user) {
    return { success: false, message: 'You must be logged in to earn points' }
  }
  if (!isWeeklyPointsEnabled()) {
    return { success: false, message: 'Weekly points are disabled' }
  }
  try {
    const { data, error } = await supabase.rpc('weekly_record_gift', {
      p_user_id: user.id,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return row as unknown as WeeklyAwardResult
  } catch (err: any) {
    console.warn('[WeeklyPoints] failed to award gift point:', err?.message || err)
    return { success: false, message: err?.message || 'Failed to award gift point' }
  }
}
