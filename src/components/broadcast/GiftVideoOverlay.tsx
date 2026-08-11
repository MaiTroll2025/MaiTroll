import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { getGiftVisualConfig } from '../../lib/giftVisuals'
import { supabase } from '@/lib/supabase'
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime'

let _giftAudioCtx: AudioContext | null = null
const _giftSoundBuffers = new Map<string, AudioBuffer>()

function getGiftAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_giftAudioCtx) {
    _giftAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (_giftAudioCtx.state === 'suspended') {
    _giftAudioCtx.resume()
  }
  return _giftAudioCtx
}

async function fetchGiftSoundBuffer(url: string): Promise<AudioBuffer | null> {
  const ctx = getGiftAudioCtx()
  if (!ctx) return null
  if (_giftSoundBuffers.has(url)) {
    return _giftSoundBuffers.get(url)!
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    const buffer = await ctx.decodeAudioData(arrayBuf)
    _giftSoundBuffers.set(url, buffer)
    return buffer
  } catch {
    return null
  }
}

async function playGiftSound(url: string): Promise<void> {
  try {
    const ctx = getGiftAudioCtx()
    if (!ctx) return
    const buffer = await fetchGiftSoundBuffer(url)
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // silent
  }
}

export const unlockGiftAudio = async (): Promise<void> => {
  const audio = document.createElement('audio')
  audio.muted = false
  audio.volume = 0.01
  const silentAudio =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=='
  audio.src = silentAudio
  try {
    await audio.play()
    audio.pause()
    audio.remove()
  } catch {
    audio.remove()
  }
}

const giftSoundEnabled = true

async function playGiftVideo(video: HTMLVideoElement, giftId?: string, giftName?: string, resolvedUrl?: string): Promise<void> {
  if (!video || !resolvedUrl) return;
  try {
    video.muted = false;
    video.defaultMuted = false;
    video.volume = giftSoundEnabled ? 1 : 0;
    video.currentTime = 0;

    if (import.meta.env.DEV) {
      console.log('[GiftVideoOverlay] attempting playback', {
        giftId,
        giftName,
        resolvedUrl,
        muted: video.muted,
        defaultMuted: video.defaultMuted,
        volume: video.volume,
        paused: video.paused,
        networkState: video.networkState,
        readyState: video.readyState,
      });
    }

    // Only reload if the media hasn't buffered enough yet; calling load()
    // on an already-loaded element (e.g. inside a canplay handler) would
    // restart loading and fire canplay again, creating a loop.
    if (video.readyState < 2) {
      video.load();
    }
    await video.play();
  } catch (error) {
    console.warn(
      '[GiftVideoOverlay] unmuted playback blocked; retrying muted',
      error
    );
    video.muted = true;
    try {
      if (video.readyState < 2) {
        video.load();
      }
      await video.play();
    } catch (fallbackError) {
      console.error('[GiftVideoOverlay] gift video playback failed', fallbackError);
    }
  }
}

interface GiftVideoOverlayProps {
  gifts: BroadcastGift[]
  onFinish: (giftId: string) => void
  nameMap?: Record<string, string>
}

type GiftVisualConfig = ReturnType<typeof getGiftVisualConfig>

type ResolvedOverlayMedia = {
  url: string | null
  type: 'video' | 'image' | 'missing'
  source: string
}

const DEFAULT_DURATION_MS = 15000

