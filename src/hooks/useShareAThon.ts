import { createContext, useContext } from 'react';
import type { ShareAThonContextType } from '../contexts/ShareAThonContext';

export const ShareAThonContext = createContext<ShareAThonContextType | undefined>(undefined);

export function useShareAThon() {
  const context = useContext(ShareAThonContext);
  if (!context) throw new Error('useShareAThon must be used within ShareAThonProvider');
  return context;
}
