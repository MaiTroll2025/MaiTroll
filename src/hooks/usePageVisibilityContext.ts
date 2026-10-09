import { createContext, useContext, useEffect } from 'react';
import type { PageVisibilityContextType } from '../contexts/PageVisibilityContext';

export const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export function usePageVisibilityContext(): PageVisibilityContextType {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    throw new Error('usePageVisibilityContext must be used within a PageVisibilityProvider');
  }
  return context;
}

export function useVisibilityAware(callbacks?: {
  onVisible?: () => void;
  onHidden?: () => void;
  onReturn?: (timeHidden: number) => void;
}) {
  const { isVisible, wasHidden, timeSinceLastVisible } = usePageVisibilityContext();

  useEffect(() => {
    if (isVisible) {
      if (wasHidden && callbacks?.onReturn) {
        callbacks.onReturn(timeSinceLastVisible);
      } else if (callbacks?.onVisible) {
        callbacks.onVisible();
      }
    } else if (callbacks?.onHidden) {
      callbacks.onHidden();
    }
  }, [isVisible, wasHidden, timeSinceLastVisible, callbacks]);

  return { isVisible, wasHidden, timeSinceLastVisible };
}
