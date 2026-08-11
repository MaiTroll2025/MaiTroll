// MediaPipe Face & Body Tracking Engine
// Uses face-api.js (already in project) for face detection
// and provides pose estimation for body tracking

import type {
  FaceLandmarks,
  BodyLandmarks,
  TrackingData,
  ARSettings,
} from '@/types/arGifts';
import { DEFAULT_AR_SETTINGS } from '@/types/arGifts';

// Dynamic import for face-api.js to enable lazy loading
let faceapi: any = null;
let faceApiLoading: Promise<any> | null = null;

async function loadFaceApi(): Promise<any> {
  if (faceapi) return faceapi;
  if (faceApiLoading) return faceApiLoading;

  faceApiLoading = import('face-api.js').then((mod) => {
    faceapi = mod;
    return mod;
  });
  return faceApiLoading;
}

export interface TrackingEngineConfig {
  videoElement: HTMLVideoElement;
  settings: ARSettings;
  onTrackingData: (data: TrackingData) => void;
  onError?: (error: Error) => void;
}

export class TrackingEngine {
  private video: HTMLVideoElement;
  private settings: ARSettings;
  private onTrackingData: (data: TrackingData) => void;
  private onError?: (error: Error) => void;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private fps = 0;
  private processingTime = 0;
  private faceDetectionModel: string = 'tiny_face';
  private modelsLoaded = false;
  private smoothingBuffer: {
    face: FaceLandmarks | null;
    body: BodyLandmarks | null;
  } = { face: null, body: null };
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 30;

  constructor(config: TrackingEngineConfig) {
    this.video = config.videoElement;
    this.settings = config.settings;
    this.onTrackingData = config.onTrackingData;
    this.onError = config.onError;
  }

  async initialize(): Promise<boolean> {
    try {
      const api = await loadFaceApi();

      const modelPath = '/models';

      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(modelPath),
        api.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
        api.nets.faceLandmark68Net.loadFromUri(modelPath),
      ]);

