// src/components/entrance/CeremonyScissors.tsx
import React from 'react'

interface CeremonyScissorsProps {
  visible: boolean
  cut: boolean
  separated: boolean
}

export default function CeremonyScissors({
  visible,
  cut,
  separated,
}: CeremonyScissorsProps) {
  const cls = [
    'gce-scissors',
    visible ? 'gce-is-scissors' : '',
    cut ? 'gce-is-cut' : '',
    separated ? 'gce-is-separated' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} aria-hidden="true">
      <svg viewBox="0 0 200 120" width="100%" height="100%">
        <defs>
          {/* Metallic gradient for blades */}
          <linearGradient id="bladeMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#88ffff', stopOpacity: 1 }} />
            <stop offset="35%" style={{ stopColor: '#00ffff', stopOpacity: 1 }} />
            <stop offset="65%" style={{ stopColor: '#ff00ff', stopOpacity: 0.9 }} />
            <stop offset="100%" style={{ stopColor: '#aa00ff', stopOpacity: 0.8 }} />
          </linearGradient>
          
          {/* Handle gradient */}
          <radialGradient id="handleMetal" cx="30%" cy="30%">
            <stop offset="0%" style={{ stopColor: '#ffff88', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#aa8800', stopOpacity: 1 }} />
          </radialGradient>

          {/* Glow filter */}
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Top blade */}
        <g
          className="gce-scissor-blade gce-scissor-blade-top"
          style={{ transformBox: 'fill-box' } as any}
        >
          {/* Main blade shape - wider and more realistic */}
          <path
            d="M150 30 Q155 28 160 30 L70 46 Q60 48 50 50 L40 52 Q30 53 25 50 L150 30 Z"
            fill="url(#bladeMetal)"
            stroke="#00ffff"
            strokeWidth="1.5"
            filter="url(#neonGlow)"
          />
          
          {/* Blade highlight - creates metallic effect */}
          <path
            d="M150 32 Q155 31 160 32 L75 44 Q70 45 55 47 L42 49"
            stroke="#ffffff"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />

          {/* Blade shadow */}
          <path
            d="M148 34 Q152 33 158 35 L68 48 Q58 50 45 52 L38 54"
            stroke="#4400ff"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />

          {/* Pivot ring - enhanced */}
          <circle cx="158" cy="26" r="16" fill="none" stroke="#ff00ff" strokeWidth="2.5" opacity="0.7" />
          <circle cx="158" cy="26" r="14" fill="none" stroke="#00ffff" strokeWidth="1.5" opacity="0.9" />
          
          {/* Handle with gradient */}
          <circle cx="158" cy="26" r="10" fill="url(#handleMetal)" opacity="0.85" />
          <circle cx="158" cy="26" r="9.5" fill="none" stroke="#ffff88" strokeWidth="1" opacity="0.6" />
        </g>

        {/* Bottom blade */}
        <g
          className="gce-scissor-blade gce-scissor-blade-bottom"
          style={{ transformBox: 'fill-box' } as any}
        >
          {/* Main blade shape */}
          <path
            d="M150 90 Q155 92 160 90 L70 74 Q60 72 50 70 L40 68 Q30 67 25 70 L150 90 Z"
            fill="url(#bladeMetal)"
            stroke="#ff00ff"
            strokeWidth="1.5"
            filter="url(#neonGlow)"
          />
          
          {/* Blade highlight */}
          <path
            d="M150 88 Q155 89 160 88 L75 76 Q70 75 55 73 L42 71"
            stroke="#ffffff"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />

          {/* Blade shadow */}
          <path
            d="M148 86 Q152 87 158 85 L68 72 Q58 70 45 68 L38 66"
            stroke="#4400ff"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />

          {/* Pivot ring */}
          <circle cx="158" cy="94" r="16" fill="none" stroke="#00ffff" strokeWidth="2.5" opacity="0.7" />
          <circle cx="158" cy="94" r="14" fill="none" stroke="#ff00ff" strokeWidth="1.5" opacity="0.9" />
          
          {/* Handle */}
          <circle cx="158" cy="94" r="10" fill="url(#handleMetal)" opacity="0.85" />
          <circle cx="158" cy="94" r="9.5" fill="none" stroke="#ffff88" strokeWidth="1" opacity="0.6" />
        </g>

        {/* Center pivot - enhanced screw detail */}
        <g>
          <circle cx="40" cy="60" r="7" fill="#2a2a2a" stroke="#00ffff" strokeWidth="2" />
          <circle cx="40" cy="60" r="5.5" fill="#1a1a1a" />
          
          {/* Screw detail */}
          <line x1="38" y1="60" x2="42" y2="60" stroke="#ffff88" strokeWidth="1.2" opacity="0.8" />
          <line x1="40" y1="58" x2="40" y2="62" stroke="#ffff88" strokeWidth="1.2" opacity="0.8" />
          
          {/* Glow around pivot */}
          <circle cx="40" cy="60" r="8.5" fill="none" stroke="#00ffff" strokeWidth="0.5" opacity="0.5" />
        </g>
      </svg>
    </div>
  )
}
