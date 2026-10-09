import { useCallback, useRef } from 'react'
import { Link, useLocation, type To } from 'react-router-dom'

const NAVIGATE_THROTTLE_MS = 250

export function SafeLink({ to, onClick, replace, ...props }: Omit<React.ComponentProps<typeof Link>, 'to'> & { to: To }) {
  const location = useLocation()
  const lastNavigateAt = useRef(0)

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(event)
      }

      if (event.defaultPrevented) {
        return
      }

      const now = Date.now()
      if (now - lastNavigateAt.current < NAVIGATE_THROTTLE_MS) {
        event.preventDefault()
        return
      }

      const currentPath = `${location.pathname}${location.search}`
      const targetPath = typeof to === 'string' ? to : ''
      if (targetPath && targetPath === currentPath && !replace) {
        event.preventDefault()
        return
      }

      lastNavigateAt.current = now
      // Let the React Router Link component handle navigation normally.
    },
    [location.pathname, location.search, onClick, replace, to],
  )

  return <Link to={to} onClick={handleClick} replace={replace} {...props} />
}
