import { supabase } from '../supabase'
import type { SignalContentType, SignalSurface } from './types'

export type ClientSignalEventType =
  | 'impression'
  | 'click'
  | 'watch_start'
  | 'watch_progress'
  | 'watch_complete'
  | 'skip'
  | 'listen_start'
  | 'listen_progress'
  | 'listen_complete'
  | 'like'
  | 'reaction'
  | 'comment'
  | 'share'
  | 'follow'
  | 'hide'
  | 'report'
  | 'return_visit'

export interface SignalEventInput {
  eventType: ClientSignalEventType
  contentType: SignalContentType
  contentId: string
  creatorId?: string | null
  surface?: SignalSurface | null
  value?: number
  metadata?: Record<string, unknown>
}

export interface SignalEventResult {
  success: boolean
  eventId?: string
  error?: string
}

export async function recordSignalEvent(input: SignalEventInput): Promise<SignalEventResult> {
  const { data, error } = await supabase.rpc('record_maitroll_signal_event', {
    p_event_type: input.eventType,
    p_content_type: input.contentType,
    p_content_id: input.contentId,
    p_creator_id: input.creatorId ?? null,
    p_surface: input.surface ?? null,
    p_value: Math.max(input.value ?? 1, 0),
    p_metadata: input.metadata ?? {},
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: Boolean(data?.success),
    eventId: data?.event_id,
    error: data?.error,
  }
}

export function recordSignalEventInBackground(input: SignalEventInput): void {
  void recordSignalEvent(input).catch((error) => {
    console.warn('[SignalEngine] Failed to record event', error)
  })
}
