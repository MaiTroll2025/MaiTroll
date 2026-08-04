// src/components/entrance/EntranceControls.tsx
import React from 'react'

interface EntranceControlsProps {
  onSkip: () => void
  onEnter: () => void
}

export default function EntranceControls({
  onSkip,
  onEnter,
}: EntranceControlsProps) {
  return (
    <div className="gce-controls">
      <button
        type="button"
        className="gce-btn gce-skip"
        onClick={onSkip}
        aria-label="Skip the Mai Troll entrance animation"
      >
        Skip Entrance
      </button>

      <div className="gce-enter-wrap">
        <button
          type="button"
          className="gce-btn gce-enter"
          onClick={onEnter}
          aria-label="Enter Mai Troll"
        >
          Enter Mai Troll
        </button>
        <span className="gce-enter-hint">Or press Skip to continue</span>
      </div>
    </div>
  )
}
