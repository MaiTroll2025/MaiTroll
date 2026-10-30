import React from 'react';

const wrap = (children: React.ReactNode, size = 24, className?: string) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
    {children}
  </svg>
);

export function TurtleModePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs>
        <radialGradient id="tg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#63ff9b" stopOpacity="0.9"/><stop offset="100%" stopColor="#0ee78b" stopOpacity="0.2"/></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#tg)" opacity="0.25"/>
      <path d="M12 34 Q32 10 52 34 Q44 52 32 54 Q20 52 12 34Z" fill="#0b1a12" stroke="#63ff9b" strokeWidth="3"/>
      <path d="M20 34 Q32 20 44 34" stroke="#9dffc1" strokeWidth="2" fill="none"/>
      <circle cx="32" cy="30" r="6" fill="#63ff9b" opacity="0.8"/>
    </>,
    size, className
  );
}

export function TrollSpeedModePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><linearGradient id="sp" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#63ff9b"/><stop offset="100%" stopColor="#c084fc"/></linearGradient></defs>
      <path d="M8 40 L24 24 L30 30 L56 8" stroke="url(#sp)" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M44 8 L56 8 L56 20" stroke="#63ff9b" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <circle cx="14" cy="50" r="4" fill="#63ff9b"/>
      <circle cx="26" cy="50" r="4" fill="#c084fc"/>
    </>,
    size, className
  );
}

export function OverchargePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><radialGradient id="oc" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ff617e"/><stop offset="100%" stopColor="#c084fc"/></radialGradient></defs>
      <circle cx="32" cy="32" r="22" fill="url(#oc)" opacity="0.35"/>
      <circle cx="32" cy="32" r="14" fill="#1a0d20" stroke="#c084fc" strokeWidth="3"/>
      <path d="M32 12 L36 28 L28 30 L32 52" stroke="#ff617e" strokeWidth="3" fill="none"/>
    </>,
    size, className
  );
}

export function EnergyShieldPowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><radialGradient id="es" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#63ff9b"/><stop offset="100%" stopColor="#0ee78b" stopOpacity="0.1"/></radialGradient></defs>
      <path d="M32 8 L52 18 V34 C52 48 42 56 32 60 C22 56 12 48 12 34 V18 Z" fill="url(#es)" stroke="#63ff9b" strokeWidth="3"/>
      <circle cx="32" cy="34" r="8" fill="#9dffc1" opacity="0.9"/>
    </>,
    size, className
  );
}

export function CriticalStrikePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <circle cx="32" cy="32" r="24" stroke="#c084fc" strokeWidth="2" fill="none" opacity="0.4"/>
      <path d="M32 6 L32 58 M6 32 L58 32" stroke="#c084fc" strokeWidth="3"/>
      <circle cx="32" cy="32" r="6" fill="#ff617e"/>
      <path d="M20 20 L44 44 M44 20 L20 44" stroke="#ff617e" strokeWidth="2"/>
    </>,
    size, className
  );
}

export function PowerSurgePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <rect x="18" y="12" width="28" height="40" rx="6" fill="#0b1a12" stroke="#63ff9b" strokeWidth="3"/>
      <rect x="26" y="8" width="12" height="6" rx="2" fill="#63ff9b"/>
      <path d="M30 20 L24 34 H32 L28 46 L40 30 H32 L36 20 Z" fill="#9dffc1"/>
    </>,
    size, className
  );
}

export function ChaosPulsePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><radialGradient id="ch" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#c084fc"/><stop offset="100%" stopColor="#7125cf" stopOpacity="0.1"/></radialGradient></defs>
      <circle cx="32" cy="32" r="24" fill="url(#ch)" opacity="0.4"/>
      <circle cx="32" cy="32" r="16" stroke="#c084fc" strokeWidth="3" fill="none" strokeDasharray="6 4"/>
      <path d="M16 24 L48 40 M20 44 L44 20" stroke="#ff617e" strokeWidth="2"/>
    </>,
    size, className
  );
}

export function UltimateModePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><radialGradient id="um" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe38a"/><stop offset="100%" stopColor="#c084fc" stopOpacity="0.2"/></radialGradient></defs>
      <circle cx="32" cy="32" r="28" fill="url(#um)" opacity="0.3"/>
      <circle cx="32" cy="32" r="20" stroke="#ffe38a" strokeWidth="3" fill="none"/>
      <circle cx="32" cy="32" r="10" fill="#ffe38a" opacity="0.9"/>
      <path d="M32 4 L32 12 M32 52 L32 60 M4 32 L12 32 M52 32 L60 32" stroke="#c084fc" strokeWidth="3"/>
    </>,
    size, className
  );
}

export function CrownBoosterPowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe38a"/><stop offset="100%" stopColor="#c084fc"/></linearGradient></defs>
      <path d="M10 46 L14 22 L24 34 L32 16 L40 34 L50 22 L54 46 Z" fill="url(#cr)" stroke="#ffe38a" strokeWidth="2"/>
      <circle cx="32" cy="16" r="4" fill="#ffe38a"/>
    </>,
    size, className
  );
}

export function TrollTaxPowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <circle cx="32" cy="32" r="22" fill="#1a0d20" stroke="#ff617e" strokeWidth="3"/>
      <text x="32" y="40" textAnchor="middle" fontSize="24" fill="#ff617e" fontWeight="bold">$</text>
      <path d="M32 54 L32 48 M26 52 L32 58 L38 52" stroke="#c084fc" strokeWidth="3" fill="none"/>
    </>,
    size, className
  );
}

export function GhostModePowerUp({ size = 24, className }: { size?: number; className?: string }) {
  return wrap(
    <>
      <defs><radialGradient id="gh" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#63a4ff"/><stop offset="100%" stopColor="#c084fc" stopOpacity="0.1"/></radialGradient></defs>
      <path d="M32 8 C46 8 52 22 52 36 C52 48 44 56 32 56 C20 56 12 48 12 36 C12 22 18 8 32 8 Z" fill="url(#gh)" stroke="#63a4ff" strokeWidth="3" opacity="0.8"/>
      <circle cx="24" cy="28" r="3" fill="#fff"/>
      <circle cx="40" cy="28" r="3" fill="#fff"/>
      <path d="M24 44 Q32 40 40 44" stroke="#c084fc" strokeWidth="2" fill="none"/>
    </>,
    size, className
  );
}
