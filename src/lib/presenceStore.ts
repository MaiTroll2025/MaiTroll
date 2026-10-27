import { create } from 'zustand';

interface PresenceState {
  onlineCount: number;
  // Use Set for O(1) lookups instead of O(N) array scans.
  // This is critical for 1000+ online users — checking if a user is online
  // goes from O(N) array.includes() to O(1) Set.has().
  onlineUserIds: Set<string>;
  // Store room viewer counts as a map to avoid large array replacements
  roomViewerCounts: Record<string, number>;

  setOnlineUserIds: (userIds: string[]) => void;
  setRoomViewerCount: (roomId: string, count: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineCount: 0,
  onlineUserIds: new Set<string>(),
  roomViewerCounts: {},

  setOnlineUserIds: (userIds) => set((state) => {
    const nextIds = new Set(userIds);
    if (
      state.onlineUserIds.size === nextIds.size &&
      Array.from(nextIds).every((userId) => state.onlineUserIds.has(userId))
    ) {
      return state;
    }
    return { onlineUserIds: nextIds, onlineCount: nextIds.size };
  }),

  setRoomViewerCount: (roomId, count) => set((state) => {
    // Only update if the count actually changed to avoid unnecessary re-renders
    if (state.roomViewerCounts[roomId] === count) return state;

    return {
      roomViewerCounts: {
        ...state.roomViewerCounts,
        [roomId]: count
      }
    };
  }),
}));
