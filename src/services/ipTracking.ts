import { supabase } from '@/lib/supabase'

const ANON_IP_KEY = 'tc-anonymous-ip'
const ANON_NAME_KEY = 'tc-anonymous-name'
const DEV_BYPASS_KEY = 'tc-dev-bypass'

export function isDevBypassEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(DEV_BYPASS_KEY) === 'true'
}

export function setDevBypass(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DEV_BYPASS_KEY, enabled ? 'true' : 'false')
}

export function getStoredAnonymousIP(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(ANON_IP_KEY)
}

export function storeAnonymousIP(ip: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ANON_IP_KEY, ip)
}

export function getStoredAnonymousName(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(ANON_NAME_KEY)
}

export function storeAnonymousName(name: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ANON_NAME_KEY, name)
}

export async function getCurrentIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    })
    const data = await response.json()
    return data.ip || null
  } catch {
    return null
  }
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_ip_blocked', {
      p_ip_address: ip,
    })

    if (error) {
      console.error('Error checking IP block:', error)
      return false
    }

    return Boolean(data)
  } catch {
    return false
  }
}

export async function isAnonArrested(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_anon_arrested', {
      p_ip_address: ip,
    })

    if (error) {
      console.error('Error checking anon arrest:', error)
      return false
    }

    return Boolean(data)
  } catch {
    return false
  }
}

export async function trackAnonymousViewer(params: {
  anonDisplayName: string
  ipAddress: string
  streamId?: string
  userAgent?: string
}): Promise<void> {
  try {
    await supabase.rpc('track_anonymous_viewer', {
      p_anon_display_name: params.anonDisplayName,
      p_ip_address: params.ipAddress,
      p_stream_id: params.streamId || null,
      p_user_agent: params.userAgent || null,
    })
  } catch (err) {
    console.error('Error tracking anonymous viewer:', err)
  }
}

export async function recordAnonymousArrest(params: {
  ipAddress?: string
  anonDisplayName?: string
  reason?: string
  severity?: string
  arrestedBy?: string
  durationMinutes?: number
}): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('record_anonymous_arrest', {
      p_ip_address: params.ipAddress || null,
      p_anon_display_name: params.anonDisplayName || null,
      p_reason: params.reason || 'Anonymous viewer violation',
      p_severity: params.severity || 'moderate',
      p_arrested_by: params.arrestedBy || null,
      p_duration_minutes: params.durationMinutes || 60,
    })

    if (error) {
      console.error('Error recording anonymous arrest:', error)
      return { success: false, message: error.message }
    }

    return data as { success: boolean; message: string }
  } catch (err: any) {
    console.error('Error recording anonymous arrest:', err)
    return { success: false, message: err.message }
  }
}

export async function checkAndAutoArrestNewAccount(
  userId: string,
  ipAddress: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('auto_arrest_new_account_on_ip', {
      p_user_id: userId,
      p_ip_address: ipAddress,
    })

    if (error) {
      console.error('Error checking auto-arrest:', error)
      return { success: false, message: error.message }
    }

    return data as { success: boolean; message: string }
  } catch (err: any) {
    console.error('Error checking auto-arrest:', err)
    return { success: false, message: err.message }
  }
}
