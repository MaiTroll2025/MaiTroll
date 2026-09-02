// src/components/entrance/CeremonyRibbon.tsx
import React from 'react'

interface CeremonyRibbonProps {
  visible: boolean
  separated: boolean
}

export default function CeremonyRibbon({
  visible,
  separated,
}: CeremonyRibbonProps) {
  return (
    <div
      className={`gce-ribbon ${visible ? 'gce-is-ribbon' : ''} ${
        separated ? 'gce-is-separated' : ''
      }`}
      aria-hidden="true"
    >
      {/* Left half of ribbon */}
      <div className="gce-ribbon-half gce-ribbon-left">
        {/* Ribbon folds/creases for realism */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.3,
            mixBlendMode: 'overlay',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="20" y1="0" x2="20" y2="100" stroke="#000" strokeWidth="2" opacity="0.4" />
          <line x1="40" y1="0" x2="40" y2="100" stroke="#fff" strokeWidth="1" opacity="0.3" />
          <line x1="60" y1="0" x2="60" y2="100" stroke="#000" strokeWidth="2" opacity="0.3" />
          <line x1="80" y1="0" x2="80" y2="100" stroke="#fff" strokeWidth="1" opacity="0.2" />
        </svg>
      </div>

      {/* Right half of ribbon */}
      <div className="gce-ribbon-half gce-ribbon-right">
        {/* Ribbon folds/creases for realism */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.3,
            mixBlendMode: 'overlay',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="20" y1="0" x2="20" y2="100" stroke="#fff" strokeWidth="2" opacity="0.3" />
          <line x1="40" y1="0" x2="40" y2="100" stroke="#000" strokeWidth="1" opacity="0.4" />
          <line x1="60" y1="0" x2="60" y2="100" stroke="#fff" strokeWidth="2" opacity="0.2" />
          <line x1="80" y1="0" x2="80" y2="100" stroke="#000" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>

      {/* Center text with glow */}
      <span className="gce-ribbon-text">Mai Troll</span>
    </div>
  )
}
