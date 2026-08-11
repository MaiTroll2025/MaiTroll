import { useEffect, useRef } from 'react'

interface RemoteVideoRendererProps {
  track: any
  poster?: string
  className?: string
  muted?: boolean
}

export function RemoteVideoRenderer({ track, poster, className, muted = false }: RemoteVideoRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!track || !videoRef.current) return
    try {
      track.attach(videoRef.current)
      track.setMuted(muted)
    } catch (e) {
      console.warn('[singoff] track attach failed', e)
    }
    return () => {
      try {
        track.detach(videoRef.current as HTMLVideoElement)
      } catch {}
    }
  }, [track, muted])

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
