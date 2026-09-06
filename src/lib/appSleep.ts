export type SleepState = {
  isAsleep: boolean
  puzzleAnswer: string | null
  unlockedAt: number | null
}

const STORAGE_KEY = 'maitroll_sleep_state'

export function getSleepState(): SleepState {
  if (typeof window === 'undefined') {
    return { isAsleep: false, puzzleAnswer: null, unlockedAt: null }
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { isAsleep: false, puzzleAnswer: null, unlockedAt: null }

    const parsed = JSON.parse(raw)
    const unlockedAt = typeof parsed.unlockedAt === 'number' ? parsed.unlockedAt : null

    if (unlockedAt && Date.now() - unlockedAt < 30 * 60 * 1000) {
      return { isAsleep: false, puzzleAnswer: parsed.puzzleAnswer ?? null, unlockedAt }
    }

    window.sessionStorage.removeItem(STORAGE_KEY)
    return { isAsleep: true, puzzleAnswer: null, unlockedAt: null }
  } catch {
    return { isAsleep: true, puzzleAnswer: null, unlockedAt: null }
  }
}

export function setSleepAsleep() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isAsleep: true, puzzleAnswer: null, unlockedAt: null }))
  } catch {
    // ignore
  }
}

export function setSleepUnlocked(puzzleAnswer: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isAsleep: false, puzzleAnswer, unlockedAt: Date.now() }))
  } catch {
    // ignore
  }
}

export function resetSleepState() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
