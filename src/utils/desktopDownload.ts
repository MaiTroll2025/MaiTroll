export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Windows/i.test(navigator.userAgent)
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent)
}

export function isLinux(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Linux/i.test(navigator.userAgent)
}

export function isDesktopPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent || ''

  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? true
  const hasHover = window.matchMedia?.('(hover: hover)').matches ?? true
  const screenWidth = typeof screen !== 'undefined' ? screen.width : 1024

  const isLikelyDesktop = !isMobileUA && (hasFinePointer || hasHover || screenWidth >= 1024)

  return isLikelyDesktop
}

export function getDesktopDownloadUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>
  const configuredUrl =
    env.VITE_DESKTOP_DOWNLOAD_URL ||
    env.VITE_MAITROLL_DESKTOP_DOWNLOAD_URL ||
    ''

  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    return `${origin}/downloads/MaiTroll-Setup.exe`
  }

  return '/downloads/MaiTroll-Setup.exe'
}

export function isElectron(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Electron/i.test(navigator.userAgent)
}
