import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function invokeSlaMonitor(body: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!SUPABASE_URL) {
    return { ok: false, error: 'Missing VITE_SUPABASE_URL' }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  const url = `${SUPABASE_URL}/functions/v1/sla-monitor`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const responseData = await res.json().catch(() => null)

  if (!res.ok) {
    return {
      ok: false,
      error: (responseData as any)?.error || `Edge Function returned ${res.status}`,
    }
  }

  return { ok: true, data: responseData }
}

export type SlaTierName = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

export interface StreamSlaStatus {
  stream_id: string
  sla_tier: SlaTierName
  sla_target_uptime_pct: number
  sla_actual_uptime_pct: number
  sla_quality_guarantee: string
  sla_min_bitrate_kbps: number
  sla_max_latency_ms: number
  sla_started_at: string | null
  sla_uptime_seconds: number
  sla_downtime_seconds: number
  sla_quality_issues_count: number
  is_live: boolean
  viewer_count: number
  violation_count: number
}

export interface SubscriptionSlaStatus {
  subscription_id: string
  tier_name: string
  tier_color_hex: string
  tier_icon_name: string
  sla_uptime_guarantee_pct: number
  sla_quality_guarantee: string
  sla_chat_priority: 'standard' | 'priority' | 'vip_only'
  sla_support_response_secs: number
  sla_features: string[]
  sla_status: string
  sla_uptime_pct: number
  sla_compensation_coins: number
  sla_violation_count: number
  sla_start_time: string | null
  sla_end_time: string | null
  priority_chat: boolean
  display_name: string
}

export interface BroadcasterSlaSummary {
  broadcaster_id: string
  total_streams: number
  sla_compliant_streams: number
  avg_uptime_pct: number
  total_violations: number
  active_subscribers: number
  total_subscriber_revenue: number
  current_sla_tier: SlaTierName
  next_tier_uptime_threshold: number
  coins_to_next_tier: number
}

export interface SlaViolation {
  id: string
  stream_id: string | null
  violation_type: string
  tier_at_time: string
  actual_value: Record<string, unknown>
  expected_value: Record<string, unknown>
  compensation_coins: number
  compensation_issued: boolean
  resolved: boolean
  notes: string
  created_at: string
}

export const SLA_TIER_CONFIG: Record<SlaTierName, {
  label: string
  color: string
  glow: string
  minUptime: number
}> = {
  none: { label: 'No SLA', color: '#6B7280', glow: 'rgba(107,114,128,0.3)', minUptime: 0 },
  bronze: { label: 'Bronze', color: '#CD7F32', glow: 'rgba(205,127,50,0.3)', minUptime: 95.0 },
  silver: { label: 'Silver', color: '#C0C0C0', glow: 'rgba(192,192,192,0.3)', minUptime: 99.0 },
  gold: { label: 'Gold', color: '#FFD700', glow: 'rgba(255,215,0,0.3)', minUptime: 99.9 },
  platinum: { label: 'Platinum', color: '#E5E4E2', glow: 'rgba(229,228,226,0.3)', minUptime: 99.95 },
}

export const SUBSCRIBER_TIER_SLA: Record<string, {
  uptimeGuarantee: number
  qualityGuarantee: string
  chatPriority: 'standard' | 'priority' | 'vip_only'
  supportResponseSecs: number
  features: string[]
}> = {
  'Fan': {
    uptimeGuarantee: 99.0,
    qualityGuarantee: '720p',
    chatPriority: 'standard',
    supportResponseSecs: 14400,
    features: ['Subscriber badge', 'Subscriber chat indicator'],
  },
  'VIP': {
    uptimeGuarantee: 99.5,
    qualityGuarantee: '720p',
    chatPriority: 'priority',
    supportResponseSecs: 3600,
    features: ['Subscriber badge', 'Chat highlight', 'Custom emotes', 'Priority chat'],
  },
  'Elite': {
    uptimeGuarantee: 99.9,
    qualityGuarantee: '1080p',
    chatPriority: 'priority',
    supportResponseSecs: 1800,
    features: ['Subscriber badge', 'Chat highlight', 'Custom emotes', 'Priority chat', 'Monthly gift', 'Elite badge'],
  },
  'Mythic': {
    uptimeGuarantee: 99.95,
    qualityGuarantee: '4K',
    chatPriority: 'vip_only',
    supportResponseSecs: 600,
    features: ['Subscriber badge', 'Chat highlight', 'Custom emotes', 'Priority chat', 'Monthly gift', 'Elite badge', '1:1 Shoutout', 'Direct DM access', '4K stream access'],
  },
  'Fan Supporter': {
    uptimeGuarantee: 99.0,
    qualityGuarantee: '720p',
    chatPriority: 'standard',
    supportResponseSecs: 14400,
    features: ['Subscriber badge'],
  },
}

