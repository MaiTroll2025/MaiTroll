import { supabase } from '../supabase'

export type CityActivityType = 'live' | 'gift' | 'battle' | 'system' | 'tcnn_breaking' | 'tcnn_live' | 'tcnn_article'

export interface CreateCityActivityEventInput {
  type: CityActivityType | string
  title: string
  icon?: string | null
  priority?: number
  metadata?: Record<string, any> | null
}

const inFlightEvents = new Set<string>()

function dedupeKey(input: CreateCityActivityEventInput) {
  const metadata = input.metadata || {}
  return String(
    metadata.dedupe_key ||
    metadata.event_id ||
    metadata.gift_id ||
    `${input.type}:${input.title}:${metadata.user_id || metadata.sender_id || ''}:${metadata.stream_id || ''}`
  )
}

export async function createCityActivityEvent(input: CreateCityActivityEventInput) {
  const key = dedupeKey(input)
  if (inFlightEvents.has(key)) return
  inFlightEvents.add(key)

  const since = new Date(Date.now() - 60000).toISOString()
  const { data: existing } = await supabase
    .from('global_events')
    .select('id')
    .eq('type', input.type)
    .eq('title', input.title)
    .gte('created_at', since)
    .limit(1)

  if (existing?.length) {
    inFlightEvents.delete(key)
    return
  }

  const { error } = await supabase.rpc('create_global_event', {
    p_type: input.type,
    p_title: input.title,
    p_icon: input.icon || null,
    p_priority: input.priority ?? 1,
    p_metadata: { ...(input.metadata || {}), dedupe_key: key },
  })

  window.setTimeout(() => inFlightEvents.delete(key), 60000)
  if (error) throw error
}
