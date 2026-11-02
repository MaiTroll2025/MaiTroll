import { create } from 'zustand';

export type MaiCamMediaRole = 'phone' | 'desktop' | null;

interface MaiCamMediaState {
  role: MaiCamMediaRole;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  setRole: (role: MaiCamMediaRole) => void;
  setConnectionState: (s: MaiCamMediaState['connectionState']) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useMaiCamMedia = create<MaiCamMediaState>((set) => ({
  role: null,
  connectionState: 'disconnected',
  localStream: null,
  remoteStream: null,
  error: null,
  setRole: (role) => set({ role }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setError: (error) => set({ error }),
  reset: () => set({ role: null, connectionState: 'disconnected', localStream: null, remoteStream: null, error: null }),
}));
