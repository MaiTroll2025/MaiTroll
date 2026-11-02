import { supabase } from '@/lib/supabase';
import { maicamSessionService } from './MaiCamSessionService';
import {
  type MaiCamDevice,
  type MaiCamSession,
  type MaiCamConnectionState,
  type MaiCamRole,
  type MaiCamQuality,
  type MaiCamFps,
  type MaiCamState,
  type MaiCamGenerateResult,
  type MaiCamConsumeResult,
} from './types';
import { maicamSignalingService } from './MaiCamSignalingService';
import { MaiCamSender } from './MaiCamSender';
import { MaiCamReceiver } from './MaiCamReceiver';

const LIVEKIT_URL =
  import.meta.env.VITE_LIVEKIT_URL ||
  import.meta.env.LIVEKIT_URL ||
  '';

function requestLiveKitToken(roomName: string, userId: string, participant: 'publisher' | 'viewer', role: MaiCamRole) {
  return supabase.functions.invoke('livekit-token', {
    body: {
      room: roomName,
      userId,
      identity: `${userId}-maicam-${role}`,
      role: participant,
      isHost: false,
    },
  });
}

export interface ManagerOptions {
  userId: string;
  role: MaiCamRole;
  deviceName?: string;
  onStateChange?: (state: MaiCamConnectionState) => void;
  onLocalStream?: (stream: MediaStream | null) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onError?: (err: string) => void;
}

export class MaiCamConnectionManager {
  private userId: string;
  private role: MaiCamRole;
  private deviceName: string;
  private options: Required<ManagerOptions>;

  private state: MaiCamState = {
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
  };

  private sender: MaiCamSender | null = null;
  private receiver: MaiCamReceiver | null = null;
  private signalingUnsubscribe: (() => void) | null = null;
  private sessionId: string | null = null;
  private roomName: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;


  private listeners = new Set<(s: MaiCamState) => void>();

  constructor(opts: ManagerOptions) {
    this.userId = opts.userId;
    this.role = opts.role;
    this.deviceName = opts.deviceName || `MaiCam ${opts.role === 'phone' ? 'Phone' : 'Desktop'}`;
    this.options = {
      userId: opts.userId,
      role: opts.role,
      deviceName: opts.deviceName,
      onStateChange: opts.onStateChange || (() => {}),
      onLocalStream: opts.onLocalStream || (() => {}),
      onRemoteStream: opts.onRemoteStream || (() => {}),
      onError: opts.onError || (() => {}),
    };
    this.state.role = this.role;
  }

  getState(): MaiCamState {
    return this.state;
  }

