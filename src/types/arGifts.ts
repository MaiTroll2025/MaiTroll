// AR Gift Type Definitions for Face & Body Tracking Gift System

export type ARGiftCategory =
  | 'face'
  | 'body'
  | 'shoulder_pet'
  | 'hat'
  | 'mask'
  | 'glasses'
  | 'presidential'
  | 'troll_city'
  | 'creator'
  | 'celebrity'
  | 'animated'
  | 'legendary';

export type ARTrackingPoint =
  | 'eyes'
  | 'nose'
  | 'mouth'
  | 'chin'
  | 'forehead'
  | 'head'
  | 'neck'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'chest'
  | 'torso'
  | 'upper_body'
  | 'left_hand'
  | 'right_hand'
  | 'above_head'
  | 'behind_head'
  | 'back';

export type ARModelType = 'glb' | 'gltf' | 'obj' | 'fbx';

export interface ARGiftEffect {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ARGiftCategory;
  trackingPoint: ARTrackingPoint;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  icon: string;
  modelUrl?: string;
  modelType?: ARModelType;
  textureUrl?: string;
  particleEffect?: string;
  soundUrl?: string;
  durationMs: number;
  isStackable: boolean;
  isFullscreen: boolean;
  triggerType: 'instant' | 'animated_loop' | 'animated_once';
  metadata?: Record<string, unknown>;
}

export interface ARGiftInstance {
  id: string;
  giftId: string;
  gift: ARGiftEffect;
  senderId: string;
  senderName: string;
  receiverId: string;
  trackingPoint: ARTrackingPoint;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  startTime: number;
  duration: number;
  isActive: boolean;
  stackIndex: number;
  modelRef?: any;
  particleRef?: any;
}

export interface FaceLandmarks {
  nose: { x: number; y: number; z: number };
  leftEye: { x: number; y: number; z: number };
  rightEye: { x: number; y: number; z: number };
  mouth: { x: number; y: number; z: number };
  forehead: { x: number; y: number; z: number };
  chin: { x: number; y: number; z: number };
  headRotation: { pitch: number; yaw: number; roll: number };
  headPosition: { x: number; y: number; z: number };
  confidence: number;
  timestamp: number;
}

export interface BodyLandmarks {
  nose: { x: number; y: number; z: number; visibility: number };
  leftShoulder: { x: number; y: number; z: number; visibility: number };
  rightShoulder: { x: number; y: number; z: number; visibility: number };
  leftHip: { x: number; y: number; z: number; visibility: number };
  rightHip: { x: number; y: number; z: number; visibility: number };
  leftWrist: { x: number; y: number; z: number; visibility: number };
  rightWrist: { x: number; y: number; z: number; visibility: number };
  chest: { x: number; y: number; z: number };
  torsoCenter: { x: number; y: number; z: number };
  confidence: number;
  timestamp: number;
}

export interface TrackingData {
  face: FaceLandmarks | null;
  body: BodyLandmarks | null;
  fps: number;
  processingTime: number;
  isTracking: boolean;
}

export interface TrackingPointTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface ARSettings {
  faceGiftsEnabled: boolean;
  bodyGiftsEnabled: boolean;
  shoulderGiftsEnabled: boolean;
  legendaryGiftsEnabled: boolean;
  maxActiveGifts: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  smoothing: number;
  showDebugOverlay: boolean;
  isOverlayVisible?: boolean;
}

export const DEFAULT_AR_SETTINGS: ARSettings = {
  faceGiftsEnabled: true,
  bodyGiftsEnabled: true,
  shoulderGiftsEnabled: true,
  legendaryGiftsEnabled: true,
  maxActiveGifts: 20,
  quality: 'high',
  smoothing: 0.5,
  showDebugOverlay: false,
};

