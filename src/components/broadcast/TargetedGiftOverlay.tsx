import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { StreamGiftEvent } from '@/hooks/useTargetedGiftQueue'
import { chooseAnimationUrl } from '@/hooks/useTargetedGiftQueue'

type TargetedGiftOverlayProps = {
  targetKey: string
  gifts: StreamGiftEvent[]
  onGiftComplete: (targetKey: string, giftId: string) => void
}

export default React.memo(function TargetedGiftOverlay({
  targetKey,
  gifts,
  onGiftComplete,
}: TargetedGiftOverlayProps) {
  const currentGift = gifts[0] ?? null
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

    const durationMs = useMemo(() => {
      return Math.max(1000, currentGift?.animation_duration_ms ?? 7000)
    }, [currentGift])

    useEffect(() => {
      if (!currentGift?.sound_url) return

      const audio = new Audio(currentGift.sound_url)
      audio.volume = 0.5
      audio.play().catch(() => {})

      return () => {
        audio.pause()
        audio.src = ''
      }
    }, [currentGift?.sound_url, currentGift?.id])

  useEffect(() => {
    if (!currentGift) return

    console.info('[TargetedGiftOverlay] Rendering gift', {
      targetKey,
      giftId: currentGift.id,
      recipientUserId: currentGift.recipient_user_id,
      animationUrl: currentGift.animation_url,
      animationType: currentGift.animation_type,
      durationMs,
    })

    const timeout = window.setTimeout(() => {
      onGiftComplete(targetKey, currentGift.id)
    }, durationMs + 1000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [currentGift, durationMs, onGiftComplete, targetKey])

  if (!currentGift) {
    return null
  }

  if (!currentGift.animation_url) {
    return null
  }

  return (
    <div
      className="
        pointer-events-none
        absolute
        inset-0
        z-40
        flex
        items-center
        justify-center
        overflow-hidden
      "
      data-gift-id={currentGift.id}
      data-gift-target={targetKey}
    >
      <video
        ref={videoRef}
        key={currentGift.id}
        src={chooseAnimationUrl(currentGift) || undefined}
        muted
        autoPlay
        playsInline
        preload="auto"
        className="
          h-full
          w-full
          object-contain
        "
        style={{
          background: 'transparent',
        }}
        onLoadedMetadata={() => {
          console.info('[TargetedGiftOverlay] Metadata loaded', {
            giftId: currentGift.id,
            targetKey,
            duration: videoRef.current?.duration,
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
          })
        }}
        onCanPlay={() => {
          console.info('[TargetedGiftOverlay] Video can play', {
            giftId: currentGift.id,
            targetKey,
          })

          void videoRef.current
            ?.play()
            .catch((error) => {
              console.error('[TargetedGiftOverlay] play() failed', {
                giftId: currentGift.id,
                targetKey,
                error,
              })
            })
        }}
        onPlay={() => {
          console.info('[TargetedGiftOverlay] Playback started', {
            giftId: currentGift.id,
            targetKey,
          })
        }}
        onEnded={() => {
          onGiftComplete(targetKey, currentGift.id)
        }}
        onError={() => {
          const mediaError = videoRef.current?.error

          const message =
            mediaError
              ? `MediaError code ${mediaError.code}: ${mediaError.message}`
              : 'Unknown video loading error'

          setLoadError(message)

          console.error('[TargetedGiftOverlay] Video failed', {
            giftId: currentGift.id,
            targetKey,
            animationUrl: currentGift.animation_url,
            message,
            networkState: videoRef.current?.networkState,
            readyState: videoRef.current?.readyState,
          })
        }}
      />

      {loadError && import.meta.env.DEV && (
        <div
          className="
            absolute
            bottom-2
            left-2
            right-2
            rounded
            bg-black/80
            p-2
            text-xs
            text-red-300
          "
        >
          Gift video error: {loadError}
        </div>
      )}
    </div>
  )
})
