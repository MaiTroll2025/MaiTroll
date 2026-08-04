export const LIVEKIT_BETA_LIMITS = {
  camera: {
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameRate: 30,
    maxBitrate: 2_000_000,
  },

  screenShareEnabled: false,
} as const;

export const CAMERA_CAPTURE_OPTIONS = {
  resolution: {
    width: 1280,
    height: 720,
    frameRate: 30,
  },
} as const;

export const CAMERA_PUBLISH_OPTIONS = {
  videoCodec: 'vp8',
  videoEncoding: {
    maxBitrate: 2_000_000,
    maxFramerate: 30,
  },
} as const;