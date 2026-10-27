import { supabase } from '../supabase'

export type CityActivityType =
  | 'live'
  | 'gift'
  | 'battle'
  | 'system'
  | 'tcnn_breaking'
  | 'tcnn_live'
  | 'tcnn_article'
  | string

export interface CreateCityActivityEventInput {
  type: CityActivityType | string
  title: string
  icon?: string | null
  priority?: number
  metadata?: Record<string, any> | null
  /** Stable id of the source event (e.g. stream id, wheel spin id, court case id). */
  sourceEventId?: string | null
  /** Validated public destination route for the ticker item. */
  route?: string | null
  /** Originating subsystem label (live | tcnn | court | wheel | level | law | election | arrest). */
  source?: string | null
  /** When the event should stop appearing on the public ticker. */
  expiresAt?: string | null
}

const inFlightEvents = new Set<string>()

function dedupeKey(input: CreateCityActivityEventInput): string {
  const metadata = input.metadata || {}
  return String(
    metadata.dedupe_key ||
    metadata.event_id ||
    metadata.gift_id ||
    `${input.type}:${input.title}:${metadata.user_id || metadata.sender_id || ''}:${input.sourceEventId || ''}`
  )
}

export async function createCityActivityEvent(input: CreateCityActivityEventInput) {
  const key = dedupeKey(input)
  if (inFlightEvents.has(key)) return
  inFlightEvents.add(key)

  const { error } = await supabase.rpc('create_global_event', {
    p_type: input.type,
    p_title: input.title,
    p_icon: input.icon || null,
    p_priority: input.priority ?? 1,
    p_metadata: { ...(input.metadata || {}), dedupe_key: key },
    p_dedupe_key: key || null,
    p_source_event_id: input.sourceEventId || null,
    p_route: input.route || null,
    p_source: input.source || null,
    p_expires_at: input.expiresAt || null,
  })

  window.setTimeout(() => inFlightEvents.delete(key), 60000)
  if (error) throw error
}
