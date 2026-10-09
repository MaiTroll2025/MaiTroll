import { createContext, useContext } from 'react';
import { LAUNCH_FRAMES, type ProfileFrame } from '../config/profileFrames';
import type { ProfileFrameContextValue, UserFrameData } from '../contexts/ProfileFrameContext';

export const ProfileFrameContext = createContext<ProfileFrameContextValue | null>(null);

export function useProfileFrameContext(): ProfileFrameContextValue {
  const context = useContext(ProfileFrameContext);
  if (!context) {
    return {
      getUserFrame: (): UserFrameData => ({ frameId: null, frame: null, loading: false }),
      preloadUserFrames: async () => {},
      catalog: LAUNCH_FRAMES as ProfileFrame[],
      loadCatalog: async () => {},
    };
  }
  return context;
}
