export type TrackZoomOptions = {
  track?: MediaStreamTrack | { mediaStreamTrack?: MediaStreamTrack | null } | null | undefined
  facingMode?: 'user' | 'environment'
  isLocal: boolean
  mirror?: boolean
}

let broadcastZoomLevel = 0.8
const zoomListeners = new Set<(level: number) => void>()

export function getBroadcastZoomLevel(): number {
  return broadcastZoomLevel
}

export function setBroadcastZoomLevel(level: number): number {
  broadcastZoomLevel = Math.max(0.1, Math.min(3, level))
  zoomListeners.forEach((fn) => fn(broadcastZoomLevel))
  return broadcastZoomLevel
}

export function subscribeToBroadcastZoom(listener: (level: number) => void): () => void {
  zoomListeners.add(listener)
  return () => zoomListeners.delete(listener)
}

export function applyBroadcastTrackZoom(video: HTMLVideoElement, options: TrackZoomOptions): void {
  const facingMode = options.facingMode || 'user'
  const shouldMirror = options.mirror ?? (options.isLocal && facingMode === 'user')

  const mirrorPart = shouldMirror ? 'scaleX(-1) ' : ''
  const transform = `${mirrorPart}scale(${broadcastZoomLevel})`

  video.style.setProperty('transform', transform, 'important')
  video.style.setProperty('scale', String(broadcastZoomLevel), 'important')
}

export function applyBroadcastTrackZoomNoMirror(video: HTMLVideoElement): void {
  const transform = `scale(${broadcastZoomLevel})`

  video.style.setProperty('transform', transform, 'important')
  video.style.setProperty('scale', String(broadcastZoomLevel), 'important')
}
