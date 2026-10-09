import { useCallback, useEffect, useRef } from 'react';
import { useTabVisibility } from '@/components/TabSwitchHandler';

interface UseLazyOperationOptions {
  /** Whether to run the operation immediately when becoming visible */
  runOnVisible?: boolean;
  /** Debounce time in ms for operations when returning to visible */
  debounceMs?: number;
  /** Whether to skip operations entirely when hidden */
  skipWhenHidden?: boolean;
}

/**
 * Hook that helps manage operations that should only run when the tab is visible
 * or should be debounced when returning from hidden state.
 */
export function useLazyOperation<T extends any[]>(
  operation: (...args: T) => void | Promise<void>,
  options: UseLazyOperationOptions = {}
) {
  const {
    runOnVisible = false,
    debounceMs = 1000,
    skipWhenHidden = true
  } = options;

  const { isVisible, wasHidden: _wasHidden } = useTabVisibility();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingArgsRef = useRef<T | null>(null);

  const lazyOperation = useCallback((...args: T) => {
    if (!isVisible && skipWhenHidden) {
      // Store args for when tab becomes visible
      pendingArgsRef.current = args;
      return;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // Run operation
    operation(...args);
  }, [isVisible, skipWhenHidden, operation]);

  // Handle pending operations when tab becomes visible
  useEffect(() => {
    if (isVisible && pendingArgsRef.current) {
      if (runOnVisible) {
        // Run immediately
        operation(...pendingArgsRef.current);
        pendingArgsRef.current = null;
      } else if (debounceMs > 0) {
        // Debounce
        timeoutRef.current = setTimeout(() => {
          if (pendingArgsRef.current) {
            operation(...pendingArgsRef.current);
            pendingArgsRef.current = null;
          }
        }, debounceMs);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, runOnVisible, debounceMs, operation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return lazyOperation;
}

/**
 * Hook that automatically pauses/resumes intervals based on tab visibility
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  delay: number | null,
  options: {
    /** Whether to run immediately when becoming visible */
    runOnVisible?: boolean;
    /** Whether to pause when hidden */
    pauseWhenHidden?: boolean;
  } = {}
) {
  const { runOnVisible = false, pauseWhenHidden = true } = options;
  const { isVisible } = useTabVisibility();
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up or clear interval based on visibility
  useEffect(() => {
    const shouldRun = isVisible || !pauseWhenHidden;

    if (shouldRun && delay !== null) {
      const tick = () => savedCallback.current();
      intervalRef.current = setInterval(tick, delay);

      // Run immediately if requested and tab just became visible
      if (runOnVisible && isVisible) {
        tick();
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [delay, isVisible, pauseWhenHidden, runOnVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

/**
 * Hook that provides utilities for managing expensive operations based on visibility
 */
export function useVisibilityOptimized() {
  const { isVisible, wasHidden, timeSinceLastVisible } = useTabVisibility();

  return {
    isVisible,
    wasHidden,
    timeSinceLastVisible,

    // Only run expensive operations when visible
    whenVisible: useCallback(<T>(operation: () => T, fallback?: T): T | undefined => {
      return isVisible ? operation() : fallback;
    }, [isVisible]),

    // Skip operations when hidden
    skipWhenHidden: useCallback(<T>(operation: () => T): T | undefined => {
      return isVisible ? operation() : undefined;
    }, [isVisible]),

    // Debounce operations when returning from hidden
    debounceOnReturn: useCallback(<T>(
      operation: () => T,
      debounceMs: number = 1000
    ): Promise<T | undefined> => {
      return new Promise((resolve) => {
        if (isVisible && wasHidden && timeSinceLastVisible > 1000) {
          // Was hidden for more than 1 second, debounce
          setTimeout(() => resolve(operation()), debounceMs);
        } else if (isVisible) {
          // Wasn't hidden or just became visible
          resolve(operation());
        } else {
          // Still hidden
          resolve(undefined);
        }
      });
    }, [isVisible, wasHidden, timeSinceLastVisible])
  };
}