  subscribe(listener: (s: MaiCamState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<MaiCamState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  private setError(err: string | null) {
    this.setState({ error: err });
    this.options.onError(err || '');
  }

  async generateCode(): Promise<MaiCamGenerateResult> {
    this.setState({ connectionState: 'generating-code', error: null });
    const result = await maicamSessionService.generatePairingCode(
      this.role,
      this.deviceName,
      this.role,
      navigator.userAgent,
    );

    if (!result.success || !result.code) {
      this.setState({ connectionState: 'disconnected' });
      this.setError(result.error || 'Failed to generate code');
      return result;
    }

    // Build a session id + room from the returned pairing code id
    this.sessionId = result.sessionId || crypto.randomUUID();
    this.roomName = `maicam-${this.sessionId}`;

    this.setState({
      connectionState: this.role === 'phone' ? 'waiting-for-pairing' : 'waiting-for-pairing',
    });
    this.options.onStateChange(this.state.connectionState);

    // Subscribe to pairing status signaling
    this.setupSignaling(this.sessionId);

    return {
      success: true,
      code: result.code,
      sessionId: this.sessionId,
      roomName: this.roomName,
      expires_at: result.expires_at,
      ttl_seconds: result.ttl_seconds,
    };
  }

  async consumeCode(code: string): Promise<MaiCamConsumeResult> {
    this.setState({ connectionState: 'pairing', error: null });
    const result = await maicamSessionService.consumePairingCode(code);

    if (!result.success) {
      this.setState({ connectionState: 'connection-failed' });
      this.setError(result.error || 'Invalid pairing code');
      return result;
    }

    this.sessionId = result.sessionId || crypto.randomUUID();
    this.roomName = `maicam-${this.sessionId}`;

    this.setupSignaling(this.sessionId);
    // Notify the other side we've paired
    maicamSignalingService.send(this.sessionId, {
      type: 'paired',
      from: this.role,
      sessionId: this.sessionId,
    });

    await this.joinLiveKit(participantForRole(this.role));
    return { success: true, sessionId: this.sessionId, intended_role: result.intended_role };
  }

  private setupSignaling(sessionId: string) {
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
    }
    const { unsubscribe } = maicamSignalingService.subscribe(sessionId, (signal) => {
      this.handleSignal(signal);
    });
    this.signalingUnsubscribe = unsubscribe;
  }

  private handleSignal(signal: any) {
    if (signal.type === 'paired') {
      this.setState({ connectionState: 'connecting' });
      const participant = signal.from === 'phone' ? 'viewer' : 'publisher';
      this.joinLiveKit(participant);
    } else if (signal.type === 'pairing-cancelled' || signal.type === 'pairing-revoked') {
      this.setState({ connectionState: 'session-expired' });
      this.setError('Pairing was cancelled or revoked');
    } else if (signal.type === 'device-disconnected') {
      this.setState({ connectionState: 'disconnected' });
    } else if (signal.type === 'switch-camera' && this.sender) {
      const facingMode = signal.payload?.facingMode as 'user' | 'environment';
      if (facingMode) {
        this.sender.switchCamera(facingMode).catch(() => {});
        this.setState({ cameraFacingMode: facingMode });
      }
    }
  }

  private async joinLiveKit(participant: 'publisher' | 'viewer') {
    if (!this.roomName || !this.userId) return;
    this.setState({ connectionState: 'connecting' });

    try {
      const { data, error } = await requestLiveKitToken(this.roomName, this.userId, participant, this.role);
      if (error || !data?.token) {
        throw new Error(data?.error || 'LiveKit token failed');
      }

      const token = data.token;
      const url = data.url || LIVEKIT_URL;

      if (!url) {
        throw new Error('LiveKit server URL is not configured. Set VITE_LIVEKIT_URL in your environment variables.');
      }

      if (participant === 'publisher') {
        // Phone side: publish camera+mic
        this.sender = new MaiCamSender({ roomName: this.roomName, token, livekitUrl: url });
        this.sender.onStateChange((s) => {
          if (s === 'connected') {
            this.reconnectAttempts = 0;
            this.setState({ connectionState: 'connected', error: null });
          }
          else if (s === 'disconnected') this.handleDisconnect();
          else if (s === 'reconnecting') this.setState({ connectionState: 'reconnecting' });
        });
        this.sender.onLocalStream((stream) => {
          this.setState({ localStream: stream });
          this.options.onLocalStream(stream);
        });
        this.sender.onError((err) => this.setError(err));

        await this.sender.connect();
        await this.sender.startCapture({
          video: this.state.isVideoEnabled,
          audio: this.state.isMicEnabled,
          quality: this.state.quality,
          fps: this.state.fps,
          facingMode: this.state.cameraFacingMode,
        });

        this.markDeviceConnected();
      } else {
        // PC side: subscribe to phone's tracks
        this.receiver = new MaiCamReceiver({ roomName: this.roomName, token, livekitUrl: url });
        this.receiver.onStateChange((s) => {
          if (s === 'connected') {
            this.reconnectAttempts = 0;
            this.setState({ connectionState: 'connected', error: null });
          }
          else if (s === 'disconnected') this.handleDisconnect();
          else if (s === 'reconnecting') this.setState({ connectionState: 'reconnecting' });
        });
        this.receiver.onRemoteStream((stream) => {
          this.setState({ remoteStream: stream });
          this.options.onRemoteStream(stream);
        });
        this.receiver.onError((err) => this.setError(err));

        await this.receiver.connect();
        this.markDeviceConnected();
      }
    } catch (err: any) {
      const msg = err?.message || 'LiveKit connection failed';
      this.setState({ connectionState: 'connection-failed' });
      this.setError(msg);
    }
  }

  private markDeviceConnected() {
    maicamSessionService.markDeviceConnected(this.sessionId || '');
  }

  private handleDisconnect() {
    this.setState({ connectionState: 'disconnected', localStream: null, remoteStream: null });
    this.sender?.stop();
    this.receiver?.stop();
    this.sender = null;
    this.receiver = null;
  }

  async restartCapture({
    video = true,
    audio = true,
    quality = '720p',
    fps = 30,
    facingMode = 'user',
  }: {
    video?: boolean;
    audio?: boolean;
    quality?: MaiCamQuality;
    fps?: MaiCamFps;
    facingMode?: 'user' | 'environment';
  } = {}): Promise<void> {
    if (!this.sender) throw new Error('Sender not active');
    await this.sender.startCapture({ video, audio, quality, fps, facingMode });
    this.setState({ isVideoEnabled: video, isMicEnabled: audio, cameraFacingMode: facingMode, quality, fps });
  }

  async disconnect() {
    this.signalingUnsubscribe?.();
    this.signalingUnsubscribe = null;
    this.sender?.stop();
    this.receiver?.stop();
    this.sender = null;
    this.receiver = null;
    this.setState({
      connectionState: 'disconnected',
      localStream: null,
      remoteStream: null,
      localVideoTrack: null,
      localAudioTrack: null,
    });
  }

  async reconnect() {
    this.reconnectAttempts = 0;
    await this.disconnect();
    this.setState({ connectionState: 'reconnecting' });
    if (this.sessionId) {
      await this.joinLiveKit(this.role === 'phone' ? 'publisher' : 'viewer');
    }
  }

  setVideoEnabled(enabled: boolean) {
    this.setState({ isVideoEnabled: enabled });
    this.sender?.setVideoEnabled(enabled);
  }
  setMicEnabled(enabled: boolean) {
    this.setState({ isMicEnabled: enabled });
    this.sender?.setMicEnabled(enabled);
  }
  async switchCamera(facingMode: 'user' | 'environment') {
    this.setState({ cameraFacingMode: facingMode });
    await this.sender?.switchCamera(facingMode);
  }

  async requestCameraSwitch(facingMode: 'user' | 'environment') {
    this.setState({ cameraFacingMode: facingMode });
    if (this.role === 'phone' && this.sender) {
      await this.sender.switchCamera(facingMode);
      return;
    }
    maicamSignalingService.send(this.sessionId || '', {
      type: 'switch-camera',
      from: this.role,
      sessionId: this.sessionId,
      payload: { facingMode },
    });
  }
  setQuality(quality: MaiCamQuality, fps: MaiCamFps) {
    this.setState({ quality, fps });
    // Recreate capture on sender if connected
  }

  get localStream(): MediaStream | null {
    return this.state.localStream;
  }
  get remoteStream(): MediaStream | null {
    return this.state.remoteStream;
  }

  async listDevices(): Promise<MaiCamDevice[]> {
    return maicamSessionService.listDevices();
  }
  async listSessions(): Promise<MaiCamSession[]> {
    return maicamSessionService.listSessions();
  }

  async destroy() {
    await this.disconnect();
    this.listeners.clear();
  }
}

function participantForRole(role: MaiCamRole): 'publisher' | 'viewer' {
  return role === 'phone' ? 'publisher' : 'viewer';
}

export default MaiCamConnectionManager;
