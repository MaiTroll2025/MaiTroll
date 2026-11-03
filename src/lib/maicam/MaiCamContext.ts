import { createContext } from 'react';
import type { MaiCamConnectionManager } from './MaiCamConnectionManager';
import type { MaiCamState } from './types';

export interface MaiCamContextValue {
  manager: MaiCamConnectionManager | null;
  state: MaiCamState;
  isReady: boolean;
}

export const MaiCamContext = createContext<MaiCamContextValue>({
  manager: null,
  state: {
    connectionState: 'disconnected',
    role: null,
    session: null,
    device: null,
    localStream: null,
    remoteStream: null,
    localVideoTrack: null,
    localAudioTrack: null,
    isMicEnabled: true,
    isVideoEnabled: true,
    cameraFacingMode: 'user',
    quality: '720p',
    fps: 30,
    connectionQuality: null,
    latencyMs: null,
    micLevel: null,
    error: null,
  },
  isReady: false,
});
