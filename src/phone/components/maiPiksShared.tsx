/**
 * Shared MAI Piks types, constants and small presentational helpers.
 *
 * Kept in its own module so the phone page and the full screen story viewer
 * agree on the same story shape and the same 24h expiry rules.
 */

import React, { useEffect, useState } from 'react'
import { Clock, User } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

/** Photo stories advance automatically after this long. */
export const PHOTO_STORY_DURATION_MS = 5000

/** Hold the shutter longer than this to start recording video instead of a photo. */
export const HOLD_TO_RECORD_MS = 250

/** Hard cap for a single MAI Piks video. */
export const MAX_VIDEO_MS = 3 * 60 * 1000

/** Stories live for 24 hours, then they are hard deleted. */
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

/** Tip presets in troll coins. */
export const TIP_PRESETS = [10, 50, 100, 500]

/** Platform fee taken from every story tip. The owner keeps the remaining 80%. */
export const TIP_PLATFORM_FEE_PERCENT = 20

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type StoryVisibility = 'everyone' | 'followers' | 'private'

export interface PiksStoryItem {
  id: string
  storyId: string
  mediaUrl: string
  mediaType: 'photo' | 'video'
  thumbnailUrl?: string | null
  caption?: string | null
  durationMs?: number | null
  createdAt: string
  expiresAt: string
}

export interface PiksStory {
  /** Newest story container for this user. */
  id: string
  /** Every active story container belonging to this user. */
  storyIds: string[]
  userId: string
  username: string
  avatarUrl?: string | null
  thumbnailUrl?: string | null
  visibility: StoryVisibility
  hasAccess?: boolean
  isOwn?: boolean
  /** When the last piece of media in this story disappears. */
  expiresAt?: string
  items: PiksStoryItem[]
  tipsReceived?: number
}

export interface MaiPiksUser {
  id: string
  username: string
  avatarUrl?: string | null
  screenshotsAllowed: boolean
  trollCoins: number
}

/* -------------------------------------------------------------------------- */
/* TIME HELPERS                                                               */
/* -------------------------------------------------------------------------- */

/** mm:ss clock for the recording indicator. */
export function formatRecordClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(ms, 0) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Human readable time left until a story is hard deleted. */
export function formatTimeLeft(expiresAt?: string): {
  text: string
  urgent: boolean
  expired: boolean
} {
  if (!expiresAt) return { text: '—', urgent: false, expired: false }

  const remaining = new Date(expiresAt).getTime() - Date.now()

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { text: 'Expired', urgent: true, expired: true }
  }

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, urgent: hours < 1, expired: false }
  }

  if (minutes > 0) {
    return { text: `${minutes}m ${String(seconds).padStart(2, '0')}s left`, urgent: true, expired: false }
  }

  return { text: `${seconds}s left`, urgent: true, expired: false }
}

/* -------------------------------------------------------------------------- */
/* EXPIRY COUNTDOWN                                                           */
/* -------------------------------------------------------------------------- */

/** Live countdown to the 24h hard delete. */
export function ExpiryCountdown({
  expiresAt,
  compact = false,
}: {
  expiresAt?: string
  compact?: boolean
}) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const { text, urgent } = formatTimeLeft(expiresAt)

  if (compact) {
    return (
      <span className={`font-mono text-[9px] font-black ${urgent ? 'text-[#BF00FF]' : 'text-[#00BFFF]'}`}>
        {text}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
        urgent
          ? 'border-[#BF00FF]/30 bg-[#BF00FF]/10 text-[#BF00FF]'
          : 'border-[#00BFFF]/25 bg-[#00BFFF]/10 text-[#00BFFF]'
      }`}
    >
      <Clock size={9} />
      <span className="font-mono text-[9px] font-black">{text}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* AVATAR                                                                     */
/* -------------------------------------------------------------------------- */

export function MaiPiksAvatar({
  src,
  purple = false,
  blue = false,
}: {
  src?: string | null
  purple?: boolean
  blue?: boolean
}) {
  return (
    <div
      className={`h-10 w-10 shrink-0 rounded-xl p-[2px] ${
        purple
          ? 'bg-gradient-to-br from-[#BF00FF] to-[#9B30FF]'
          : blue
            ? 'bg-gradient-to-br from-[#00BFFF] to-[#1E90FF]'
            : 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF]'
      }`}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#05050d]">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={16} className="text-zinc-600" />
        )}
      </div>
    </div>
  )
}
