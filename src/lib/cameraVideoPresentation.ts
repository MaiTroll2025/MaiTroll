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

export function applyCameraVideoPresentation(
  video: HTMLVideoElement,
  options: {
    track?: CameraTrackLike
    facingMode?: CameraFacingMode
    isLocal: boolean
  },
): void {
  const facingMode = getCameraFacingMode(options.track, options.facingMode)
  const shouldMirror = options.isLocal && facingMode === 'user'

  video.style.setProperty(
    'transform',
    shouldMirror ? 'scaleX(-1)' : 'none',
    'important',
  )
  video.style.setProperty('scale', '1', 'important')
}
