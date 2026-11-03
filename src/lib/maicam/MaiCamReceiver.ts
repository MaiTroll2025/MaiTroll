import {
  Room,
  Track,
  RemoteTrackPublication,
} from 'livekit-client';

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

export class MaiCamReceiver {
  private room: Room | null = null;
  private remoteStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private attachedVideoEl: HTMLVideoElement | null = null;

  private readonly roomName: string;
  private readonly token: string;
  private readonly livekitUrl: string;

  private stateChangeCb: ((state: string) => void) | null = null;
  private remoteStreamCb: ((stream: MediaStream) => void) | null = null;
  private errorCb: ((err: string) => void) | null = null;

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
  onRemoteStream(cb: (stream: MediaStream) => void) {
    this.remoteStreamCb = cb;
  }
  onError(cb: (err: string) => void) {
    this.errorCb = cb;
  }

  private emitState(state: string) {
    this.stateChangeCb?.(state);
  }
  private emitError(err: string) {
    this.errorCb?.(err);
    console.error('[MaiCamReceiver]', err);
  }

  get isConnected(): boolean {
    return this.room ? this.room.state === 'connected' : false;
  }
  get stream(): MediaStream | null {
    return this.remoteStream;
  }

  async connect(): Promise<void> {
    if (!this.livekitUrl) {
      this.emitError('LiveKit URL not configured');
      return;
    }
    this.emitState('connecting');
    try {
      this.room = new Room();
      this.room.on('disconnected', () => {
        this.emitState('disconnected');
      });
      this.room.on('reconnecting', () => this.emitState('reconnecting'));
      this.room.on('reconnected', () => this.emitState('connected'));

      this.room.on('trackSubscribed', (track, publication, _participant) => {
        this.handleTrackSubscribed(track, publication);
      });
      this.room.on('trackUnsubscribed', (track, _publication, _participant) => {
        this.handleTrackUnsubscribed(track);
      });

      await this.room.connect(this.livekitUrl, this.token, {
        rtcConfig: RTC_CONFIG,
      });
      this.emitState('connected');

      // Subscribe to any tracks already published
      for (const participant of this.room.remoteParticipants.values()) {
        for (const pub of participant.videoTrackPublications.values()) {
          if (pub.track) this.handleTrackSubscribed(pub.track, pub);
        }
        for (const pub of participant.audioTrackPublications.values()) {
          if (pub.track) this.handleTrackSubscribed(pub.track, pub);
        }
      }
    } catch (err: any) {
      this.emitError(`LiveKit connect failed: ${err?.message || err}`);
    }
  }

  private handleTrackSubscribed(track: any, _publication: RemoteTrackPublication) {
    if (track.kind === Track.Kind.Video) {
      this.videoTrack = track.mediaStreamTrack;
    } else if (track.kind === Track.Kind.Audio) {
      this.audioTrack = track.mediaStreamTrack;
    }
    this.rebuildStream();
  }

  private handleTrackUnsubscribed(track: any) {
    if (track.kind === Track.Kind.Video && this.videoTrack === track.mediaStreamTrack) {
      this.videoTrack = null;
    }
    if (track.kind === Track.Kind.Audio && this.audioTrack === track.mediaStreamTrack) {
      this.audioTrack = null;
    }
    this.rebuildStream();
  }

  private rebuildStream() {  const tracks: MediaStreamTrack[] = [];
    if (this.videoTrack) tracks.push(this.videoTrack);
    if (this.audioTrack) tracks.push(this.audioTrack);

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
    }
    this.remoteStream = new MediaStream(tracks);

    if (this.attachedVideoEl) {
      this.attachedVideoEl.srcObject = this.remoteStream;
      try { this.attachedVideoEl.play().catch(() => {}); } catch {}
    }

    this.remoteStreamCb?.(this.remoteStream);
  }

  attachVideoElement(el: HTMLVideoElement) {
    this.attachedVideoEl = el;
    if (this.remoteStream) {
      el.srcObject = this.remoteStream;
      el.muted = true;
      el.playsInline = true;
      try { el.play().catch(() => {}); } catch {}
    }
  }

  detachVideoElement() {
    if (this.attachedVideoEl) {
      this.attachedVideoEl.srcObject = null;
      this.attachedVideoEl = null;
    }
  }

  setRemoteAudioMuted(muted: boolean) {
    if (this.audioTrack) this.audioTrack.enabled = !muted;
  }

  async stop(): Promise<void> {
    this.detachVideoElement();
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
    this.videoTrack = null;
    this.audioTrack = null;
    if (this.room) {
      try { await this.room.disconnect(); } catch {}
      this.room = null;
    }
    this.emitState('disconnected');
  }
}

export default MaiCamReceiver;