// Map tracking points to computed positions from landmarks
export function computeTrackingPointTransform(
  trackingPoint: ARTrackingPoint,
  face: FaceLandmarks | null,
  body: BodyLandmarks | null,
  videoWidth: number,
  videoHeight: number
): TrackingPointTransform | null {
  const toNDC = (x: number, y: number, z: number = 0) => ({
    x: (x / videoWidth) * 2 - 1,
    y: -(y / videoHeight) * 2 + 1,
    z,
  });

  if (!face && !body) return null;

  switch (trackingPoint) {
    case 'eyes': {
      if (!face) return null;
      const midX = (face.leftEye.x + face.rightEye.x) / 2;
      const midY = (face.leftEye.y + face.rightEye.y) / 2;
      const midZ = (face.leftEye.z + face.rightEye.z) / 2;
      return {
        position: toNDC(midX, midY, midZ),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1,
      };
    }
    case 'nose': {
      if (!face) return null;
      return {
        position: toNDC(face.nose.x, face.nose.y, face.nose.z),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1,
      };
    }
    case 'mouth': {
      if (!face) return null;
      return {
        position: toNDC(face.mouth.x, face.mouth.y, face.mouth.z),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1,
      };
    }
    case 'chin': {
      if (!face) return null;
      return {
        position: toNDC(face.chin.x, face.chin.y, face.chin.z),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1,
      };
    }
    case 'forehead': {
      if (!face) return null;
      return {
        position: toNDC(face.forehead.x, face.forehead.y, face.forehead.z),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1,
      };
    }
    case 'head': {
      if (!face) return null;
      return {
        position: toNDC(face.headPosition.x, face.headPosition.y - 30, face.headPosition.z - 50),
        rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
        scale: 1.2,
      };
    }
    case 'above_head': {
      if (!face) return null;
      return {
        position: toNDC(face.headPosition.x, face.headPosition.y - 80, face.headPosition.z - 80),
        rotation: { x: face.headRotation.pitch, y: 0, z: 0 },
        scale: 0.8,
      };
    }
    case 'behind_head': {
      if (!face) return null;
      return {
        position: toNDC(face.headPosition.x, face.headPosition.y, face.headPosition.z - 120),
        rotation: { x: 0, y: face.headRotation.yaw, z: 0 },
        scale: 1.5,
      };
    }
    case 'neck': {
      if (face) {
        const neckX = face.headPosition.x;
        const neckY = face.headPosition.y + (face.chin.y - face.headPosition.y) * 1.5;
        return {
          position: toNDC(neckX, neckY, face.headPosition.z + 10),
          rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
          scale: 1,
        };
      }
      if (body) {
        const neckX = body.nose.x;
        const neckY = body.nose.y + (body.leftShoulder.y - body.nose.y) * 0.3;
        return {
          position: toNDC(neckX, neckY, body.nose.z),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        };
      }
      return null;
    }
    case 'left_shoulder': {
      if (!body || body.leftShoulder.visibility < 0.5) return null;
      return {
        position: toNDC(body.leftShoulder.x, body.leftShoulder.y, body.leftShoulder.z - 20),
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
      };
    }
    case 'right_shoulder': {
      if (!body || body.rightShoulder.visibility < 0.5) return null;
      return {
        position: toNDC(body.rightShoulder.x, body.rightShoulder.y, body.rightShoulder.z - 20),
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
      };
    }
    case 'chest': {
      if (body && body.leftShoulder.visibility > 0.5 && body.rightShoulder.visibility > 0.5) {
        const cx = (body.leftShoulder.x + body.rightShoulder.x) / 2;
        const cy = (body.leftShoulder.y + body.rightShoulder.y) / 2 + (body.leftHip.y - body.leftShoulder.y) * 0.3;
        return {
          position: toNDC(cx, cy, body.nose.z - 30),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1.3,
        };
      }
      if (face) {
        const cx = face.headPosition.x;
        const cy = face.headPosition.y + (face.chin.y - face.headPosition.y) * 3;
        return {
          position: toNDC(cx, cy, face.headPosition.z - 30),
          rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
          scale: 1.3,
        };
      }
      return null;
    }
    case 'torso':
    case 'upper_body': {
      if (body && body.leftShoulder.visibility > 0.5 && body.rightShoulder.visibility > 0.5) {
        const cx = (body.leftShoulder.x + body.rightShoulder.x) / 2;
        const cy = (body.leftShoulder.y + body.leftHip.y) / 2;
        return {
          position: toNDC(cx, cy, body.nose.z - 50),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1.5,
        };
      }
      if (face) {
        const cx = face.headPosition.x;
        const cy = face.headPosition.y + (face.chin.y - face.headPosition.y) * 4;
        return {
          position: toNDC(cx, cy, face.headPosition.z - 50),
          rotation: { x: face.headRotation.pitch, y: face.headRotation.yaw, z: face.headRotation.roll },
          scale: 1.5,
        };
      }
      return null;
    }
    case 'left_hand': {
      if (!body || body.leftWrist.visibility < 0.5) return null;
      return {
        position: toNDC(body.leftWrist.x, body.leftWrist.y, body.leftWrist.z),
        rotation: { x: 0, y: 0, z: 0 },
        scale: 0.8,
      };
    }
    case 'right_hand': {
      if (!body || body.rightWrist.visibility < 0.5) return null;
      return {
        position: toNDC(body.rightWrist.x, body.rightWrist.y, body.rightWrist.z),
        rotation: { x: 0, y: 0, z: 0 },
        scale: 0.8,
      };
    }
    case 'back': {
      if (body) {
        const cx = (body.leftShoulder.x + body.rightShoulder.x) / 2;
        const cy = (body.leftShoulder.y + body.rightShoulder.y) / 2;
        return {
          position: toNDC(cx, cy, body.nose.z + 100),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 2,
        };
      }
      return null;
    }
    default:
      return null;
  }
}
