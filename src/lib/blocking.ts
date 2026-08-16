import { supabase } from './supabase'

export interface BlockResult {
  success: boolean
  error?: string
}

export async function blockUser(blockerId: string, blockedId: string): Promise<BlockResult> {
  if (!blockerId || !blockedId) {
    return { success: false, error: 'Missing user identifiers' }
  }

  if (blockerId === blockedId) {
    return { success: false, error: 'Cannot block yourself' }
  }

  try {
    const { error } = await supabase
      .from('user_blocks')
      .upsert(
        {
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'blocker_id,blocked_id' },
      )

    if (error) {
      return { success: false, error: error.message }
    }

    await supabase
      .from('utromail_blocks')
      .upsert(
        {
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'blocker_id,blocked_id' },
      )

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to block user' }
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<BlockResult> {
  if (!blockerId || !blockedId) {
    return { success: false, error: 'Missing user identifiers' }
  }

  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)

    if (error) {
      return { success: false, error: error.message }
    }

    await supabase
      .from('utromail_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to unblock user' }
  }
}

export async function isBlocked(userId: string, otherUserId: string): Promise<boolean> {
  if (!userId || !otherUserId) return false
  if (userId === otherUserId) return false

  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
      .maybeSingle()

    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!userId) return []

  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)

    if (error || !data) return []
    return data.map((row: any) => row.blocked_id).filter(Boolean)
  } catch {
    return []
  }
}
