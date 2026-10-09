import React, { useState } from 'react';
import { GamingStreamContext } from '../hooks/useGamingStream';

export function GamingStreamProvider({ children }: { children: React.ReactNode }) {
  const [streamId, setStreamId] = useState<string | null>(null)

  return (
    <GamingStreamContext.Provider value={{ streamId, setStreamId }}>
      {children}
    </GamingStreamContext.Provider>
  )
}
