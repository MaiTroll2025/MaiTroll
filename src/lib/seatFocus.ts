// src/lib/seatFocus.ts
// Mai Troll Seat Focus
//
// Allows each viewer to independently choose whose seat audio they hear.
//
// "all" = hear all active seat/broadcaster audio
// user ID = hear only that specific seated user's audio
//
// Seat Focus is LOCAL to the viewer.
// Changing Seat Focus never changes audio for other viewers.

export type SeatFocusState = 'all' | string;

export interface SeatFocusConfig {
  focusedUserId: SeatFocusState;
  focusedSeatIndex: number | null;
}

/**
 * Creates the localStorage key for a viewer's Seat Focus preference.
 *
 * Each viewer gets their own preference for each broadcast.
 */
export function createSeatFocusKey(
  streamId: string,
  viewerUserId: string
): string {
  return `seatFocus:${streamId}:${viewerUserId}`;
}

/**
 * Default Seat Focus state.
 *
 * "all" means the viewer hears everyone.
 */
export function getDefaultSeatFocus(): SeatFocusConfig {
  return {
    focusedUserId: 'all',
    focusedSeatIndex: null,
  };
}

/**
 * Get the current Seat Focus preference for a viewer.
 *
 * If no preference exists, the viewer hears everyone.
 */
export function getSeatFocus(
  streamId: string,
  viewerUserId: string
): SeatFocusConfig {
  try {
    const key = createSeatFocusKey(streamId, viewerUserId);
    const raw = localStorage.getItem(key);

    if (!raw) {
      return getDefaultSeatFocus();
    }

    const parsed = JSON.parse(raw);

    const focusedUserId =
      typeof parsed?.focusedUserId === 'string'
        ? parsed.focusedUserId
        : 'all';

    const focusedSeatIndex =
      typeof parsed?.focusedSeatIndex === 'number'
        ? parsed.focusedSeatIndex
        : null;

    return {
      focusedUserId,
      focusedSeatIndex,
    };
  } catch {
    return getDefaultSeatFocus();
  }
}

/**
 * Set the viewer's Seat Focus.
 *
 * Use:
 *
 * setSeatFocus(streamId, viewerId, {
 *   focusedUserId: 'all',
 *   focusedSeatIndex: null
 * });
 *
 * OR:
 *
 * setSeatFocus(streamId, viewerId, {
 *   focusedUserId: seatUserId,
 *   focusedSeatIndex: seatIndex
 * });
 */
export function setSeatFocus(
  streamId: string,
  viewerUserId: string,
  config: SeatFocusConfig
): void {
  try {
    const key = createSeatFocusKey(streamId, viewerUserId);

    localStorage.setItem(
      key,
      JSON.stringify({
        focusedUserId: config.focusedUserId || 'all',
        focusedSeatIndex:
          typeof config.focusedSeatIndex === 'number'
            ? config.focusedSeatIndex
            : null,
      })
    );
  } catch {
    // localStorage may be unavailable.
  }
}

/**
 * Make the viewer listen to everyone.
 */
export function setSeatFocusAll(
  streamId: string,
  viewerUserId: string
): void {
  setSeatFocus(streamId, viewerUserId, {
    focusedUserId: 'all',
    focusedSeatIndex: null,
  });
}

/**
 * Make the viewer listen to one specific seat.
 */
export function setSeatFocusUser(
  streamId: string,
  viewerUserId: string,
  focusedUserId: string,
  focusedSeatIndex: number
): void {
  setSeatFocus(streamId, viewerUserId, {
    focusedUserId,
    focusedSeatIndex,
  });
}

/**
 * Check whether the viewer is currently focused on everyone.
 */
export function isSeatFocusAll(
  config: SeatFocusConfig
): boolean {
  return config.focusedUserId === 'all';
}

/**
 * Check whether the viewer is focused on a specific user.
 */
export function isSeatFocused(
  config: SeatFocusConfig,
  userId: string
): boolean {
  return (
    config.focusedUserId !== 'all' &&
    config.focusedUserId === userId
  );
}

/**
 * Clear the viewer's Seat Focus preference.
 *
 * This resets the viewer to hearing everyone.
 */
export function clearSeatFocus(
  streamId: string,
  viewerUserId: string
): void {
  try {
    const key = createSeatFocusKey(streamId, viewerUserId);
    localStorage.removeItem(key);
  } catch {
    // Ignore localStorage errors.
  }
}