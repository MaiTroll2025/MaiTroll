import { supabase } from './supabase'

export interface CallPackage {
  id: string
  name: string
  minutes: number
  cost: number
  type: 'audio' | 'video'
}

export const CALL_PACKAGES: { audio: CallPackage[]; video: CallPackage[] } = {
  audio: [{ id: 'audio_30', name: '30 Minutes', minutes: 30, cost: 10, type: 'audio' }],
  video: [{ id: 'video_30', name: '30 Minutes', minutes: 30, cost: 10, type: 'video' }],
}

export async function purchaseCallMinutes(
  userId: string,
  pkg: CallPackage,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pkg || pkg.cost !== 10 || pkg.minutes !== 30 || !['audio', 'video'].includes(pkg.type)) {
      return { success: false, error: 'Invalid package' }
    }

    const { data, error } = await supabase.rpc('shop_buy_call_minutes', {
      p_user_id: userId,
      p_package_id: pkg.id,
      p_minutes: pkg.minutes,
      p_cost: pkg.cost,
      p_type: pkg.type,
      p_metadata: { package_id: pkg.id, package_name: pkg.name },
    })
    if (error) return { success: false, error: error.message }
    return data?.success
      ? { success: true }
      : { success: false, error: data?.error || 'Purchase failed' }
  } catch (error) {
    console.error('Purchase call minutes error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Purchase failed' }
  }
}
