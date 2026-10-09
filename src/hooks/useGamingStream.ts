import { createContext, useContext } from 'react';

interface GamingStreamContextValue {
  streamId: string | null
  setStreamId: (id: string | null) => void
}

export const GamingStreamContext = createContext<GamingStreamContextValue>({
  streamId: null,
  setStreamId: () => {},
})

export function useGamingStreamId() {
  return useContext(GamingStreamContext).streamId
}

export function useSetGamingStreamId() {
  return useContext(GamingStreamContext).setStreamId
}
