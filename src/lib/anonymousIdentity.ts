const ANON_DISPLAY_NAME_KEY = 'MaiTroll-anonymous-display-name'
const ANON_CHAT_COUNT_KEY = 'MaiTroll-anonymous-chat-count'
const ANON_CHAT_LIMIT = 5

export function getAnonymousDisplayName() {
  if (typeof window === 'undefined') {
    return 'anon000000'
  }

  const storedName = window.sessionStorage.getItem(ANON_DISPLAY_NAME_KEY)
  if (storedName?.match(/^anon\d{6}$/)) {
    return storedName
  }

  const generatedName = `anon${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`

  window.sessionStorage.setItem(ANON_DISPLAY_NAME_KEY, generatedName)
  return generatedName
}

export function isAnonymousDisplayName(name?: string | null) {
  return Boolean(name && /^anon\d{6}$/.test(name))
}

export function getAnonymousChatCount() {
  if (typeof window === 'undefined') {
    return 0
  }

  const rawValue = window.sessionStorage.getItem(ANON_CHAT_COUNT_KEY)
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0
  }

  return parsedValue
}

export function reserveAnonymousChatSlot() {
  const currentCount = getAnonymousChatCount()

  if (currentCount >= ANON_CHAT_LIMIT) {
    return false
  }

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(ANON_CHAT_COUNT_KEY, String(currentCount + 1))
  }

  return true
}
