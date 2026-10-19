import { useEffect, useRef } from 'react'

interface RemoteVideoRendererProps {
  track: MediaStreamTrack | null
  poster?: string
  className?: string
  muted?: boolean
}

export function RemoteVideoRenderer({ track, poster, className, muted = false }: RemoteVideoRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!track || !videoElement) return
    const stream = new MediaStream([track])
    videoElement.srcObject = stream
    return () => {
      if (videoElement.srcObject === stream) videoElement.srcObject = null
    }
  }, [track])

  if (!track) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50">
        {poster ? <img src={poster} alt="avatar" className="h-full w-full object-cover" /> : null}
        <span className="text-xs text-zinc-400">Waiting for video…</span>
      </div>
    )
  }

  return <video ref={videoRef} autoPlay playsInline muted={muted} className={className} />
}
