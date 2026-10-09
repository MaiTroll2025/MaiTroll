import { useEffect, useState, useCallback } from 'react'

const MOBILE_BREAKPOINT_PX = 768

function getIsTouchDevice() {
  if (typeof window === 'undefined') return false
  return (navigator.maxTouchPoints ?? 0) > 0
}

function _getIsMobileWidth() {
  if (typeof window === 'undefined') return true // Default to mobile for SSR
  // Use visual viewport if available for more accurate mobile sizing
  const width = window.visualViewport?.width ?? window.innerWidth
  return width < MOBILE_BREAKPOINT_PX
}

export function useIsMobile() {
  // Start with true (mobile-first) to avoid flash of desktop layout on mobile
  const [isMobileWidth, setIsMobileWidth] = useState(true)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  const updateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return
    const width = window.visualViewport?.width ?? window.innerWidth
    setIsMobileWidth(width < MOBILE_BREAKPOINT_PX)
    setIsTouchDevice(getIsTouchDevice())
  }, [])

  useEffect(() => {
    // Set mounted flag
    setHasMounted(true)
    
    // Initial check
    updateDimensions()

    // Listen for resize events
    window.addEventListener('resize', updateDimensions, { passive: true })
    
    // Listen for orientation changes (important for mobile)
    window.addEventListener('orientationchange', updateDimensions, { passive: true })
    
    // Listen for visual viewport changes (handles mobile keyboard, etc)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateDimensions, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('orientationchange', updateDimensions)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateDimensions)
      }
    }
  }, [updateDimensions])

  // Reliable mobile UA detection — only matches actual mobile OS, not desktop browsers
  // Desktop Chrome UA contains "Mobile" so we must check for mobile-specific tokens
  // and explicitly exclude Windows/Mac/Linux desktop
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isDesktopOS = /Windows NT|Macintosh|Mac OS X|Linux x86_64|Linux i686|X11/i.test(ua)
  const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari|CriOS|FxiOS/i.test(ua)
  const isMobileUA = isMobileOS && !isDesktopOS

  return {
    isMobile: isMobileWidth && isMobileUA,
    isMobileWidth,
    isTouchDevice,
    hasMounted,
    breakpointPx: MOBILE_BREAKPOINT_PX,
  }
}
