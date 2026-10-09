import React, { createContext, useContext, useState } from 'react';

interface GamingStreamContextValue {
  streamId: string | null
  setStreamId: (id: string | null) => void
}

const GamingStreamContext = createContext<GamingStreamContextValue>({
  streamId: null,
  setStreamId: () => {},
})

export function GamingStreamProvider({ children }: { children: React.ReactNode }) {
  const [streamId, setStreamId] = useState<string | null>(null)

  return (
    <GamingStreamContext.Provider value={{ streamId, setStreamId }}>
      {children}
    </GamingStreamContext.Provider>
  )
}

export function useGamingStreamId() {
  return useContext(GamingStreamContext).streamId
}

export function useSetGamingStreamId() {
  return useContext(GamingStreamContext).setStreamId
}