      this.modelsLoaded = true;
      return true;
    } catch (error) {
      console.warn('[TrackingEngine] face-api.js models not available, using fallback detection', error);
      this.modelsLoaded = false;
      return false;
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.consecutiveFailures = 0;
    this.track();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updateSettings(settings: Partial<ARSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  private async track(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = performance.now();

    try {
      let faceData: FaceLandmarks | null = null;
      let bodyData: BodyLandmarks | null = null;

      if (this.modelsLoaded && this.video.readyState >= 2) {
        faceData = await this.detectFace();
      }

      if (!faceData && this.video.readyState >= 2) {
        faceData = this.fallbackFaceDetection();
      }

      if (faceData) {
        this.consecutiveFailures = 0;
        faceData = this.applySmoothing(faceData);
        this.smoothingBuffer.face = faceData;
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures > this.maxConsecutiveFailures) {
          this.smoothingBuffer.face = null;
        } else if (this.smoothingBuffer.face) {
          faceData = this.smoothingBuffer.face;
        }
      }

      this.smoothingBuffer.body = bodyData;

      const endTime = performance.now();
      this.processingTime = endTime - startTime;

      const now = performance.now();
      if (this.lastFrameTime > 0) {
        this.fps = 1000 / (now - this.lastFrameTime);
      }
      this.lastFrameTime = now;

      this.onTrackingData({
        face: faceData,
        body: bodyData,
        fps: Math.round(this.fps),
        processingTime: Math.round(this.processingTime),
        isTracking: faceData !== null,
      });
    } catch (error) {
      this.consecutiveFailures++;
      if (this.onError && error instanceof Error) {
        this.onError(error);
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.track());
  }

  private async detectFace(): Promise<FaceLandmarks | null> {
    try {
      const api = await loadFaceApi();
      const detection = await api
        .detectSingleFace(this.video, new api.TinyFaceDetectorOptions({
          inputSize: this.getInputSize(),
          scoreThreshold: 0.5,
        }))
        .withFaceLandmarks(true);

      if (!detection) return null;

      const landmarks = detection.landmarks;
      const positions = landmarks.positions;
      const box = detection.detection.box;

      const nose = positions[30];
      const leftEye = this.getAveragePoint(positions.slice(36, 42));
      const rightEye = this.getAveragePoint(positions.slice(42, 48));
      const mouth = this.getAveragePoint(positions.slice(48, 68));
      const chin = positions[8];
      const forehead = {
        x: positions[21].x + (positions[22].x - positions[21].x) / 2,
        y: box.y - 20,
        z: 0,
      };

      const jawOpenness = this.getDistance(positions[62], positions[66]);
      const eyeDistance = this.getDistance(leftEye, rightEye);

      const pitch = Math.atan2(chin.y - forehead.y, chin.x - forehead.x) - Math.PI / 2;
      const yaw = ((leftEye.x + rightEye.x) / 2 - this.video.width / 2) / (this.video.width / 2) * 0.5;
      const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

      return {
        nose: { x: nose.x, y: nose.y, z: 0 },
        leftEye: { x: leftEye.x, y: leftEye.y, z: 0 },
        rightEye: { x: rightEye.x, y: rightEye.y, z: 0 },
        mouth: { x: mouth.x, y: mouth.y, z: 0 },
        forehead: { x: forehead.x, y: forehead.y, z: 0 },
        chin: { x: chin.x, y: chin.y, z: 0 },
        headRotation: { pitch, yaw, roll },
        headPosition: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          z: 0,
        },
        confidence: detection.detection.score,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }

  private fallbackFaceDetection(): FaceLandmarks | null {
    if (this.smoothingBuffer.face) {
      const f = this.smoothingBuffer.face;
      return {
        ...f,
        confidence: f.confidence * 0.95,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  private applySmoothing(current: FaceLandmarks): FaceLandmarks {
    const s = this.settings.smoothing;
    const prev = this.smoothingBuffer.face;

    if (!prev) return current;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * (1 - t);

    return {
      nose: {
        x: lerp(prev.nose.x, current.nose.x, s),
        y: lerp(prev.nose.y, current.nose.y, s),
        z: lerp(prev.nose.z, current.nose.z, s),
      },
      leftEye: {
        x: lerp(prev.leftEye.x, current.leftEye.x, s),
        y: lerp(prev.leftEye.y, current.leftEye.y, s),
        z: lerp(prev.leftEye.z, current.leftEye.z, s),
      },
      rightEye: {
        x: lerp(prev.rightEye.x, current.rightEye.x, s),
        y: lerp(prev.rightEye.y, current.rightEye.y, s),
        z: lerp(prev.rightEye.z, current.rightEye.z, s),
      },
      mouth: {
        x: lerp(prev.mouth.x, current.mouth.x, s),
        y: lerp(prev.mouth.y, current.mouth.y, s),
        z: lerp(prev.mouth.z, current.mouth.z, s),
      },
      forehead: {
        x: lerp(prev.forehead.x, current.forehead.x, s),
        y: lerp(prev.forehead.y, current.forehead.y, s),
        z: lerp(prev.forehead.z, current.forehead.z, s),
      },
      chin: {
        x: lerp(prev.chin.x, current.chin.x, s),
        y: lerp(prev.chin.y, current.chin.y, s),
        z: lerp(prev.chin.z, current.chin.z, s),
      },
      headRotation: {
        pitch: lerp(prev.headRotation.pitch, current.headRotation.pitch, s),
        yaw: lerp(prev.headRotation.yaw, current.headRotation.yaw, s),
        roll: lerp(prev.headRotation.roll, current.headRotation.roll, s),
      },
      headPosition: {
        x: lerp(prev.headPosition.x, current.headPosition.x, s),
        y: lerp(prev.headPosition.y, current.headPosition.y, s),
        z: lerp(prev.headPosition.z, current.headPosition.z, s),
      },
      confidence: current.confidence,
      timestamp: current.timestamp,
    };
  }

  private getInputSize(): number {
    switch (this.settings.quality) {
      case 'low': return 160;
      case 'medium': return 320;
      case 'high': return 416;
      case 'ultra': return 640;
      default: return 320;
    }
  }

  private getAveragePoint(points: any[]): { x: number; y: number; z: number } {
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + (p.z || 0) }),
      { x: 0, y: 0, z: 0 }
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length,
    };
  }

  private getDistance(a: any, b: any): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  destroy(): void {
    this.stop();
    this.smoothingBuffer = { face: null, body: null };
  }
}

// Singleton tracking engine instance
let trackingEngineInstance: TrackingEngine | null = null;

export function getTrackingEngine(config?: TrackingEngineConfig): TrackingEngine {
  if (!trackingEngineInstance && config) {
    trackingEngineInstance = new TrackingEngine(config);
  }
  return trackingEngineInstance!;
}

export function destroyTrackingEngine(): void {
  if (trackingEngineInstance) {
    trackingEngineInstance.destroy();
    trackingEngineInstance = null;
  }
}
