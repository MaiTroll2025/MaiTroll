import React, { useEffect, useState, type ReactNode } from 'react';
import { usePageVisibility, isPageVisibilitySupported } from '../lib/hooks/usePageVisibility';
import { PageVisibilityContext } from '../hooks/usePageVisibilityContext';

export interface PageVisibilityContextType {
  isVisible: boolean;
  wasHidden: boolean;
  timeSinceLastVisible: number;
  visibilitySupported: boolean;
}

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