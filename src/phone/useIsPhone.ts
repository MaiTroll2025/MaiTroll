import { useEffect, useState } from 'react'

// Phone breakpoint in CSS pixels. Anything narrower than this is treated as
// a phone screen and served the src/phone experience instead of the web app.
// Raised from 768 to 900 so transient widths mid-rotation don't accidentally
// swap the entire app tree.
const PHONE_BREAKPOINT_PX = 900

// Resize events fire in bursts while the device rotates. Debounce the layout
// swap so intermediate widths don't make the phone/web trees oscillate.
const RESIZE_DEBOUNCE_MS = 100

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
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const update = () => {
      // Wait for the resize stream to settle before swapping the tree.
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = undefined
        setIsPhone(getIsPhone())
      }, RESIZE_DEBOUNCE_MS)
    }

    update()

    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update, { passive: true })
    }

    // screen.orientation is a more reliable rotation signal on mobile;
    // fall back to the resize events above when it isn't available.
    const screenOrientation =
      typeof screen !== 'undefined' ? screen.orientation : undefined
    if (screenOrientation) {
      screenOrientation.addEventListener('change', update)
    }

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
      }
      if (screenOrientation) {
        screenOrientation.removeEventListener('change', update)
      }
    }
  }, [])

  return isPhone
}