async function logGiftAnimationTest({
  gift,
  visual,
  resolvedUrl,
  resolvedSource,
  status,
  errorCode,
  errorMessage,
}: {
  gift: BroadcastGift
  visual: GiftVisualConfig
  resolvedUrl?: string | null
  resolvedSource?: string | null
  status: 'loaded' | 'failed' | 'missing'
  errorCode?: string | null
  errorMessage?: string | null
}) {
  try {
    await supabase.from('gift_animation_test_logs').insert({
      gift_id: gift.id || null,
      gift_item_id: (gift as any).gift_id || null,
      gift_name: gift.gift_name || null,
      slug: (gift as any).slug || null,
      gift_slug: gift.gift_slug || null,
      animation_url: gift.animation_url || null,
      resolved_url: resolvedUrl || null,
      resolved_source: resolvedSource || null,
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      stream_id: (gift as any).stream_id || null,
      sender_id: gift.sender_id || null,
      receiver_id: gift.receiver_id || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch (error) {
    console.warn('[GiftVideoOverlay] Failed to write animation test log', error)
  }
}

function getGiftLabel(gift: BroadcastGift, visual: GiftVisualConfig) {
  return (
    gift.gift_name ||
    (visual as any).trayLabel ||
    (visual as any).label ||
    gift.gift_slug ||
    (gift as any).slug ||
    'Gift'
  )
}

function getGiftIcon(gift: BroadcastGift) {
  return gift.gift_icon || (gift as any).icon || '🎁'
}

function getSenderName(gift: BroadcastGift, nameMap: Record<string, string>) {
  return nameMap[gift.sender_id] || gift.sender_name || 'Someone'
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isLikelyVideoUrl(url?: string | null) {
  if (!url) return false
  const cleanUrl = url.split('?')[0].toLowerCase()
  return (
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v') ||
    cleanUrl.endsWith('.ogv') ||
    cleanUrl.endsWith('.ogg')
  )
}

function isLikelyImageUrl(url?: string | null) {
  if (!url || typeof url !== 'string') return false
  const cleanUrl = url.split('?')[0].toLowerCase()
  return (
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.svg')
  )
}

function mediaTypeFromUrl(url: string | null): 'video' | 'image' {
  if (isLikelyImageUrl(url)) return 'image'
  return 'video'
}

function firstUrl(candidates: Array<[unknown, string]>): { url: string; source: string } | null {
  for (const [candidate, source] of candidates) {
    const url = cleanString(candidate)
    if (url) return { url, source }
  }
  return null
}

function resolveOverlayUrl(gift: BroadcastGift, visual: GiftVisualConfig): ResolvedOverlayMedia {
  const giftAny = gift as any
  const visualAny = visual as any
  const metadata = giftAny.metadata || {}

  const animUrl = gift.animation_url || giftAny.animationUrl || null
  const videoUrl = gift.video_url || giftAny.videoUrl || null

  // When the visual config resolved its URL from a local file fallback
  // (e.g. /gift-videos/gift_boost.webm), those files do not always exist
  // on disk. Skip them so we fall through to image/missing fallbacks
  // instead of producing a demuxer error.
  const skipLocalFallback = visualAny.resolvedSource === 'local_fallback'

  const animation = animUrl || videoUrl || firstUrl([
    [metadata.animation_url, 'metadata.animation_url'],
    [metadata.video_url, 'metadata.video_url'],
    [metadata.resolved_url, 'metadata.resolved_url'],
    [metadata.resolvedVideoUrl, 'metadata.resolvedVideoUrl'],
    [skipLocalFallback ? null : visualAny.resolvedVideoUrl, 'visual.resolvedVideoUrl'],
    [skipLocalFallback ? null : visualAny.resolvedUrl, 'visual.resolvedUrl'],
    [skipLocalFallback ? null : visualAny.animationUrl, 'visual.animationUrl'],
    [visualAny.videoUrl, 'visual.videoUrl'],
    [visualAny.url, 'visual.url'],
  ])

  if (animation) {
    return {
      url: animation,
      type: mediaTypeFromUrl(animation),
      source: animUrl ? 'animation_url' : videoUrl ? 'video_url' : 'resolved',
    }
  }

  const imageResult = firstUrl([
    [giftAny.iconUrl || giftAny.icon_url, 'icon_url'],
    [giftAny.gift_icon_url, 'gift_icon_url'],
    [giftAny.trayVisualUrl || giftAny.tray_visual_url, 'tray_visual_url'],
    [metadata.icon_url || metadata.iconUrl, 'metadata.icon_url'],
    [metadata.gift_icon_url, 'metadata.gift_icon_url'],
    [metadata.tray_visual_url || metadata.trayVisualUrl, 'metadata.tray_visual_url'],
    [visualAny.trayVisualUrl, 'visual.trayVisualUrl'],
    [visualAny.iconUrl, 'visual.iconUrl'],
    [visualAny.imageUrl, 'visual.imageUrl'],
    [skipLocalFallback ? null : visualAny.resolvedImageUrl, 'visual.resolvedImageUrl'],
  ])

  if (imageResult?.url) {
    return {
      url: imageResult.url,
      type: isLikelyVideoUrl(imageResult.url) ? 'video' : 'image',
      source: imageResult.source,
    }
  }

  return {
    url: null,
    type: 'missing',
    source: 'missing',
  }
}

function MissingGiftFallback({
  gift,
  label,
  visual,
  reason,
}: {
  gift: BroadcastGift
  label: string
  visual: GiftVisualConfig
  reason: string
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-fuchsia-950 via-violet-950 to-cyan-950 px-6 text-center text-sm text-slate-100">
      <div className="rounded-full border border-cyan-300/30 bg-white/10 p-4 text-5xl shadow-[0_0_40px_rgba(34,211,238,0.28)]">
        {getGiftIcon(gift)}
      </div>
      <div className="text-base font-black uppercase tracking-[0.18em] text-white">
        Animation missing
      </div>
      <div className="max-w-xs text-xs text-slate-200">
        {label}
      </div>
      {import.meta.env.DEV && (
        <div className="max-w-md rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-slate-300">
          <div>Reason: {reason}</div>
          <div>slug: {(visual as any).slug || (gift as any).slug || gift.gift_slug || 'none'}</div>
          <div>source: {(visual as any).resolvedSource || 'none'}</div>
        </div>
      )}
    </div>
  )
}

function GiftPreview({
  gift,
  visual,
  label,
  resolved,
  onVideoEnd,
  onDurationKnown,
}: {
  gift: BroadcastGift
  visual: GiftVisualConfig
  label: string
  resolved: ResolvedOverlayMedia
  onVideoEnd?: () => void
  onDurationKnown?: (giftId: string, ms: number) => void
}) {
  const [videoFailed, setVideoFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const triedPlayingRef = useRef(false)
  const soundUrlRef = useRef(visual.soundUrl)

  const handleCanPlay = useCallback(() => {
    if (triedPlayingRef.current || !videoRef.current) return
    void playGiftVideo(videoRef.current, gift.id, label, resolved.url)
  }, [gift.id, label, resolved.url])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const audioTracks =
      'audioTracks' in video
        ? (video as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks?.length
        : undefined

    if (import.meta.env.DEV) {
      console.log('[GiftVideoOverlay] metadata loaded', {
        giftId: gift.id,
        giftName: label,
        duration: video.duration,
        muted: video.muted,
        defaultMuted: video.defaultMuted,
        volume: video.volume,
        audioTracks,
        currentSrc: video.currentSrc,
      })
    }

    if (!video.duration || !isFinite(video.duration)) return
    const ms = Math.round(video.duration * 1000)

    onDurationKnown?.(gift.id, ms)
  }, [gift.id, gift.animation_duration_ms, label, onDurationKnown])

  useEffect(() => {
    soundUrlRef.current = visual.soundUrl
  }, [visual.soundUrl])

  useEffect(() => {
    setVideoFailed(false)
    setImageFailed(false)
    triedPlayingRef.current = false
  }, [resolved.url, gift.id])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !resolved.url) return

    if (import.meta.env.DEV) {
      console.debug('[GiftVideoOverlay] resetting video element for new URL', {
        giftId: gift.id,
        resolvedUrl: resolved.url,
      })
    }

    // Pause and reload so the browser picks up the current src.
    // The key={resolved.url} prop on <video> already guarantees a fresh
    // DOM node when the URL changes, clearing any stale sources — so we
    // must NOT call removeAttribute('src') here because it would briefly
    // strip the src and fire onError, which sets videoFailed=true and
    // switches the render to the image/missing fallback.
    video.pause()
    video.load()
  }, [resolved.url, gift.id])

  useEffect(() => {
    if (!resolved.url || resolved.type === 'missing') {
      void logGiftAnimationTest({
        gift,
        visual,
        resolvedUrl: resolved.url,
        resolvedSource: resolved.source,
        status: 'missing',
        errorMessage: 'No resolved animation URL',
      })
    }
  }, [gift, resolved.url, resolved.source, resolved.type, visual])

  useEffect(() => {
    if (resolved.type !== 'video' || !resolved.url || !videoRef.current) return
    const video = videoRef.current

    const handlePlay = () => {
      triedPlayingRef.current = true
      if (soundUrlRef.current) {
        void playGiftSound(soundUrlRef.current)
      }
    }

    const handlePauseEndedError = () => {
      triedPlayingRef.current = false
    }

    const unlockVideo = () => {
      if (!triedPlayingRef.current) {
        getGiftAudioCtx()?.resume()
        void playGiftVideo(video, gift.id, label, resolved.url)
      }
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePauseEndedError)
    video.addEventListener('ended', handlePauseEndedError)
    video.addEventListener('error', handlePauseEndedError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    if (video.readyState >= 1) {
      handleLoadedMetadata()
    }

    document.addEventListener('pointerdown', unlockVideo, { once: true })
    document.addEventListener('touchstart', unlockVideo, { once: true })
    document.addEventListener('keydown', unlockVideo, { once: true })

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePauseEndedError)
      video.removeEventListener('ended', handlePauseEndedError)
      video.removeEventListener('error', handlePauseEndedError)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      document.removeEventListener('pointerdown', unlockVideo)
      document.removeEventListener('touchstart', unlockVideo)
      document.removeEventListener('keydown', unlockVideo)
    }
  }, [resolved.url, resolved.type, gift.id, label, onDurationKnown, handleCanPlay, handleLoadedMetadata])

  if (!resolved.url || resolved.type === 'missing') {
    return (
      <MissingGiftFallback
        gift={gift}
        visual={visual}
        label={label}
        reason="No animation_url, video_url, metadata video URL, visual resolver URL, or icon URL available"
      />
    )
  }

  if (resolved.type === 'video' && !videoFailed) {
    return (
      <>
        <video
          ref={videoRef}
          src={resolved.url || undefined}
          playsInline
          muted={false}
          preload="auto"
          disablePictureInPicture
          controls={false}
          className="h-full w-full bg-transparent object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            if (import.meta.env.DEV) {
              console.info('[GiftVideoOverlay] video playing ended', {
                giftId: gift.id,
                giftName: label,
                resolvedUrl: resolved.url,
              })
            }
            onVideoEnd?.()
          }}
          onError={(event) => {
            const videoEl = event.currentTarget
            const mediaError = videoEl.error

            console.error('[GiftVideoOverlay] video failed to load', {
              giftId: gift.id,
              giftName: label,
              slug: (visual as any).slug || (gift as any).slug || gift.gift_slug || null,
              animation_url: gift.animation_url || null,
              video_url: (gift as any).video_url || null,
              icon_url: (gift as any).icon_url || null,
              metadata: (gift as any).metadata || null,
              resolvedUrl: resolved.url,
              resolvedSource: resolved.source,
              errorCode: mediaError?.code || null,
              errorMessage: mediaError?.message || null,
              event,
            })

            void logGiftAnimationTest({
              gift,
              visual,
              resolvedUrl: resolved.url,
              resolvedSource: resolved.source,
              status: 'failed',
              errorCode: mediaError?.code ? String(mediaError.code) : null,
              errorMessage: mediaError?.message || null,
            })

            setVideoFailed(true)
          }}
        />
      </>
    )
  }

  if ((resolved.type === 'image' || videoFailed) && !imageFailed) {
    const fallbackImage = firstUrl([
      [resolved.type === 'image' ? resolved.url : null, resolved.source],
      [(gift as any).icon_url || (gift as any).iconUrl, 'icon_url_fallback'],
      [(gift as any).gift_icon_url, 'gift_icon_url_fallback'],
      [(gift as any).tray_visual_url || (gift as any).trayVisualUrl, 'tray_visual_url_fallback'],
      [((gift as any).metadata || {}).icon_url || ((gift as any).metadata || {}).iconUrl, 'metadata.icon_url_fallback'],
      [((gift as any).metadata || {}).tray_visual_url || ((gift as any).metadata || {}).trayVisualUrl, 'metadata.tray_visual_url_fallback'],
      [(visual as any).trayVisualUrl, 'visual.trayVisualUrl'],
      [(visual as any).iconUrl, 'visual.iconUrl'],
      [(visual as any).imageUrl, 'visual.imageUrl'],
    ])

    if (fallbackImage?.url) {
      return (
        <img
          key={`${gift.id}-${fallbackImage.url}`}
          className="h-full w-full object-contain"
          src={fallbackImage.url}
          alt={`${label} gift animation`}
          onLoad={() => {
            if (import.meta.env.DEV) {
              console.info('[GiftVideoOverlay] image loaded', {
                giftId: gift.id,
                giftName: label,
                resolvedUrl: fallbackImage.url,
                resolvedSource: fallbackImage.source,
              })
            }
          }}
          onError={(event) => {
            console.error('[GiftVideoOverlay] image failed to load', {
              giftId: gift.id,
              giftName: label,
              slug: (visual as any).slug || (gift as any).slug || gift.gift_slug || null,
              animation_url: gift.animation_url || null,
              video_url: (gift as any).video_url || null,
              icon_url: (gift as any).icon_url || null,
              metadata: (gift as any).metadata || null,
              resolvedUrl: fallbackImage.url,
              resolvedSource: fallbackImage.source,
              event,
            })

            setImageFailed(true)
          }}
        />
      )
    }
  }

  return (
    <MissingGiftFallback
      gift={gift}
      visual={visual}
      label={label}
      reason={videoFailed ? 'Video failed and no valid image fallback loaded' : 'Media failed to load'}
    />
  )
}

