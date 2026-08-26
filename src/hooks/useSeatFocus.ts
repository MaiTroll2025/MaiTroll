// src/hooks/useSeatFocus.ts
// React hook for MaiTroll Seat Focus (personalized audio)

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  getSeatFocus,
  setSeatFocus,
  clearSeatFocus,
  createSeatFocusKey,
  type SeatFocusConfig,
  type SeatFocusState,
} from '@/lib/seatFocus';

export interface SeatInfo {
  seatIndex: number;
  userId?: string | null;
  guestId?: string | null;
  username?: string;
  avatarUrl?: string;
}

export function useSeatFocus(
  streamId: string | undefined,
  seats: Record<number, SeatInfo> = {},
  audioTracksRef: React.MutableRefObject<Map<string, { audioTrack: any; audioEl: HTMLAudioElement | null }>>
) {
  const [focusedUserId, setFocusedUserId] = useState<SeatFocusState>('all');
  const [focusedSeatIndex, setFocusedSeatIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const user = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!streamId || !user?.id) return;
    const config = getSeatFocus(streamId, user.id);
    setFocusedUserId(config.focusedUserId);
    setFocusedSeatIndex(config.focusedSeatIndex);
  }, [streamId, user?.id]);

  const applyAudioFocus = useCallback(
    (targetUserId: SeatFocusState, targetSeatIndex: number | null) => {
      const tracks = audioTracksRef.current;
      tracks.forEach((trackData, key) => {
        const { audioTrack, audioEl } = trackData;
        if (!audioTrack || !audioEl) return;

        const shouldMute =
          targetUserId !== 'all' &&
          key !== targetUserId &&
          key !== `local:${user?.id}`;

        try {
          if (audioTrack.setVolume) {
            audioTrack.setVolume(shouldMute ? 0 : 1);
          } else if (audioTrack.mediaStreamTrack) {
            audioTrack.mediaStreamTrack.enabled = !shouldMute;
          }
        } catch {
          // ignore audio focus errors
        }
      });
    },
    [audioTracksRef, user?.id]
  );

  const focusOnSeat = useCallback(
    (seatIndex: number, seatUserId: string | null | undefined) => {
      if (!streamId || !user?.id) return;

      const targetUserId = seatUserId || null;
      const newConfig: SeatFocusConfig = {
        focusedUserId: targetUserId || 'all',
        focusedSeatIndex: targetUserId ? seatIndex : null,
      };

      if (targetUserId) {
        setFocusedUserId(targetUserId);
        setFocusedSeatIndex(seatIndex);
        setSeatFocus(streamId, user.id, newConfig);
      } else {
        setFocusedUserId('all');
        setFocusedSeatIndex(null);
        setSeatFocus(streamId, user.id, { focusedUserId: 'all', focusedSeatIndex: null });
      }

      applyAudioFocus(newConfig.focusedUserId, newConfig.focusedSeatIndex);
    },
    [streamId, user?.id, applyAudioFocus]
  );

  const focusOnAll = useCallback(() => {
    if (!streamId || !user?.id) return;
    setFocusedUserId('all');
    setFocusedSeatIndex(null);
    setSeatFocus(streamId, user.id, { focusedUserId: 'all', focusedSeatIndex: null });
    applyAudioFocus('all', null);
  }, [streamId, user?.id, applyAudioFocus]);

  const toggle = useCallback(
    (seatIndex: number, seatUserId: string | null | undefined) => {
      if (focusedUserId === seatUserId && focusedSeatIndex === seatIndex) {
        focusOnAll();
      } else {
        focusOnSeat(seatIndex, seatUserId);
      }
    },
    [focusedUserId, focusedSeatIndex, focusOnSeat, focusOnAll]
  );

  const clear = useCallback(() => {
    if (!streamId || !user?.id) return;
    clearSeatFocus(streamId, user.id);
    setFocusedUserId('all');
    setFocusedSeatIndex(null);
    applyAudioFocus('all', null);
  }, [streamId, user?.id, applyAudioFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = () => setIsOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const getSeatLabel = useCallback(
    (seatIndex: number) => {
      if (focusedUserId === 'all') return 'Listen to all';
      if (focusedSeatIndex === seatIndex) return 'Listening to this person';
      return 'Listen to this person';
    },
    [focusedUserId, focusedSeatIndex]
  );

  return {
    focusedUserId,
    focusedSeatIndex,
    isOpen,
    setIsOpen,
    toggle,
    focusOnAll,
    clear,
    getSeatLabel,
    isFocused: (seatIndex: number, seatUserId?: string) =>
      focusedUserId !== 'all' && focusedSeatIndex === seatIndex,
  };
}
