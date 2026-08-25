import { useEffect, useState } from 'react'

// Phone breakpoint in CSS pixels. Anything narrower than this is treated as a
// phone screen and served the src/phone experience instead of the web app.
const PHONE_BREAKPOINT_PX = 768

function getWidth() {
  if (typeof window === 'undefined') return 0
  return window.visualViewport?.width ?? window.innerWidth
}

function getIsPhone() {
  if (typeof window === 'undefined') return false
  return getWidth() < PHONE_BREAKPOINT_PX
}

/**
 * Returns true when the current device has a phone-sized screen.
 * Used to serve the lightweight src/phone pages instead of the full
 * web application on small screens (e.g. opening localhost on a phone).
 */
export function useIsPhone() {
  // Initialize from the real width so there is no flash of the wrong layout.
  const [isPhone, setIsPhone] = useState<boolean>(getIsPhone)

  useEffect(() => {
    const update = () => setIsPhone(getIsPhone())
    update()

    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
      }
    }
  }, [])

  return isPhone
}
