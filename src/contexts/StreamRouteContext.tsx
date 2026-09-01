import { createContext, useContext, type ReactNode } from 'react'
import type { Stream } from '../types/broadcast'

interface StreamRouteValue {
  streamId: string
  stream: Stream
}

const StreamRouteContext = createContext<StreamRouteValue | null>(null)

export function StreamRouteProvider({
  streamId,
  stream,
  children,
}: {
  streamId: string
  stream: Stream
  children: ReactNode
}) {
  return (
    <StreamRouteContext.Provider value={{ streamId, stream }}>
      {children}
    </StreamRouteContext.Provider>
  )
}

export function useResolvedStreamId(fallback?: string | null) {
  return useContext(StreamRouteContext)?.streamId || fallback || ''
}

export function useResolvedStream(fallback?: Stream | null) {
  return useContext(StreamRouteContext)?.stream || fallback || null
}
