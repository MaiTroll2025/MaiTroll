import { useCallback, useEffect, useState } from 'react';
import { errorText, gameApi } from '../lib/gameApi';

const REFRESH_MS = 3000;

export function useTrollCoins(userId: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBalance(await gameApi.getTrollCoinBalance());
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setError(null);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [userId, refresh]);

  return { balance, error };
}

