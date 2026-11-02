export type MaiCamConnectionState =
  | 'disconnected'
  | 'generating-code'
  | 'waiting-for-pairing'
  | 'pairing'
  | 'awaiting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'connection-failed'
  | 'permission-denied'
  | 'session-expired';

export type MaiCamRole = 'phone' | 'desktop';
export type MaiCamParticipant = 'publisher' | 'viewer';

export type MaiCamQuality = '480p' | '720p' | '1080p' | 'auto';
export type MaiCamFps = 15 | 24 | 30 | 60;

export interface MaiCamDevice {
  id: string;
  device_name: string;
  device_type: 'phone' | 'desktop' | 'tablet';
  browser_name?: string | null;
  last_connected_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaiCamPairingCode {
  id: string;
  user_id: string;
  code_hash: string;
  originating_device_id?: string | null;
  intended_role: MaiCamRole;
  expires_at: string;
  consumed_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
}

export interface MaiCamSession {
  id: string;
  user_id: string;
  phone_device_id?: string | null;
  desktop_device_id?: string | null;
  livekit_room_name?: string | null;
  status: 'pending' | 'connected' | 'disconnected' | 'expired' | 'revoked';
  connected_at?: string | null;
  disconnected_at?: string | null;
  last_heartbeat_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaiCamPreferences {
  id?: string;
  user_id: string;
  preferred_camera: MaiCamQuality;
  preferred_microphone: 'phone' | 'pc';
  preferred_resolution: MaiCamQuality;
  preferred_fps: MaiCamFps;
  mirror_preview: boolean;
  battery_friendly: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MaiCamState {
  connectionState: MaiCamConnectionState;
  role: MaiCamRole | null;
  session: MaiCamSession | null;
  device: MaiCamDevice | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localVideoTrack: MediaStreamTrack | null;
  localAudioTrack: MediaStreamTrack | null;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  cameraFacingMode: 'user' | 'environment';
  quality: MaiCamQuality;
  fps: MaiCamFps;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | null;
  latencyMs: number | null;
  micLevel: number | null;
  error: string | null;
}

export interface MaiCamGenerateResult {
  success: boolean;
  code?: string;
  sessionId?: string;
  roomName?: string;
  expires_at?: string;
  ttl_seconds?: number;
  error?: string;
}

export interface MaiCamConsumeResult {
  success: boolean;
  sessionId?: string;
  roomName?: string;
  intended_role?: MaiCamRole;
  error?: string;
}
