export type CameraFacingMode = 'user' | 'environment'

type CameraTrackLike =
  | MediaStreamTrack
  | {
      mediaStreamTrack?: MediaStreamTrack | null
      getSettings?: () => MediaTrackSettings
    }
  | null
  | undefined

export function getCameraFacingMode(
  track: CameraTrackLike,
  fallback: CameraFacingMode = 'user',
): CameraFacingMode {
  if (!track) return fallback

  const mediaTrack =
    typeof MediaStreamTrack !== 'undefined' && track instanceof MediaStreamTrack
      ? track
      : 'mediaStreamTrack' in track
        ? track.mediaStreamTrack
        : track
  const facingMode = mediaTrack?.getSettings?.().facingMode

  return facingMode === 'environment' || facingMode === 'user'
    ? facingMode
    : fallback
}

import { applyBroadcastTrackZoom } from './broadcastTrackZoom'

export function applyCameraVideoPresentation(
  video: HTMLVideoElement,
  options: {
    track?: CameraTrackLike
    facingMode?: CameraFacingMode
    isLocal: boolean
    mirror?: boolean
  },
): void {
  const facingMode = getCameraFacingMode(options.track, options.facingMode ?? 'user')

  video.style.objectFit = 'cover'
  video.style.objectPosition = 'center'

  applyBroadcastTrackZoom(video, {
    track: options.track,
    facingMode,
    isLocal: options.isLocal,
    mirror: options.mirror,
  })
}
