/** Tip presets in troll coins. */
export const TIP_PRESETS = [10, 50, 100, 500]

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
