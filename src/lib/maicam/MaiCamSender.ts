import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
} from 'livekit-client';
import type { MaiCamQuality, MaiCamFps } from './types';

const LIVEKIT_URL =
  import.meta.env.VITE_LIVEKIT_URL ||
  import.meta.env.LIVEKIT_URL ||
  '';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function qualityConstraints(quality: MaiCamQuality): { width: number; height: number } {
  switch (quality) {
    case '480p': return { width: 640, height: 480 };
    case '1080p': return { width: 1920, height: 1080 };
    case '720p':
    default: return { width: 1280, height: 720 };
  }
}

export class MaiCamSender {
  private room: Room | null = null;
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private lvTrack: LocalVideoTrack | null = null;
  private laTrack: LocalAudioTrack | null = null;

  private readonly roomName: string;
  private readonly token: string;
  private readonly livekitUrl: string;

  private stateChangeCb: ((state: string) => void) | null = null;
  private localStreamCb: ((stream: MediaStream) => void) | null = null;
  private errorCb: ((err: string) => void) | null = null;

  private captureConstraints: MediaStreamConstraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  };

  constructor(params: {
    roomName: string;
    token: string;
    livekitUrl?: string;
  }) {
    this.roomName = params.roomName;
    this.token = params.token;
    this.livekitUrl = params.livekitUrl || LIVEKIT_URL;
  }

  onStateChange(cb: (state: string) => void) {
    this.stateChangeCb = cb;
  }
  onLocalStream(cb: (stream: MediaStream) => void) {
    this.localStreamCb = cb;
  }
  onError(cb: (err: string) => void) {
    this.errorCb = cb;
  }

  private emitState(state: string) {
    this.stateChangeCb?.(state);
  }
  private emitError(err: string) {
    this.errorCb?.(err);
    console.error('[MaiCamSender]', err);
  }

  get isConnected(): boolean {
    return this.room ? this.room.state === 'connected' : false;
  }
  get stream(): MediaStream | null {
    return this.mediaStream;
  }

  setCaptureConstraints(constraints: MediaStreamConstraints) {
    this.captureConstraints = constraints;
  }

  async connect(): Promise<void> {
    if (!this.livekitUrl) {
      this.emitError('LiveKit URL not configured');
      return;
    }
    this.emitState('connecting');
    try {
      this.room = new Room();
      this.room.on('disconnected', () => this.emitState('disconnected'));
      this.room.on('reconnecting', () => this.emitState('reconnecting'));
      this.room.on('reconnected', () => this.emitState('connected'));

      await this.room.connect(this.livekitUrl, this.token, {
        rtcConfig: RTC_CONFIG,
      });
      this.emitState('connected');
    } catch (err: any) {
      this.emitError(`LiveKit connect failed: ${err?.message || err}`);
    }
  }

  async startCapture({
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
  } = {}): Promise<MediaStream | null> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('LiveKit room not connected');
    }

    const res = qualityConstraints(quality);
    const constraints: MediaStreamConstraints = {};

    if (video) {
      constraints.video = {
        facingMode,
        width: { ideal: res.width },
        height: { ideal: res.height },
        frameRate: { ideal: fps },
      } as any;
    }
    if (audio) {
      constraints.audio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera/microphone permission denied'
        : err?.name === 'NotFoundError'
        ? 'No camera/microphone found'
        : `getUserMedia failed: ${err?.message || err}`;
      this.emitError(msg);
      throw err;
    }

    this.videoTrack = this.mediaStream.getVideoTracks()[0] || null;
    this.audioTrack = this.mediaStream.getAudioTracks()[0] || null;

    if (this.videoTrack) {
      this.lvTrack = new LocalVideoTrack(this.videoTrack);
      this.lvTrack.source = Track.Source.Camera;
    }
    if (this.audioTrack) {
      this.laTrack = new LocalAudioTrack(this.audioTrack);
      this.laTrack.source = Track.Source.Microphone;
    }

    try {
      if (this.lvTrack) await this.room.localParticipant.publishTrack(this.lvTrack);
      if (this.laTrack) await this.room.localParticipant.publishTrack(this.laTrack);
    } catch (err: any) {
      this.emitError(`Publish failed: ${err?.message || err}`);
      throw err;
    }

    this.emitState('connected');
    this.localStreamCb?.(this.mediaStream);
    return this.mediaStream;
  }

  async switchCamera(facingMode: 'user' | 'environment'): Promise<void> {
    if (!this.videoTrack || !this.room || this.room.state !== 'connected') return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) throw new Error('No video track');

      const newLvTrack = new LocalVideoTrack(newTrack);
      newLvTrack.source = Track.Source.Camera;

      const existing = this.lvTrack;
      await this.room.localParticipant.publishTrack(newLvTrack);
      this.lvTrack = newLvTrack;
      this.videoTrack = newTrack;
      this.mediaStream = new MediaStream([...(this.audioTrack ? [this.audioTrack] : []), newTrack]);

      try { await this.room.localParticipant.unpublishTrack(existing); } catch {}
      existing.stop();

      this.localStreamCb?.(this.mediaStream);
    } catch (err: any) {
      this.emitError(`Switch camera failed: ${err?.message || err}`);
    }
  }

  setMicEnabled(enabled: boolean) {
    if (this.audioTrack) this.audioTrack.enabled = enabled;
    if (this.laTrack) this.laTrack.mediaStreamTrack.enabled = enabled;
  }

  setVideoEnabled(enabled: boolean) {
    if (this.videoTrack) this.videoTrack.enabled = enabled;
    if (this.lvTrack) this.lvTrack.mediaStreamTrack.enabled = enabled;
  }

  async stop(): Promise<void> {
    if (this.videoTrack) {
      try { this.videoTrack.stop(); } catch {}
      this.videoTrack = null;
    }
    if (this.audioTrack) {
      try { this.audioTrack.stop(); } catch {}
      this.audioTrack = null;
    }
    if (this.lvTrack) {
      try { await this.room?.localParticipant.unpublishTrack(this.lvTrack); } catch {}
      try { this.lvTrack.stop(); } catch {}
      this.lvTrack = null;
    }
    if (this.laTrack) {
      try { await this.room?.localParticipant.unpublishTrack(this.laTrack); } catch {}
      try { this.laTrack.stop(); } catch {}
      this.laTrack = null;
    }
    this.mediaStream = null;
    if (this.room) {
      try { await this.room.disconnect(); } catch {}
      this.room = null;
    }
    this.emitState('disconnected');
  }
}

export default MaiCamSender;
