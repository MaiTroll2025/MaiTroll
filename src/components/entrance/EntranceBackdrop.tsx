// src/components/entrance/EntranceBackdrop.tsx
import React from 'react'

interface EntranceBackdropProps {
  revealed: boolean
  lowPower: boolean
}

/* Mai Troll skyline silhouette with neon windows */
function CitySilhouette() {
  const windows: React.ReactNode[] = []
  const towers = [
    { x: 6, w: 9, h: 46, hue: 'green' },
    { x: 17, w: 7, h: 64, hue: 'gold' },
    { x: 26, w: 11, h: 38, hue: 'green' },
    { x: 39, w: 8, h: 72, hue: 'green' },
    { x: 49, w: 6, h: 30, hue: 'gold' },
    { x: 57, w: 12, h: 56, hue: 'green' },
    { x: 71, w: 7, h: 44, hue: 'green' },
    { x: 80, w: 9, h: 68, hue: 'gold' },
    { x: 91, w: 8, h: 40, hue: 'green' },
  ]
  towers.forEach((t, ti) => {
    const rows = Math.floor(t.h / 6)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        if (Math.random() > 0.62) {
          const color =
            t.hue === 'gold'
              ? 'rgba(227,196,106,0.9)'
              : 'rgba(120,255,190,0.9)'
          windows.push(
            <rect
              key={`w-${ti}-${r}-${c}`}
              className="gce-window"
              x={t.x + 1.5 + c * (t.w / 3.4)}
              y={100 - t.h + r * 6 + 1.5}
              width={Math.max(1.2, t.w / 6)}
              height={2.6}
              fill={color}
              style={{ animationDelay: `${Math.random() * 3.6}s` }}
            />
          )
        }
      }
    }
  })

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="gce-tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b221f" />
          <stop offset="100%" stopColor="#0a0d0c" />
        </linearGradient>
      </defs>
      {/* ground glow */}
      <rect x="0" y="98" width="100" height="2" fill="rgba(77,255,160,0.35)" />
      {towers.map((t, ti) => (
        <g key={`t-${ti}`}>
          <rect
            x={t.x}
            y={100 - t.h}
            width={t.w}
            height={t.h}
            fill="url(#gce-tower)"
            stroke="rgba(77,255,160,0.18)"
            strokeWidth="0.3"
          />
          {/* antenna light */}
          <circle
            cx={t.x + t.w / 2}
            cy={100 - t.h - 1.2}
            r="0.8"
            fill={t.hue === 'gold' ? '#e3c46a' : '#4dffa0'}
            className="gce-window"
            style={{ animationDelay: `${Math.random() * 3}s` }}
          />
        </g>
      ))}
      {windows}
    </svg>
  )
}

function Particles({ count }: { count: number }) {
  const items = Array.from({ length: count })
  return (
    <div className="gce-particles" aria-hidden="true">
      {items.map((_, i) => {
        const left = Math.random() * 100
        const dur = 6 + Math.random() * 8
        const delay = Math.random() * 6
        const drift = (Math.random() - 0.5) * 80
        const size = 2 + Math.random() * 3
        return (
          <span
            key={i}
            className="gce-particle"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
              ['--drift' as any]: `${drift}px`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function EntranceBackdrop({
  revealed,
  lowPower,
}: EntranceBackdropProps) {
  return (
    <>
      <div className="gce-backdrop" />
      <div className="gce-ambient" />
      <div className="gce-beam" />
      {!lowPower && <Particles count={18} />}
      <div className="gce-city" aria-hidden="true">
        <CitySilhouette />
      </div>
      {revealed ? null : null}
    </>
  )
}
