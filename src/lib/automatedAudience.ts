import { supabase } from './supabase'

export type AudienceRequest =
  | { action: 'activate'; streamId: string }
  | { action: 'status' }
  | {
      action: 'configure'
      enabled: boolean
      chatMinIntervalMinutes: number
      chatMaxIntervalMinutes: number
      giftCooldownMinutes: number
    }
  | { action: 'session'; streamId: string; status: 'active' | 'paused' | 'stopped' }
  | { action: 'account'; accountId: string; enabled: boolean }

export async function requestAutomatedAudience<T = Record<string, unknown>>(
  request: AudienceRequest,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('automated-audience', {
    body: request,
  })

  if (error) {
    throw new Error(error.message || 'Automated audience request failed')
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Automated audience request was rejected')
  }

  return data as T
}

export function activateAutomatedAudience(streamId: string) {
  return requestAutomatedAudience({ action: 'activate', streamId })
}
