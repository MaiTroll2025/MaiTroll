import { createContext, useContext } from 'react';

export interface TrollContextType {
  triggerTroll: (context?: string, options?: { safe?: boolean }) => void;
}

export const TrollContext = createContext<TrollContextType | undefined>(undefined);

export const useTrollContext = () => {
  const context = useContext(TrollContext);
  if (!context) {
    throw new Error('useTrollContext must be used within a TrollProvider');
  }
  return context;
};
