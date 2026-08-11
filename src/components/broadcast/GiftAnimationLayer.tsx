import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type GiftEvent = {
  id: string
  gift_id: string
  gift_name?: string
  animation_url?: string | null
  animation_duration_ms?: number | null
  sound_url?: string | null
  display_mode?: 'recipient_box' | 'full_screen'
  sender_id?: string
  sender_name?: string
  receiver_id?: string
  quantity?: number
  amount?: number
  stream_id?: string
  timestamp?: string
}

interface Props {
  streamId: string
  recipientUserId: string
  recipientType?: 'broadcaster' | 'seat'
  className?: string
}

export default function GiftAnimationLayer({ streamId, recipientUserId, recipientType = 'seat', className = '' }: Props) {
  const [queue, setQueue] = useState<GiftEvent[]>([])
  const playingRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const seen = useRef(new Set<string>())
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!streamId) return

    const ch = supabase.channel(`stream-gifts:${streamId}`)
    channelRef.current = ch
    ch.subscribe()

    ch.on('broadcast', { event: 'gift_sent' }, (payload: any) => {
      try {
        const ev: GiftEvent = payload?.payload || payload
        if (import.meta.env.DEV) {
          console.debug('[GiftAnimationLayer] received gift_sent', { payload: payload, giftEvent: ev, recipientUserId, recipientType })
        }

        // Filter by recipientUserId
        if (!ev || !ev.receiver_id) {
          if (import.meta.env.DEV) {
            console.debug('[GiftAnimationLayer] skipping gift_sent without receiver_id', { ev })
          }
          return
        }
        if (ev.receiver_id !== recipientUserId) {
          if (import.meta.env.DEV) {
            console.debug('[GiftAnimationLayer] skipping gift_sent for different recipient', { receiver_id: ev.receiver_id, recipientUserId })
          }
          return
        }

        // Prevent duplicates
        if (seen.current.has(ev.id)) {
          if (import.meta.env.DEV) {
            console.debug('[GiftAnimationLayer] skipping duplicate gift_sent', { giftId: ev.id })
          }
          return
        }
        seen.current.add(ev.id)

        setQueue((q) => [...q, ev])
      } catch (err) {
        console.warn('[GiftAnimationLayer] failed to handle gift_sent payload', err)
      }
    })

    return () => {
      try {
        if (ch) supabase.removeChannel(ch)
      } catch {}
    }
  }, [streamId, recipientUserId])

  useEffect(() => {
    if (playingRef.current) return
    if (queue.length === 0) return

    const next = queue[0]
    if (!next) return

    const resolvedUrl = String(next.animation_url || (next as any).video_url || '')
    if (import.meta.env.DEV) {
      console.debug('[GiftAnimationLayer] next queue gift', {
        queueLength: queue.length,
        giftId: next.id,
        animation_url: next.animation_url,
        video_url: (next as any).video_url,
        resolvedUrl,
        sender_id: next.sender_id,
        receiver_id: next.receiver_id,
      })
    }
    if (!resolvedUrl) {
      if (import.meta.env.DEV) {
        console.debug('[GiftAnimationLayer] skipping gift without resolvedUrl', { next })
      }
      setQueue((q) => q.slice(1))
      return
    }

    playingRef.current = true

    // Create video element
    const video = document.createElement('video')
    video.src = resolvedUrl
    video.autoplay = true
    video.playsInline = true
    video.defaultMuted = false
    video.muted = false
    video.loop = false
    video.preload = 'auto'
    video.setAttribute('playsinline', '')
    video.style.pointerEvents = 'none'
    video.style.position = 'absolute'
    video.style.inset = '0'
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'contain'
    video.style.background = 'transparent'
    video.style.zIndex = '30'
    video.style.display = 'block'

    let expectedDurationMs = next.animation_duration_ms ?? 0
    const normalizeDuration = (value: number | null | undefined) => {
      if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 0
      return Math.round(value)
    }

    const getSafeTimeout = () => {
      const duration = normalizeDuration(expectedDurationMs)
      return Math.min(Math.max(duration || 5000, 5000) + 1000, 60_000)
    }

    const scheduleTimeout = () => {
      return window.setTimeout(() => {
        if (playingRef.current) {
          try {
            video.pause()
            video.remove()
          } catch {}
          setQueue((q) => q.slice(1))
          playingRef.current = false
        }
      }, getSafeTimeout())
    }

    const onLoadedMetadata = () => {
      if (video.duration && !Number.isNaN(video.duration) && video.duration > 0) {
        expectedDurationMs = Math.max(expectedDurationMs, Math.round(video.duration * 1000))
      }
      window.clearTimeout(safeTimeout)
      safeTimeout = scheduleTimeout()
    }

    const onEnded = () => {
      try {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('ended', onEnded)
        video.removeEventListener('error', onError)
        video.remove()
      } catch {}
      setQueue((q) => q.slice(1))
      playingRef.current = false
    }

    const onError = () => {
      console.error('[GiftAnimationLayer] video error for gift', next)
      onEnded()
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('ended', onEnded)
    video.addEventListener('error', onError)

    // Add small sender badge
    const badge = document.createElement('div')
    badge.style.position = 'absolute'
    badge.style.left = '8px'
    badge.style.top = '8px'
    badge.style.zIndex = '40'
    badge.style.pointerEvents = 'none'
    badge.style.padding = '6px 8px'
    badge.style.background = 'rgba(0,0,0,0.6)'
    badge.style.color = 'white'
    badge.style.fontSize = '12px'
    badge.style.borderRadius = '6px'
    badge.textContent = `${next.sender_name || 'Someone'} ${next.gift_name || ''} ${next.quantity && next.quantity > 1 ? `×${next.quantity}` : ''}`

    const container = containerRef.current
    let safeTimeout = scheduleTimeout()

    if (container) {
      container.appendChild(video)
      container.appendChild(badge)
      // Try to play; handle autoplay restrictions gracefully
      const tryPlay = async () => {
        try {
          video.load();
          await video.play();
        } catch (err) {
          try {
            video.muted = true;
            video.load();
            await video.play();
          } catch (err2) {
            console.warn('[GiftAnimationLayer] playback failed', err2);
            onEnded();
          }
        }
      };
      void tryPlay()
    } else {
      // If no container, skip
      window.clearTimeout(safeTimeout)
      playingRef.current = false
      setQueue((q) => q.slice(1))
    }

    return () => {
      window.clearTimeout(safeTimeout)
      try {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('ended', onEnded)
        video.removeEventListener('error', onError)
        video.remove()
      } catch {}
    }

  }, [queue])

  if (!streamId) return null

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden
    />
  )
}
