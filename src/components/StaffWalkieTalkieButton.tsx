import React from 'react'
import { Radio, Pause, Send } from 'lucide-react'
import { useStaffWalkieTalkieContext } from '@/hooks/useStaffWalkieTalkieContext'

interface StaffWalkieTalkieButtonProps {
  onLiveKitMicMute?: () => void
  onLiveKitMicUnmute?: () => void
  showFullControls?: boolean
}

export function StaffWalkieTalkieButton({ onLiveKitMicMute, onLiveKitMicUnmute, showFullControls = true }: StaffWalkieTalkieButtonProps) {
  const {
    isConnected,
    isSpeaking,
    isJoining,
    canAccessWalkieTalkie,
    joinWalkieTalkie,
    leaveWalkieTalkie,
    toggleSpeaking,
  } = useStaffWalkieTalkieContext()

  const handleJoin = () => {
    if (!canAccessWalkieTalkie) return
    onLiveKitMicMute?.()
    joinWalkieTalkie()
  }

  const handleLeave = () => {
    leaveWalkieTalkie()
    onLiveKitMicUnmute?.()
  }

  const handlePress = (e: React.MouseEvent) => {
    if (!isConnected || !canAccessWalkieTalkie) return
    e.preventDefault()
    toggleSpeaking(true)
  }

  const handleRelease = (e: React.MouseEvent) => {
    if (!isConnected || !canAccessWalkieTalkie) return
    e.preventDefault()
    toggleSpeaking(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isConnected || !canAccessWalkieTalkie) return
    if (e.code === 'Space') {
      e.preventDefault()
      toggleSpeaking(true)
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!isConnected || !canAccessWalkieTalkie) return
    if (e.code === 'Space') {
      e.preventDefault()
      toggleSpeaking(false)
    }
  }

  if (!canAccessWalkieTalkie) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={isConnected ? handleLeave : handleJoin}
        disabled={isJoining}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isConnected
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-cyan-600 text-white hover:bg-cyan-700'
        } disabled:opacity-50`}
        title={isConnected ? 'Leave Walkie-Talkie' : 'Join Staff Walkie-Talkie'}
      >
        {isJoining ? (
          <>
            <Radio className="h-4 w-4 animate-pulse" />
            Connecting...
          </>
        ) : isConnected ? (
          <>
            <Radio className="h-4 w-4" />
            Leave Walkie
          </>
        ) : (
          <>
            <Radio className="h-4 w-4" />
            Join Walkie
          </>
        )}
      </button>

      {showFullControls && isConnected && (
        <button
          type="button"
          onMouseDown={handlePress}
          onMouseUp={handleRelease}
          onMouseLeave={handleRelease}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onTouchStart={(e) => { e.preventDefault(); toggleSpeaking(true) }}
          onTouchEnd={(e) => { e.preventDefault(); toggleSpeaking(false) }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isSpeaking
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
          title="Hold to speak"
        >
          {isSpeaking ? (
            <>
              <Send className="h-4 w-4" />
              Speaking...
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              Hold to Speak
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default StaffWalkieTalkieButton