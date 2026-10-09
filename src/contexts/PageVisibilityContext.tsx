import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePageVisibility, isPageVisibilitySupported } from '../lib/hooks/usePageVisibility';

interface PageVisibilityContextType {
  isVisible: boolean;
  wasHidden: boolean;
  timeSinceLastVisible: number;
  visibilitySupported: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

interface PageVisibilityProviderProps {
  children: ReactNode;
}

export function PageVisibilityProvider({ children }: PageVisibilityProviderProps) {
  const { isVisible, visibilityState: _visibilityState } = usePageVisibility();
  const [wasHidden, setWasHidden] = useState(false);
  const [lastVisibleTime, setLastVisibleTime] = useState(Date.now());
  const [timeSinceLastVisible, setTimeSinceLastVisible] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setWasHidden(false);
      setLastVisibleTime(Date.now());
      setTimeSinceLastVisible(0);
    } else {
      setWasHidden(true);
    }
  }, [isVisible]);

  // Update time since last visible — compute on demand, no 1s interval
  useEffect(() => {
    if (!isVisible) {
      // Compute elapsed time from timestamp instead of incrementing every 1s
      // This avoids 10K backgrounded tabs × 1s interval = 10K state updates/sec
      setTimeSinceLastVisible(Date.now() - lastVisibleTime);
    }
  }, [isVisible, lastVisibleTime]);

  const contextValue: PageVisibilityContextType = {
    isVisible,
    wasHidden,
    timeSinceLastVisible,
    visibilitySupported: isPageVisibilitySupported(),
  };

  return (
    <PageVisibilityContext.Provider value={contextValue}>
      {children}
    </PageVisibilityContext.Provider>
  );
}

export function usePageVisibilityContext(): PageVisibilityContextType {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    throw new Error('usePageVisibilityContext must be used within a PageVisibilityProvider');
  }
  return context;
}

// Hook for components that need to pause/resume based on visibility
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