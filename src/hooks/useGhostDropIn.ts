import { createContext, useContext } from 'react';
import type { GhostDropInContextType } from '../context/GhostDropInContext';

export const GhostDropInContext = createContext<GhostDropInContextType | null>(null);

export function useGhostDropIn() {
  const context = useContext(GhostDropInContext);
  if (!context) throw new Error('useGhostDropIn must be used within GhostDropInProvider');
  return context;
}
