// src/lib/seatFocus.ts
// Frontend utilities for MaiTroll Seat Focus (personalized audio)

export type SeatFocusState = 'all' | string; // 'all' or seat user_id

export interface SeatFocusConfig {
  focusedUserId: SeatFocusState;
  focusedSeatIndex: number | null;
}

export function createSeatFocusKey(streamId: string, userId: string): string {
  return `seatFocus:${streamId}:${userId}`;
}

export function getSeatFocus(streamId: string, userId: string): SeatFocusConfig {
  try {
    const key = createSeatFocusKey(streamId, userId);
    const raw = localStorage.getItem(key);
    if (!raw) return { focusedUserId: 'all', focusedSeatIndex: null };
    const parsed = JSON.parse(raw);
    return {
      focusedUserId: parsed.focusedUserId || 'all',
      focusedSeatIndex: parsed.focusedSeatIndex || null,
    };
  } catch {
    return { focusedUserId: 'all', focusedSeatIndex: null };
  }
}

export function setSeatFocus(
  streamId: string,
  userId: string,
  config: SeatFocusConfig
): void {
  try {
    const key = createSeatFocusKey(streamId, userId);
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // localStorage may be unavailable
  }
}

export function clearSeatFocus(streamId: string, userId: string): void {
  try {
    const key = createSeatFocusKey(streamId, userId);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
