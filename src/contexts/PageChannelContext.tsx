import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { removePageChannel, getPageChannelStats } from '../lib/realtime/RealtimeManager'
import { PageChannelContext } from '../hooks/usePageChannel'

export type PageType = 'home' | 'stream' | 'court' | 'pod' | 'none'

/**
 * PageChannelProvider manages a single page-level channel per navigation state.
 * When the page changes, the old page channel is removed and a new one is created.
 * This ensures only 1 page channel is active at a time per user.
 */
export function PageChannelProvider({ children }: { children: React.ReactNode }) {
  const currentPageRef = useRef<PageType>('none')
  const currentPageIdRef = useRef<string | null>(null)

  const switchPage = useCallback((type: PageType, id?: string | null) => {
    const prevType = currentPageRef.current
    const prevId = currentPageIdRef.current

    // Remove previous page channel
    if (prevType !== 'none') {
      removePageChannel(prevType, prevId || undefined)
    }

    currentPageRef.current = type
    currentPageIdRef.current = id || null
  }, [])

  const getPageStats = useCallback(() => getPageChannelStats(), [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const type = currentPageRef.current
      const id = currentPageIdRef.current
      if (type !== 'none') {
        removePageChannel(type, id || undefined)
      }
    }
  }, [])

  const value = useMemo(() => ({
    currentPage: currentPageRef.current,
    currentPageId: currentPageIdRef.current,
    switchPage,
    getPageStats,
  }), [switchPage, getPageStats])

  return (
    <PageChannelContext.Provider value={value}>
      {children}
    </PageChannelContext.Provider>
  )
}
