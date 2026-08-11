import { Mic, PauseCircle, Camera, CameraOff, MicOff, Trophy } from 'lucide-react'
import { RemoteVideoRenderer } from './RemoteVideoRenderer'
import type { SingOffUser } from '../types'

interface HostTileProps {
  participant?: SingOffUser
  videoTrack?: any
  isSpeaking: boolean
  muted: boolean
  onSitToggle: () => void
  sitting: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
}

export function HostTile({ participant, videoTrack, isSpeaking, muted, onSitToggle, sitting, onToggleMic, onToggleCamera }: HostTileProps) {
  const showVideo = !!participant && !!videoTrack
  return (
    <div className="relative mx-auto flex flex-col items-center">
      <div className="relative flex items-center justify-center aspect-square w-52 rounded-full overflow-hidden border-4 bg-gradient-to-b from-yellow-400 via-rose-600 to-pink-700 border-yellow-300 shadow-2xl shadow-yellow-500/40">
        {showVideo ? (
          <RemoteVideoRenderer track={videoTrack} className="h-full w-full object-cover" muted={false} />
        ) : (
          <img src={participant?.avatar_url || '/placeholder.svg'} alt={participant?.display_name} className={`h-full w-full object-cover ${!isSpeaking ? 'grayscale' : ''}`} />
        )}
        <div className="absolute top-1 right-1 rounded-full bg-zinc-800/70 p-1">
          <Trophy className="w-4 h-4 text-yellow-400" />
        </div>
        <div className={`absolute inset-0 rounded-full ${isSpeaking ? 'ring-2 ring-yellow-300' : 'ring-2 ring-zinc-600'}`} />

        {/* mic/camera controls */}
        <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5">
          <button onClick={onToggleMic} className="rounded-full p-0.5 hover:bg-zinc-700" title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
          </button>
          <button onClick={onToggleCamera} className="rounded-full p-0.5 hover:bg-zinc-700" title={showVideo ? 'Stop camera' : 'Start camera'}>
            {showVideo ? <Camera className="w-3.5 h-3.5 text-white" /> : <CameraOff className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onSitToggle}
          className={`text-xs font-bold px-3 py-1 rounded-full transition ${
            sitting ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          title={sitting ? 'Speak (take the mic)' : 'Sit down'}
        >
          {sitting ? 'SIT' : 'SPEAK'}
        </button>
        {participant ? (
          <span className="text-sm font-semibold text-white">{participant.display_name}</span>
        ) : (
          <span className="text-sm text-zinc-500">Host seat</span>
        )}
      </div>
    </div>
  )
}