export function useStreamSlaStatus(streamId?: string) {
  const [slaStatus, setSlaStatus] = useState<StreamSlaStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSlaStatus = useCallback(async () => {
    if (!streamId) {
      setSlaStatus(null)
      return
    }

    setLoading(true)
    try {
      const result = await invokeSlaMonitor({ action: 'check', streamId })

      if (!result.ok || !result.data?.ok) {
        const errMsg = (result.data as any)?.error || result.error || 'Failed to fetch SLA status'
        console.warn('[useStreamSlaStatus]', errMsg)
        setSlaStatus(null)
        return
      }

      setSlaStatus((result.data as any).slaStatus as StreamSlaStatus)
    } catch (err) {
      console.warn('[useStreamSlaStatus] Exception:', err)
      setSlaStatus(null)
    } finally {
      setLoading(false)
    }
  }, [streamId])

  useEffect(() => {
    void fetchSlaStatus()
  }, [fetchSlaStatus])

  return { slaStatus, loading, refresh: fetchSlaStatus }
}

export function useBroadcasterSlaSummary(broadcasterId?: string) {
  const [summary, setSummary] = useState<BroadcasterSlaSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSummary = useCallback(async () => {
    if (!broadcasterId) {
      setSummary(null)
      return
    }

    setLoading(true)
    try {
      const result = await invokeSlaMonitor({ action: 'broadcaster', broadcasterId })

      if (!result.ok || !result.data?.ok) {
        const errMsg = (result.data as any)?.error || result.error || 'Failed to fetch broadcaster SLA summary'
        console.warn('[useBroadcasterSlaSummary]', errMsg)
        setSummary(null)
        return
      }

      setSummary((result.data as any).slaSummary as BroadcasterSlaSummary)
    } catch (err) {
      console.warn('[useBroadcasterSlaSummary] Exception:', err)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [broadcasterId])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  return { summary, loading, refresh: fetchSummary }
}

export function useSlaViolations(broadcasterId?: string) {
  const [violations, setViolations] = useState<SlaViolation[]>([])
  const [loading, setLoading] = useState(false)

  const fetchViolations = useCallback(async () => {
    if (!broadcasterId) {
      setViolations([])
      return
    }

    setLoading(true)
    try {
      const result = await invokeSlaMonitor({ action: 'broadcaster', broadcasterId })

      if (!result.ok || !result.data?.ok) {
        const errMsg = (result.data as any)?.error || result.error || 'Failed to fetch SLA violations'
        console.warn('[useSlaViolations]', errMsg)
        setViolations([])
        return
      }

      setViolations(((result.data as any).violations || []) as SlaViolation[])
    } catch (err) {
      console.warn('[useSlaViolations] Exception:', err)
      setViolations([])
    } finally {
      setLoading(false)
    }
  }, [broadcasterId])

  useEffect(() => {
    void fetchViolations()
  }, [fetchViolations])

  return { violations, loading, refresh: fetchViolations }
}

export function useSubscriptionSlaStatus(subscriptionId?: string) {
  const [slaStatus, setSlaStatus] = useState<SubscriptionSlaStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSlaStatus = useCallback(async () => {
    if (!subscriptionId) {
      setSlaStatus(null)
      return
    }

    setLoading(true)
    try {
      const result = await invokeSlaMonitor({ action: 'subscription', subscriptionId })

      if (!result.ok || !result.data?.ok) {
        const errMsg = (result.data as any)?.error || result.error || 'Failed to fetch subscription SLA status'
        console.warn('[useSubscriptionSlaStatus]', errMsg)
        setSlaStatus(null)
        return
      }

      setSlaStatus((result.data as any).slaStatus as SubscriptionSlaStatus)
    } catch (err) {
      console.warn('[useSubscriptionSlaStatus] Exception:', err)
      setSlaStatus(null)
    } finally {
      setLoading(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    void fetchSlaStatus()
  }, [fetchSlaStatus])

  return { slaStatus, loading, refresh: fetchSlaStatus }
}
