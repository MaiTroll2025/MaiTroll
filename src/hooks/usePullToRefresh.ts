import { useCallback, useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 80
const MAX_PULL = 140

export function usePullToRefresh(onRefresh: () => void, enabled = true) {
  const [pulling, setPulling] = useState(false)
  const [pullY, setPullY] = useState(0)
  const startY = useRef(0)
  const pullingRef = useRef(false)
  const refreshingRef = useRef(false)

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || refreshingRef.current) return
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY
      pullingRef.current = true
    }
  }, [enabled])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !pullingRef.current || refreshingRef.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0 && window.scrollY <= 0) {
      const next = Math.min(MAX_PULL, dy)
      setPullY(next)
      setPulling(next > 8)
    }
  }, [enabled])

  const onTouchEnd = useCallback(() => {
    if (!enabled || !pullingRef.current) return
    pullingRef.current = false
    if (pullY >= PULL_THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true
      setPullY(MAX_PULL)
      onRefresh()
      setTimeout(() => {
        refreshingRef.current = false
        setPullY(0)
        setPulling(false)
      }, 1200)
    } else {
      setPullY(0)
      setPulling(false)
    }
  }, [enabled, pullY, onRefresh])

  useEffect(() => {
    const target = typeof window !== 'undefined' ? window : null
    if (!target) return
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: true })
    target.addEventListener('touchend', onTouchEnd)
    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { pulling, pullY, setPullY }
}
