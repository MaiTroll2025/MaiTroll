// src/components/entrance/EntranceTitle.tsx
import React from 'react'

interface EntranceTitleProps {
  welcomeVisible: boolean
  titleVisible: boolean
  subtitleVisible: boolean
  showBeta: boolean
}

export default function EntranceTitle({
  welcomeVisible,
  titleVisible,
  subtitleVisible,
  showBeta,
}: EntranceTitleProps) {
  return (
    <div className="gce-title">
      {showBeta && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 'clamp(10px, 1.8vw, 20px)',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 'clamp(10px, 1.6vw, 14px)',
            fontWeight: 800,
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: 'rgba(227,196,106,0.95)',
            background: 'rgba(20,28,24,0.6)',
            border: '1px solid rgba(227,196,106,0.45)',
            boxShadow: '0 0 22px rgba(227,196,106,0.25)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4dffa0',
              boxShadow: '0 0 10px #4dffa0',
            }}
          />
          Beta Phase
        </div>
      )}

      <div className="gce-welcome" style={welcomeVisible ? undefined : { opacity: 0 }}>
        Welcome to
      </div>

      <h1 className="gce-title-main" style={titleVisible ? undefined : { opacity: 0 }}>
        MAIMaiTroll.COM
      </h1>

      <div
        className="gce-subtitle"
        style={subtitleVisible ? undefined : { opacity: 0 }}
      >
        The very first
        <br />
        virtual broadcasting city
      </div>
    </div>
  )
}
