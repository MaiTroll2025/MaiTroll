import { useState, useCallback, useRef } from 'react';
import { SwipeNavigationContext } from '../hooks/useSwipeNavigation';

export type SwipeDirection = 'left' | 'right' | null;

export function SwipeNavigationProvider({ children }: { children: React.ReactNode }) {
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const directionRef = useRef<SwipeDirection>(null);

  const stableSetDirection = useCallback((dir: SwipeDirection) => {
    directionRef.current = dir;
    setDirection(dir);
  }, []);

  return (
    <SwipeNavigationContext.Provider value={{ direction, setDirection: stableSetDirection }}>
      {children}
    </SwipeNavigationContext.Provider>
  );
}
