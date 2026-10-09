import { type ReactNode } from 'react'
import type { Stream } from '../types/broadcast'
import { StreamRouteContext } from '../hooks/useStreamRoute'

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
