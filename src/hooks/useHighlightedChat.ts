// src/hooks/useHighlightedChat.ts
// React hook for MaiTroll Highlighted Chat

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  isHighlightedChatActive,
  getHighlightedChatColor,
  purchaseHighlightedChat,
  sendHighlightedChat,
  HIGHLIGHTED_CHAT_PERK_ID,
} from '@/lib/highlightedChat';

export function useHighlightedChat(streamId: string | undefined) {
  const [isActive, setIsActive] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.profile);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) return;
    const active = await isHighlightedChatActive(user.id);
    setIsActive(active);
    if (active) {
      const chatColor = await getHighlightedChatColor(user.id);
      setColor(chatColor);
    } else {
      setColor(null);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const purchase = useCallback(
    async (highlightColor: string) => {
      if (!user?.id) return { success: false, error: 'Not authenticated' };
      setLoading(true);
      setError(null);
      const result = await purchaseHighlightedChat(user.id, highlightColor);
      setLoading(false);
      if (result.success) {
        setIsActive(true);
        setColor(highlightColor);
      } else {
        setError(result.error || 'Failed to purchase');
      }
      return result;
    },
    [user?.id]
  );

  const send = useCallback(
    async (content: string) => {
      if (!streamId || !color) return { success: false, error: 'No color selected' };
      setLoading(true);
      setError(null);
      const result = await sendHighlightedChat(streamId, content, color);
      setLoading(false);
      if (!result.success) {
        setError(result.error || 'Failed to send');
      }
      return result;
    },
    [streamId, color]
  );

  return {
    isActive,
    color,
    loading,
    error,
    purchase,
    send,
    refreshStatus,
    perkId: HIGHLIGHTED_CHAT_PERK_ID,
  };
}
