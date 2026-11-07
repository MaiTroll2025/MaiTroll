import { useEffect, useState } from 'react';

export function useNow(clockOffset: number, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now() + clockOffset);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), intervalMs);
    return () => window.clearInterval(timer);
  }, [clockOffset, intervalMs]);

  return now;
}
