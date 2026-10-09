import { useCallback, useRef } from 'react'
import { useLocation, useNavigate, type To } from 'react-router-dom'

const NAVIGATE_THROTTLE_MS = 250

export function useSafeNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  const lastNavigateAt = useRef(0)

  return useCallback(
    (to: To, options?: { replace?: boolean; state?: any }) => {
      const now = Date.now()
      if (now - lastNavigateAt.current < NAVIGATE_THROTTLE_MS) {
        return
      }

      const currentPath = `${location.pathname}${location.search}`
      const targetPath = typeof to === 'string' ? to : ''

      if (targetPath && targetPath === currentPath && !options?.replace) {
        return
      }

      lastNavigateAt.current = now
      navigate(to, options)
    },
    [location.pathname, location.search, navigate],
  )
}
