import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTabVisibility } from '@/hooks/useTabVisibility';

interface UseLazyAPIOptions {
  /** Whether to run the API call immediately when becoming visible */
  runOnVisible?: boolean;
  /** Debounce time in ms for API calls when returning to visible */
  debounceMs?: number;
  /** Whether to skip API calls entirely when hidden */
  skipWhenHidden?: boolean;
  /** Whether to show loading states even when hidden */
  showLoadingWhenHidden?: boolean;
}

/**
 * Hook that optimizes API calls based on tab visibility
 * Prevents unnecessary API calls when tab is hidden and debounces calls when returning
 */
export function useLazyAPI<TData, TArgs extends any[]>(
  apiCall: (...args: TArgs) => Promise<TData>,
  options: UseLazyAPIOptions = {}
) {
  const {
    runOnVisible = false,
    debounceMs = 500,
    skipWhenHidden = true,
    showLoadingWhenHidden: _showLoadingWhenHidden = false
  } = options;

  const { isVisible, wasHidden, timeSinceLastVisible } = useTabVisibility();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  const pendingArgsRef = useRef<TArgs | null>(null);

  const lazyAPICall = useCallback(async (...args: TArgs): Promise<TData | undefined> => {
    // Cancel any pending call
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!isVisible && skipWhenHidden) {
      // Store args for when tab becomes visible
      pendingArgsRef.current = args;
      return undefined;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // Create new abort controller for this call
    abortControllerRef.current = new AbortController();

    try {
      // Run API call
      const result = await apiCall(...args);
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Call was cancelled, ignore
        return undefined;
      }
      throw error;
    }
  }, [isVisible, skipWhenHidden, apiCall]);

  // Handle pending API calls when tab becomes visible
  useEffect(() => {
    if (isVisible && pendingArgsRef.current) {
      if (runOnVisible) {
        // Run immediately
        lazyAPICall(...pendingArgsRef.current);
        pendingArgsRef.current = null;
      } else if (debounceMs > 0 && wasHidden && timeSinceLastVisible > 1000) {
        // Debounce if was hidden for more than 1 second
        timeoutRef.current = setTimeout(() => {
          if (pendingArgsRef.current) {
            lazyAPICall(...pendingArgsRef.current);
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
  }, [isVisible, runOnVisible, debounceMs, wasHidden, timeSinceLastVisible, lazyAPICall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return lazyAPICall;
}

/**
 * Hook that prevents unnecessary re-renders when tab is hidden
 */
export function useVisibilityMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: {
    /** Whether to skip computation when hidden */
    skipWhenHidden?: boolean;
    /** Fallback value when hidden */
    fallback?: T;
  } = {}
): T {
  const { skipWhenHidden = true, fallback } = options;
  const { isVisible } = useTabVisibility();
  const lastValueRef = useRef<T>();

  const shouldCompute = isVisible || !skipWhenHidden;

   const result = useMemo(() => {
    if (shouldCompute) {
      const newValue = factory();
      lastValueRef.current = newValue;
      return newValue;
    }
    return lastValueRef.current ?? fallback;
  }, [factory, fallback, shouldCompute]);

  return result as T;
}

/**
 * Hook that batches state updates when tab is hidden to prevent unnecessary renders
 */
export function useBatchedState<T>(
  initialValue: T,
  options: {
    /** Whether to batch updates when hidden */
    batchWhenHidden?: boolean;
    /** Maximum batch delay in ms */
    maxBatchDelay?: number;
  } = {}
) {
  const { batchWhenHidden = true, maxBatchDelay = 100 } = options;
  const { isVisible } = useTabVisibility();
  const [state, setState] = useState(initialValue);
  const batchedUpdatesRef = useRef<((prev: T) => T)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchedSetState = useCallback((update: T | ((prev: T) => T)) => {
    if (!batchWhenHidden || isVisible) {
      // Update immediately if visible or batching disabled
      setState(update);
      return;
    }

    // Batch the update
    batchedUpdatesRef.current.push(typeof update === 'function' ? (update as (prev: T) => T) : (() => update) as (prev: T) => T);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to apply batched updates
    timeoutRef.current = setTimeout(() => {
      if (batchedUpdatesRef.current.length > 0) {
        setState(prev => {
          let newState = prev;
          batchedUpdatesRef.current.forEach(updateFn => {
            newState = updateFn(newState);
          });
          batchedUpdatesRef.current = [];
          return newState;
        });
      }
    }, maxBatchDelay);
  }, [batchWhenHidden, isVisible, maxBatchDelay]);

  // Apply any pending updates when tab becomes visible
  useEffect(() => {
    if (isVisible && batchedUpdatesRef.current.length > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setState(prev => {
        let newState = prev;
        batchedUpdatesRef.current.forEach(updateFn => {
          newState = updateFn(newState);
        });
        batchedUpdatesRef.current = [];
        return newState;
      });
    }
  }, [isVisible]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState] as const;
}