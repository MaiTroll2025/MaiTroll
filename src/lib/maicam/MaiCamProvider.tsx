import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MaiCamConnectionManager, type ManagerOptions } from './MaiCamConnectionManager';
import type { MaiCamState } from './types';
import { MaiCamContext } from './MaiCamContext';
export function MaiCamProvider({ children, role, deviceName }: { children: ReactNode; role?: 'phone' | 'desktop'; deviceName?: string }) {
  const [isReady, setIsReady] = useState(false);
  const managerRef = useRef<MaiCamConnectionManager | null>(null);
  const [state, setState] = useState<MaiCamState>({
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
  });
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const user = (window as any).__tc_user__ || null;
    const id = user?.id || null;
    userIdRef.current = id;
    if (!id) {
      setIsReady(false);
      return;
    }

    const mgr = new MaiCamConnectionManager({
      userId: id,
      role: role || 'desktop',
      deviceName,
      onStateChange: (s) => setState((prev) => ({ ...prev, connectionState: s })),
      onLocalStream: (s) => setState((prev) => ({ ...prev, localStream: s })),
      onRemoteStream: (s) => setState((prev) => ({ ...prev, remoteStream: s })),
      onError: (e) => setState((prev) => ({ ...prev, error: e })),
    });

    const unsub = mgr.subscribe((s) => setState(s));
    managerRef.current = mgr;
    setIsReady(true);

    return () => {
      unsub();
      mgr.destroy();
      managerRef.current = null;
      setIsReady(false);
    };
  }, [role, deviceName]);

  return (
    <MaiCamContext.Provider value={{ manager: managerRef.current, state, isReady }}>
      {children}
    </MaiCamContext.Provider>
  );
}

export type { MaiCamState, ManagerOptions };
export { MaiCamConnectionManager };
