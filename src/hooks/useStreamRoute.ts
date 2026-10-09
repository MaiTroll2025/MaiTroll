import { createContext, useContext } from 'react'
import type { Stream } from '../types/broadcast'

interface StreamRouteValue {
  streamId: string
  stream: Stream
}

export const StreamRouteContext = createContext<StreamRouteValue | null>(null)

export function useResolvedStreamId(fallback?: string | null) {
  return useContext(StreamRouteContext)?.streamId || fallback || ''
}

export function useResolvedStream(fallback?: Stream | null) {
  return useContext(StreamRouteContext)?.stream || fallback || null
}
