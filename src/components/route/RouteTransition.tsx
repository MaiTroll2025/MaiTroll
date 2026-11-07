import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface RouteTransitionProps {
  children: React.ReactNode
}

export default function RouteTransition({ children }: RouteTransitionProps) {
  const { pathname, key } = useLocation()
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // When route changes, start exit transition
    setIsExiting(true)
    // After a short exit delay, allow the new page to render
    const timer = setTimeout(() => {
      setIsExiting(false)
    }, 120)
    return () => clearTimeout(timer)
  }, [pathname, key])

  return (
    <div
      className="relative min-h-full"
      style={{
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 120ms ease-in-out',
      }}
    >
      {!isExiting && children}
    </div>
  )
}
