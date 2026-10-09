import { createContext, useContext } from 'react'
import type { LiveItem } from '../contexts/LiveContentContext'

interface LiveContentState {
  liveItems: LiveItem[]
  totalViewers: number
  onlineUsers: number
  loadingLive: boolean
  loadingOnline: boolean
  refresh: () => void
}

export const LiveContentContext = createContext<LiveContentState | null>(null)

export function useLiveContent() {
  const context = useContext(LiveContentContext)
  if (!context) throw new Error('useLiveContent must be used within LiveContentProvider')
  return context
}
