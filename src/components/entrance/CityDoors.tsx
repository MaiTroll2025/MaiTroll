// src/components/entrance/CityDoors.tsx
import React from 'react'

function MaiTrollCrest() {
  return (
    <svg className="gce-crest" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="gce-crest-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9bffca" />
          <stop offset="100%" stopColor="#1faf6a" />
        </linearGradient>
        <linearGradient id="gce-crest-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e3c46a" />
          <stop offset="100%" stopColor="#b8923a" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="url(#gce-crest-g)"
        strokeWidth="3"
      />
      <circle
        cx="50"
        cy="50"
        r="37"
        fill="none"
        stroke="rgba(227,196,106,0.5)"
        strokeWidth="1"
      />
      {/* city skyline inside crest */}
      <g fill="url(#gce-crest-g)">
        <rect x="30" y="56" width="8" height="18" />
        <rect x="40" y="48" width="9" height="26" />
        <rect x="51" y="42" width="8" height="32" />
        <rect x="61" y="54" width="9" height="20" />
      </g>
      {/* broadcast tower */}
      <line x1="50" y1="40" x2="50" y2="22" stroke="url(#gce-crest-gold)" strokeWidth="2" />
      <circle cx="50" cy="20" r="3" fill="url(#gce-crest-gold)" />
      {/* T monogram */}
      <path
        d="M44 70 L50 62 L56 70 M50 62 V76"
        stroke="url(#gce-crest-gold)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Door({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={side === 'left' ? 'gce-door gce-door-left' : 'gce-door gce-door-right'}>
      <div className="gce-door-panel">
        <span className="gce-seam gce-seam-1" />
        <span className="gce-seam gce-seam-2" />
        <span className="gce-seam gce-seam-3" />
        <MaiTrollCrest />
        <span className="gce-door-name">MAIMaiTroll</span>
      </div>
      <span className="gce-handle" />
    </div>
  )
}

export default function CityDoors() {
  return (
    <div className="gce-doors" aria-hidden="true">
      <Door side="left" />
      <Door side="right" />
    </div>
  )
}
