const ACTIVE_STREAM_SESSION_KEY = 'maitroll-active-stream-session'

export function setActiveStreamSession(active: boolean, kind: 'broadcast' | 'viewer', streamId?: string) {
  if (typeof window === 'undefined') return
  if (!active || !streamId) {
    window.sessionStorage.removeItem(ACTIVE_STREAM_SESSION_KEY)
    window.dispatchEvent(new Event('maitroll-stream-session-change'))
    return
  }
  window.sessionStorage.setItem(ACTIVE_STREAM_SESSION_KEY, JSON.stringify({ kind, streamId }))
  window.dispatchEvent(new Event('maitroll-stream-session-change'))
}

export function hasActiveStreamSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.sessionStorage.getItem(ACTIVE_STREAM_SESSION_KEY))
  } catch {
    return false
  }
}
