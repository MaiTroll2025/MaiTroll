import { useEffect, useState, useCallback } from 'react';
import { usePageVisibility } from './usePageVisibility';

/**
 * Hook that prevents page refreshes on tab switches by managing browser behavior
 */
export function usePreventTabRefresh() {
  useEffect(() => {
    // Prevent page from unloading when tab becomes hidden
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only prevent unload if the user is actually trying to close/refresh the tab
      // Don't prevent unload for navigation within the app
      const isNavigation = event.target && (event.target as any).href;

      if (!isNavigation) {
        // Store current state in sessionStorage to restore on reload
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('MaiTroll_last_path', currentPath);
        sessionStorage.setItem('MaiTroll_tab_hidden', 'true');
        sessionStorage.setItem('MaiTroll_hidden_time', Date.now().toString());
      }
    };

    // Listen for visibility changes to optimize performance
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause expensive operations
        document.body.classList.add('tab-hidden');
      } else {
        // Tab is visible again
        document.body.classList.remove('tab-hidden');

        // Mark that we returned to the tab
        const hiddenTime = sessionStorage.getItem('MaiTroll_hidden_time');
        if (hiddenTime) {
          const timeHidden = Date.now() - parseInt(hiddenTime);
          sessionStorage.setItem('MaiTroll_time_hidden', timeHidden.toString());
        }

        sessionStorage.removeItem('MaiTroll_tab_hidden');
        sessionStorage.removeItem('MaiTroll_hidden_time');
      }
    };

    // Prevent context menu on long press (mobile)
    const handleContextMenu = (event: Event) => {
      // Only prevent if it's a long press, not a right-click
      if (window.innerWidth <= 768) {
        event.preventDefault();
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu, { passive: false });

    // Mark that we're on a Mai Troll tab
    sessionStorage.setItem('MaiTroll_active', 'true');

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Restore scroll position when returning to tab
  useEffect(() => {
    const handleFocus = () => {
      // Restore scroll position if it was saved
      const savedScroll = sessionStorage.getItem('MaiTroll_scroll_y');
      if (savedScroll) {
        window.scrollTo(0, parseInt(savedScroll));
        sessionStorage.removeItem('MaiTroll_scroll_y');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);
}

/**
 * Hook that saves and restores application state across tab switches
 */
export function useStatePersistence<T>(
  key: string,
  defaultValue: T,
  options: {
    /** Whether to persist when tab is hidden */
    persistOnHidden?: boolean;
    /** Whether to restore when tab becomes visible */
    restoreOnVisible?: boolean;
  } = {}
) {
  const { persistOnHidden = true, restoreOnVisible = true } = options;
  const { isVisible } = usePageVisibility();

  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(`MaiTroll_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Save state to sessionStorage
  const persistentSetState = useCallback(
    (value: T | ((prev: T) => T)) => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(state) : value;
      setState(newValue);

      try {
        sessionStorage.setItem(`MaiTroll_${key}`, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Failed to persist state for ${key}:`, error);
      }
    },
    [key, state]
  );

  // Auto-save on visibility change
  useEffect(() => {
    if (persistOnHidden && !isVisible) {
      try {
        sessionStorage.setItem(`MaiTroll_${key}`, JSON.stringify(state));
      } catch (error) {
        console.warn(`Failed to persist state for ${key} on hide:`, error);
      }
    }
  }, [isVisible, persistOnHidden, key, state]);

  return [state, persistentSetState] as const;
}

/**
 * Utility to save scroll position before tab becomes hidden
 */
export function useScrollPersistence() {
  const { isVisible } = usePageVisibility();

   useEffect(() => {
     if (!isVisible) {
       // Save current scroll position
       sessionStorage.setItem('MaiTroll_scroll_y', window.scrollY.toString());
     }
   }, [isVisible]);
}

/**
 * Hook that provides page refresh prevention utilities
 */
export function useRefreshPrevention() {
  const preventRefresh = useCallback((event: BeforeUnloadEvent) => {
    // Only prevent refresh if there are unsaved changes or ongoing operations
    const hasUnsavedChanges = sessionStorage.getItem('MaiTroll_unsaved_changes') === 'true';
    const hasOngoingOperations = sessionStorage.getItem('MaiTroll_ongoing_ops') === 'true';

    if (hasUnsavedChanges || hasOngoingOperations) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', preventRefresh);
    return () => window.removeEventListener('beforeunload', preventRefresh);
  }, [preventRefresh]);

  return {
    markUnsavedChanges: (hasChanges: boolean) => {
      sessionStorage.setItem('MaiTroll_unsaved_changes', hasChanges.toString());
    },
    markOngoingOperation: (hasOperation: boolean) => {
      sessionStorage.setItem('MaiTroll_ongoing_ops', hasOperation.toString());
    }
  };
}