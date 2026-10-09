import React, { useEffect, useState } from 'react';
import { useBroadcastEffects } from '../hooks/useBroadcastEffects';

interface GlassCrackEffectProps {
  className?: string;
}

export function GlassCrackEffect({ className = '' }: GlassCrackEffectProps) {
  const { state } = useBroadcastEffects();
  const [visible, setVisible] = useState(false);
  const [crackOpacity, setCrackOpacity] = useState(0);

  const glassEffect = state.activeEffects.find(e => e.type === 'glass_crack');

  useEffect(() => {
    if (glassEffect) {
      setVisible(true);
      setCrackOpacity(1);
      
      const fadeOutTimer = setTimeout(() => {
        setCrackOpacity(0.7);
      }, 4500);

      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 5000);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [glassEffect]);

  if (!visible || !glassEffect) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] pointer-events-none ${className}`}
      style={{ opacity: crackOpacity }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-pulse" />
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="crackGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0.3" />
          </radialGradient>
        </defs>
        <path 
          d="M50 0 L45 20 L55 25 L40 50 L60 45 L50 75 L55 100 M50 0 L55 30 L40 35 L30 60 L20 55 L10 80 L5 100 M50 0 L40 25 L30 20 L25 45 L10 50 L0 75 L5 100"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="0.5"
        />
        <path 
          d="M45 20 L35 30 L40 35 L30 40 L25 55 L15 60 M55 25 L65 35 L60 40 L70 55 L80 60 M50 75 L40 85 L45 90 L35 95"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.3"
        />
        <circle cx="50" cy="50" r="30" fill="url(#crackGlow)" />
      </svg>
      <div className="absolute inset-0 bg-white/20 animate-ping" style={{ animationDuration: '0.2s' }} />
    </div>
  );
}