export default function GiftVideoOverlay({
  gifts,
  onFinish,
  nameMap = {},
}: GiftVideoOverlayProps) {
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const activeGiftIds = new Set(gifts.map((gift) => gift.id))

    Object.keys(timersRef.current).forEach((giftId) => {
      if (!activeGiftIds.has(giftId)) {
        window.clearTimeout(timersRef.current[giftId])
        delete timersRef.current[giftId]
      }
    })

    gifts.forEach((gift) => {
      if (!gift?.id || timersRef.current[gift.id]) return

      const visual = getGiftVisualConfig(gift)
      const durationMs = gift.animation_duration_ms ?? visual.durationMs ?? DEFAULT_DURATION_MS

      timersRef.current[gift.id] = window.setTimeout(() => {
        onFinish(gift.id)
        delete timersRef.current[gift.id]
      }, durationMs + 150)
    })

    return () => {
      Object.values(timersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      timersRef.current = {}
    }
  }, [gifts, onFinish])

  const handleDurationKnown = useCallback((giftId: string, ms: number) => {
    const timerId = timersRef.current[giftId]
    if (timerId) {
      window.clearTimeout(timerId)
    }
    timersRef.current[giftId] = window.setTimeout(() => {
      onFinish(giftId)
      delete timersRef.current[giftId]
    }, ms + 150)
  }, [onFinish])

  const displayGifts = useMemo(() => {
    const seenIds = new Set<string>()

    if (import.meta.env.DEV) {
      console.debug('[GiftVideoOverlay] useMemo building displayGifts', { giftsLength: gifts.length })
    }

    return gifts
      .slice(-3)
      .filter((gift) => {
        if (!gift?.id) {
          if (import.meta.env.DEV) {
            console.debug('[GiftVideoOverlay] filtering gift without id', { gift })
          }
          return false
        }
        if (seenIds.has(gift.id)) {
          if (import.meta.env.DEV) {
            console.debug('[GiftVideoOverlay] filtering duplicate gift id', { giftId: gift.id })
          }
          return false
        }
        seenIds.add(gift.id)

        const giftAny = gift as any
        const metadata = giftAny.metadata || {}
        const slug = String(giftAny.slug || gift.gift_slug || '').trim() || ''

        const hasAnyMedia =
          !!cleanString(giftAny.animationUrl) ||
          !!cleanString(giftAny.animation_url) ||
          !!cleanString(giftAny.videoUrl) ||
          !!cleanString(giftAny.video_url) ||
          !!cleanString(giftAny.icon_url) ||
          !!cleanString(giftAny.iconUrl) ||
          !!cleanString(giftAny.gift_icon_url) ||
          !!cleanString(giftAny.gift_icon) ||
          !!cleanString(giftAny.tray_visual_url) ||
          !!cleanString(giftAny.trayVisualUrl) ||
          !!cleanString(metadata.animation_url) ||
          !!cleanString(metadata.video_url) ||
          !!cleanString(metadata.icon_url) ||
          !!cleanString(metadata.iconUrl) ||
          !!cleanString(metadata.gift_icon_url) ||
          !!cleanString(metadata.tray_visual_url)

        const isGenericBoostPlaceholder = slug === 'gift_boost' && !hasAnyMedia

        if (import.meta.env.DEV && isGenericBoostPlaceholder) {
          console.debug('[GiftVideoOverlay] filtering generic boost placeholder', {
            giftId: gift.id,
            slug,
            hasAnyMedia,
            animation_url: giftAny.animation_url,
            video_url: giftAny.video_url,
            icon_url: giftAny.icon_url,
            metadata,
          })
        }

        return !isGenericBoostPlaceholder
      })
      .map((gift) => {
        const visual = getGiftVisualConfig(gift)
        const resolved = resolveOverlayUrl(gift, visual)
        const label = getGiftLabel(gift, visual)

        if (import.meta.env.DEV) {
          console.info('[GiftVideoOverlay] resolved gift media', {
            giftId: gift.id,
            giftName: label,
            slug: (gift as any).slug || gift.gift_slug,
            animation_url: gift.animation_url,
            video_url: (gift as any).video_url,
            icon_url: (gift as any).icon_url,
            metadata: (gift as any).metadata,
            resolvedUrl: resolved.url,
            resolvedType: resolved.type,
            resolvedSource: resolved.source,
          })
        }

        return {
          gift,
          visual,
          resolved,
          label,
        }
      })
  }, [gifts])

  if (!displayGifts.length) {
    return null
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[80] flex items-center justify-center px-4 py-6">
      <AnimatePresence mode="popLayout">
        {displayGifts.map(({ gift, visual, label, resolved }) => {
          const displayCount = gift.quantity && gift.quantity > 1 ? `×${gift.quantity}` : ''
          const senderName = getSenderName(gift, nameMap)

          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-transparent bg-black/80 shadow-[0_0_40px_rgba(15,23,42,0.55)] backdrop-blur-xl"
            >
              <div className="relative aspect-[16/9] bg-slate-950">
                <GiftPreview gift={gift} visual={visual} label={label} resolved={resolved} onVideoEnd={() => {
                  const timerId = timersRef.current[gift.id]
                  if (timerId) {
                    window.clearTimeout(timerId)
                    delete timersRef.current[gift.id]
                  }
                  onFinish(gift.id)
                }} onDurationKnown={handleDurationKnown} />

                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 text-center">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/90 sm:text-sm">
                    <Gift className="h-4 w-4 text-pink-300" />
                    <span>{label}</span>
                  </span>

                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    {senderName && senderName !== 'Someone' && (
                      <span>{senderName}</span>
                    )}

                    {gift.amount != null && gift.amount > 0 && (
                      <span className="text-cyan-300">🪙 {gift.amount.toLocaleString()}</span>
                    )}

                    {displayCount && (
                      <span className="text-cyan-200">{displayCount}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
