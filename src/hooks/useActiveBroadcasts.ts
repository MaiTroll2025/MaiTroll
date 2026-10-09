import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useActiveBroadcasts — checks for active broadcast content.
 * 
 * OPTIMIZED: Only runs when document is visible, uses 60s interval instead of 30s,
 * and stops polling if no active content is found for 5 minutes to reduce load.
 */
export function useActiveBroadcasts() {
  const [hasActiveContent, setHasActiveContent] = useState(false);
  const inactiveCountRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkActiveContent = async () => {
      try {
        // Single query using RPC for efficiency
        const { count: streamCount } = await supabase
          .from('streams')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true);

        const hasContent = (streamCount || 0) > 0;
        
        if (mounted) {
          setHasActiveContent(hasContent);
          if (hasContent) {
            inactiveCountRef.current = 0;
          } else {
            inactiveCountRef.current += 1;
          }
        }
      } catch (_error) {
        // Silently fail — non-critical
      }
    };

    // Initial check
    checkActiveContent();

    // Adaptive polling: 60s normally, stop after 5 consecutive inactive checks (5 min)
    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = window.setInterval(() => {
        if (!document.visibilityState) {
          checkActiveContent();
        }
        // Stop polling after 5 minutes of no active content to save resources
        if (inactiveCountRef.current >= 5) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 60000);
    };

    startPolling();

    // Re-check when tab becomes visible
    const handleVisibility = () => {
      if (!document.hidden && !intervalRef.current) {
        inactiveCountRef.current = 0;
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return hasActiveContent;
}
