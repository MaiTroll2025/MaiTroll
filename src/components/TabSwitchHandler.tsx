import React, { useEffect, useRef } from 'react';
import { usePageVisibilityContext, useVisibilityAware } from '../contexts/PageVisibilityContext';
import { toast } from 'sonner';
import { usePreventTabRefresh, useScrollPersistence } from '../lib/hooks/usePreventRefresh';

interface TabSwitchHandlerProps {
  children: React.ReactNode;
  showWelcomeBack?: boolean;
  pauseOnHidden?: boolean;
}

export function TabSwitchHandler({
  children,
  showWelcomeBack = true,
  pauseOnHidden = true
}: TabSwitchHandlerProps) {
  const { isVisible, wasHidden, timeSinceLastVisible } = usePageVisibilityContext();
  const hasShownWelcomeBack = useRef(false);

  // Use the refresh prevention hooks
  usePreventTabRefresh();
  useScrollPersistence();

  useVisibilityAware({
    onVisible: () => {
      // Tab became visible
      if (pauseOnHidden) {
        // Resume any paused activities
        document.title = 'MaiTroll';

        // Remove hidden class from body
        document.body.classList.remove('tab-hidden');
      }
    },
    onHidden: () => {
      // Tab became hidden
      if (pauseOnHidden) {
        // Pause activities that might cause issues when hidden
        // Add class to body for CSS-based optimizations
        document.body.classList.add('tab-hidden');
      }
    },
    onReturn: (timeHidden) => {
        // User returned to tab after it was hidden
        if (showWelcomeBack && timeHidden > 30000 && !hasShownWelcomeBack.current) {
          // Only show if hidden for more than 30 seconds
          requestAnimationFrame(() => {
            toast.success('Welcome back to Mai Troll!', {
              duration: 3000,
              description: 'Your session has been maintained.'
            });
          });
          hasShownWelcomeBack.current = true;

          // Reset after showing once
          setTimeout(() => {
            hasShownWelcomeBack.current = false;
          }, 60000); // Don't show again for 1 minute
        }
    }
  });

  // Update document title to indicate visibility state (for debugging)
  useEffect(() => {
    if (!isVisible && process.env.NODE_ENV === 'development') {
      document.title = '(Hidden) Mai Troll';
    } else {
      document.title = 'MaiTroll';
    }
  }, [isVisible]);

  return <>{children}</>;
}

// Hook for components that need to conditionally render or behave differently based on visibility
export function useTabVisibility() {
  const { isVisible, wasHidden, timeSinceLastVisible, visibilitySupported } = usePageVisibilityContext();

  return {
    isVisible,
    wasHidden,
    timeSinceLastVisible,
    visibilitySupported,
    // Helper to only run expensive operations when visible
    whenVisible: <T,>(operation: () => T, fallback?: T): T | undefined => {
      return isVisible ? operation() : fallback;
    },
    // Helper to skip operations when hidden
    skipWhenHidden: <T,>(operation: () => T): T | undefined => {
      return isVisible ? operation() : undefined;
    }
  };
}

export default TabSwitchHandler;