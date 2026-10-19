import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export type BroadcasterGuidanceClientType = 'web_desktop' | 'mobile_web' | 'native'

type DeliveryStatus = 'pending' | 'delivered' | 'rejected' | 'cancelled'

type GuidanceDelivery = {
  id: string
  position: number
  account_id: string
  topic: string
  content: string
  scheduled_at: string
  status: DeliveryStatus
  username: string
  avatar_url: string
}

type GuidanceResponse = {
  success: boolean
  started?: boolean
  minimumSpacingSeconds?: number
  messages?: GuidanceDelivery[]
  status?: DeliveryStatus
  scheduled_at?: string
}

function requestGuidance(body: Record<string, unknown>) {
  return supabase.functions.invoke<GuidanceResponse>('broadcaster-guidance', { body })
}

function debugGuidance(...values: unknown[]) {
  if (import.meta.env.DEV) console.debug('[broadcaster-guidance]', ...values)
}

export function resolveBroadcasterGuidanceClientType(
  isMobileInterface: boolean,
): BroadcasterGuidanceClientType {
  if (!isMobileInterface) return 'web_desktop'
  return Capacitor.isNativePlatform() ? 'native' : 'mobile_web'
}

export function useBroadcasterGuidance(options: {
  streamId: string | null
  broadcasterId: string | null
  isLive: boolean
  enabled: boolean
  clientType: BroadcasterGuidanceClientType
}) {
  const { streamId, broadcasterId, isLive, enabled, clientType } = options
  const scheduledSequenceRef = useRef<{ streamId: string; pendingMessageIds: Set<string> } | null>(null)

  useEffect(() => {
    if (!enabled || !isLive || !streamId || !broadcasterId) return

    let cancelled = false
    const timers = new Set<number>()

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        callback()
      }, Math.max(0, delayMs))
      timers.add(timer)
    }

    const dispatch = async (delivery: GuidanceDelivery, notDueRetries = 0, networkRetries = 0) => {
      if (cancelled) return

      try {
        const { data, error } = await requestGuidance({
          action: 'dispatch',
          streamId,
          messageId: delivery.id,
        })
        if (error) throw new Error(error.message || 'Guidance delivery failed')
        if (!data?.success) throw new Error('Guidance delivery was rejected')

        if (data.status === 'pending' && notDueRetries < 3) {
          const scheduledAt = Date.parse(data.scheduled_at || delivery.scheduled_at)
          schedule(
            () => void dispatch(delivery, notDueRetries + 1, networkRetries),
            Math.max(500, scheduledAt - Date.now() + 500),
          )
          return
        }

        scheduledSequenceRef.current?.pendingMessageIds.delete(delivery.id)
        debugGuidance('message delivery result', {
          streamId,
          messageId: delivery.id,
          username: delivery.username,
          status: data.status,
        })
      } catch (error) {
        if (networkRetries < 1 && !cancelled) {
          schedule(
            () => void dispatch(delivery, notDueRetries, networkRetries + 1),
            1500,
          )
          return
        }
        if (!cancelled) {
          scheduledSequenceRef.current?.pendingMessageIds.delete(delivery.id)
          console.error('[broadcaster-guidance] Message delivery failed', {
            streamId,
            messageId: delivery.id,
            error,
          })
        }
      }
    }

    const initialize = async (attempt = 0) => {
      try {
        const { data, error } = await requestGuidance({
          action: 'start',
          streamId,
          clientType,
        })
        if (error) throw new Error(error.message || 'Unable to initialize guidance')
        if (!data?.success) throw new Error('Guidance initialization was rejected')
        if (cancelled) return

        const messages = data.messages || []
        if (messages.length === 0) {
          debugGuidance('no eligible sequence for stream', streamId)
          return
        }

        const pendingMessages = messages.filter((message) => message.status === 'pending')
        scheduledSequenceRef.current = {
          streamId,
          pendingMessageIds: new Set(pendingMessages.map((message) => message.id)),
        }
        debugGuidance('client type selected', clientType)
        debugGuidance(data.started ? 'sequence initialized' : 'duplicate sequence prevented', streamId)
        debugGuidance('messages scheduled', pendingMessages.length)

        const minimumSpacingMs = Math.max(0, data.minimumSpacingSeconds || 0) * 1000
        let nextDispatchAt = Date.now()
        for (const message of messages) {
          debugGuidance('account selected', {
            streamId,
            accountId: message.account_id,
            username: message.username,
            topic: message.topic,
          })
          if (message.status !== 'pending') continue

          const scheduledAt = Date.parse(message.scheduled_at)
          const dispatchAt = Math.max(
            Number.isFinite(scheduledAt) ? scheduledAt : Date.now(),
            nextDispatchAt,
          )
          nextDispatchAt = dispatchAt + minimumSpacingMs
          schedule(() => void dispatch(message), dispatchAt - Date.now())
        }
      } catch (error) {
        if (attempt < 1 && !cancelled) {
          schedule(() => void initialize(attempt + 1), 1500)
          return
        }
        if (!cancelled) {
          const errorMessage = error instanceof Error
            ? error.message
            : JSON.stringify(error)
          console.error(
            `[broadcaster-guidance] Sequence initialization failed for ${streamId} (${clientType}): ${errorMessage || 'Unknown error'}`,
          )
        }
      }
    }

    debugGuidance('initializing sequence for stream', streamId)
    void initialize()

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [streamId, broadcasterId, isLive, enabled, clientType])

  useEffect(() => {
    const sequence = scheduledSequenceRef.current
    if (isLive || sequence?.streamId !== streamId || sequence.pendingMessageIds.size === 0) return
    debugGuidance('sequence cancelled because stream ended', streamId)
    scheduledSequenceRef.current = null
  }, [isLive, streamId])
}
