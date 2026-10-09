import { createContext, useContext, useEffect } from 'react'
import { subscribePageChannel, getPageChannelStats } from '../lib/realtime/RealtimeManager'
import type { PageType } from '../contexts/PageChannelContext'

interface PageChannelState {
  currentPage: PageType
  currentPageId: string | null
  switchPage: (type: PageType, id?: string | null) => void
  getPageStats: () => ReturnType<typeof getPageChannelStats>
}

export const PageChannelContext = createContext<PageChannelState | null>(null)

export function usePageChannel() {
  const ctx = useContext(PageChannelContext)
  if (!ctx) throw new Error('usePageChannel must be used within PageChannelProvider')
  return ctx
}

export function usePageChannelSubscription(
  pageType: PageType,
  pageId: string | undefined,
  subscriberId: string,
  builder: (channel: any) => any,
) {
  const { switchPage } = usePageChannel()

  useEffect(() => {
    switchPage(pageType, pageId || null)
    const unsubscribe = subscribePageChannel(pageType as Parameters<typeof subscribePageChannel>[0], subscriberId, builder, pageId)
    return unsubscribe
  }, [pageType, pageId, subscriberId, builder, switchPage])
}
