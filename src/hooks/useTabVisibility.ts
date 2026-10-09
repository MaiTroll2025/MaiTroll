import { usePageVisibilityContext } from './usePageVisibilityContext';

export function useTabVisibility() {
  const { isVisible, wasHidden, timeSinceLastVisible, visibilitySupported } = usePageVisibilityContext();

  return {
    isVisible,
    wasHidden,
    timeSinceLastVisible,
    visibilitySupported,
    whenVisible: <T,>(operation: () => T, fallback?: T): T | undefined => {
      return isVisible ? operation() : fallback;
    },
    skipWhenHidden: <T,>(operation: () => T): T | undefined => {
      return isVisible ? operation() : undefined;
    },
  };
}
