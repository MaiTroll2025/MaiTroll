import React from 'react';
import { motion } from 'framer-motion';

type ThemeLike = {
  id: string;
  category: string;
  accentColor: string;
};

function rgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function IconWrap({
  children,
  style,
  animate,
  transition,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
  animate?: any;
  transition?: any;
}) {
  return (
    <motion.div
      className="absolute z-[9]"
      style={style}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

export function Crown3D({ size = 18, cushion = false, cushionColor = '#dc2626' }: { size?: number; cushion?: boolean; cushionColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {cushion && (
        <>
          <ellipse cx="32" cy="44" rx="26" ry="10" fill={cushionColor} opacity="0.95" />
          <path d="M10 40c0 6 10 12 22 12s22-6 22-12c0-3-9-8-22-8s-22 5-22 8z" fill={cushionColor} opacity="0.9" />
          <ellipse cx="32" cy="40" rx="20" ry="6" fill="rgba(255,255,255,0.18)" />
        </>
      )}
      <path d="M10 44h44l-5.33 12H15.33z" fill="#b45309" stroke="#78350f" strokeWidth="2" />
      <path d="M10 44 18 18 24 30 32 14 40 30 46 18 54 44z" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
      <path d="M10 44 18 18 24 30 32 14 40 30 46 18 54 44z" fill="#fde68a" opacity="0.35" />
      <path d="M10 44 L18 24 L24 32 L32 18 L40 32 L46 24 L54 44" fill="none" stroke="#92400e" strokeWidth="2" opacity="0.45" />
      <circle cx="18" cy="18" r="4" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
      <circle cx="32" cy="14" r="4" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
      <circle cx="46" cy="18" r="4" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
      <path d="M20 44h24" stroke="#78350f" strokeWidth="2" opacity="0.75" />
    </svg>
  );
}

function MicIcon({ color = '#67e8f9', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="3" width="8" height="12" rx="4" fill={color} opacity="0.9" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" fill="none" />
      <path d="M12 18v3" stroke={color} strokeWidth="2" />
      <path d="M8 21h8" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function MusicNoteIcon({ color = '#a78bfa', size = 12 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="18" r="3" fill={color} />
      <path d="M11 18V6l8-2v12" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="19" cy="16" r="3" fill={color} />
    </svg>
  );
}

function WeedLeafIcon({ color = '#22c55e', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill={color} opacity="0.92">
        <ellipse cx="12" cy="7" rx="1.4" ry="5.2" />
        <ellipse cx="8" cy="8.5" rx="1.3" ry="4.6" transform="rotate(-28 8 8.5)" />
        <ellipse cx="16" cy="8.5" rx="1.3" ry="4.6" transform="rotate(28 16 8.5)" />
        <ellipse cx="6.6" cy="12" rx="1.2" ry="3.8" transform="rotate(-52 6.6 12)" />
        <ellipse cx="17.4" cy="12" rx="1.2" ry="3.8" transform="rotate(52 17.4 12)" />
      </g>
      <path d="M12 12v8" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function SmokePuffIcon({ color = '#d4d4d8', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="13" r="4.2" fill={color} opacity="0.55" />
      <circle cx="14.5" cy="11.5" r="3.8" fill={color} opacity="0.5" />
      <circle cx="17.5" cy="14.5" r="2.8" fill={color} opacity="0.45" />
    </svg>
  );
}

function WineGlassIcon({ color = '#f472b6', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12l-2 8a4 4 0 0 1-8 0z" fill={color} opacity="0.3" stroke={color} strokeWidth="1.5" />
      <path d="M12 12v6M9 20h6" stroke={color} strokeWidth="1.5" />
      <path d="M7.8 8h8.4" stroke={color} strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
}

function ButterflyIcon({ color = '#f0abfc', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="4" ry="5" fill={color} opacity="0.8" />
      <ellipse cx="16" cy="8" rx="4" ry="5" fill={color} opacity="0.8" />
      <ellipse cx="8" cy="16" rx="4" ry="4" fill={color} opacity="0.65" />
      <ellipse cx="16" cy="16" rx="4" ry="4" fill={color} opacity="0.65" />
      <rect x="11" y="5" width="2" height="14" rx="1" fill="#fdf2f8" />
    </svg>
  );
}

function WheelIcon({ color = '#94a3b8', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="2" fill={color} />
      <path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function PistonIcon({ color = '#cbd5e1', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="8" height="6" rx="1" stroke={color} fill="none" strokeWidth="1.7" />
      <rect x="11" y="11" width="7" height="2" fill={color} />
      <circle cx="20" cy="12" r="2" stroke={color} fill="none" strokeWidth="1.7" />
    </svg>
  );
}

function CrystalIcon({ color = '#f9a8d4', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 10l7 11 7-11z" fill={color} opacity="0.6" stroke={color} strokeWidth="1.4" />
      <path d="M12 3v18M5 10h14" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
    </svg>
  );
}

function CashBillIcon({ color = '#22c55e', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" fill={color} opacity="0.22" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke={color} fill="none" strokeWidth="1.4" />
    </svg>
  );
}

export function ThemeBackgroundFX({ theme, isBattle = false }: { theme: ThemeLike; isBattle?: boolean }) {
  const isCash = theme.category === 'cash';
  const isSmoke = theme.category === 'smoke';
  const isDrinks = theme.category === 'drinks';
  const isGirly = theme.category === 'girly';
  const isCar = theme.category === 'car';
  const isMusic = theme.category === 'music';
  const baseOpacity = isBattle ? 0.3 : 0.35;

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none">
      {isCash && (
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: baseOpacity,
            background: 'repeating-linear-gradient(100deg, rgba(34,197,94,0) 0 42px, rgba(250,204,21,0.2) 42px 46px, rgba(34,197,94,0) 46px 96px)',
          }}
          animate={{ y: ['-10%', '10%'] }}
          transition={{ repeat: Infinity, duration: 6.5, ease: 'linear' }}
        />
      )}
      {isSmoke && (
        <>
          <motion.div className="absolute -left-10 top-14 h-28 w-52 rounded-full blur-2xl" style={{ background: 'rgba(120,120,120,0.34)' }} animate={{ x: [0, 30, 6], y: [0, -14, 0] }} transition={{ repeat: Infinity, duration: 6.2, ease: 'easeInOut' }} />
          <motion.div className="absolute right-0 top-20 h-24 w-48 rounded-full blur-2xl" style={{ background: 'rgba(145,145,145,0.28)' }} animate={{ x: [0, -26, 0], y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 5.8, ease: 'easeInOut' }} />
          <motion.div className="absolute left-1/4 bottom-4 h-20 w-40 rounded-full blur-2xl" style={{ background: 'rgba(34,197,94,0.2)' }} animate={{ x: [0, 24, 0], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 6.5, ease: 'easeInOut' }} />
        </>
      )}
      {isDrinks && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            opacity: baseOpacity,
            background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(244,114,182,0.24), rgba(251,191,36,0.24))',
          }}
          animate={{ y: [0, -5, 0], scaleX: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
        />
      )}
      {isGirly && (
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: 0.26,
            background: 'radial-gradient(circle at 22% 30%, rgba(255,255,255,0.7) 0 1px, transparent 2px), radial-gradient(circle at 76% 34%, rgba(255,255,255,0.65) 0 1px, transparent 2px), radial-gradient(circle at 58% 74%, rgba(255,255,255,0.55) 0 1px, transparent 2px)',
          }}
          animate={{ y: ['0%', '8%'] }}
          transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}
        />
      )}
      {isCar && (
        <motion.div
          className="absolute inset-0"
          style={{ opacity: baseOpacity, background: 'repeating-linear-gradient(102deg, rgba(255,255,255,0) 0 18px, rgba(148,163,184,0.36) 18px 22px, rgba(255,255,255,0) 22px 50px)' }}
          animate={{ x: ['-4%', '4%'] }}
          transition={{ repeat: Infinity, duration: 2.8, ease: 'linear' }}
        />
      )}
      {isMusic && (
        <motion.div
          className="absolute inset-0"
          style={{ opacity: 0.25, background: 'repeating-linear-gradient(90deg, rgba(167,139,250,0.25) 0 3px, rgba(0,0,0,0) 3px 14px)' }}
          animate={{ y: ['0%', '8%'] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'linear' }}
        />
      )}
    </div>
  );
}

function RowOf({
  top,
  bottom,
  left,
  right,
  count,
  render,
}: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  count: number;
  render: (idx: number) => React.ReactNode;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const x = 12 + i * 18;
        const style: React.CSSProperties = {
          top,
          bottom,
          left: left != null ? left + x : undefined,
          right: right != null ? right + x : undefined,
        };
        return (
          <React.Fragment key={`${top ?? bottom}-${left ?? right}-${i}`}>
            <IconWrap style={style} animate={{ y: [0, i % 2 === 0 ? -1.5 : 1.5, 0] }} transition={{ repeat: Infinity, duration: 2.8, delay: i * 0.08 }}>
              {render(i)}
            </IconWrap>
          </React.Fragment>
        );
      })}
    </>
  );
}

function ColOf({
  top,
  bottom,
  left,
  right,
  count,
  render,
}: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  count: number;
  render: (idx: number) => React.ReactNode;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const y = 12 + i * 18;
        const style: React.CSSProperties = {
          left,
          right,
          top: top != null ? top + y : undefined,
          bottom: bottom != null ? bottom + y : undefined,
        };
        return (
          <React.Fragment key={`${left ?? right}-${top ?? bottom}-${i}`}>
            <IconWrap style={style} animate={{ x: [0, i % 2 === 0 ? -1.2 : 1.2, 0] }} transition={{ repeat: Infinity, duration: 2.8, delay: i * 0.08 }}>
              {render(i)}
            </IconWrap>
          </React.Fragment>
        );
      })}
    </>
  );
}

export function ThemeTrimFX({ theme, isBattle = false }: { theme: ThemeLike; isBattle?: boolean }) {
  const isMusic = theme.category === 'music';
  const isSmoke = theme.category === 'smoke';
  const isDrinks = theme.category === 'drinks';
  const isGirly = theme.category === 'girly';
  const isCar = theme.category === 'car';
  const isCash = theme.category === 'cash';
  const isCrystal = theme.id === 'girly-1';
  const isButterfly = theme.id === 'girly-2';
  const isSmoker420 = theme.id === 'smoke-1';

  const trimColor = isSmoker420 ? '#22c55e' : theme.accentColor;
  const inset = isBattle ? 5 : 6;
  const radius = isBattle ? 10 : 12;

  return (
    <div className="absolute inset-0 z-[8] pointer-events-none">
      <motion.div
        style={{
          position: 'absolute',
          inset,
          borderRadius: radius,
          border: `1px solid ${rgba(trimColor, 0.7)}`,
        }}
        animate={{
          boxShadow: [
            `0 0 6px ${rgba(trimColor, 0.22)}`,
            `0 0 13px ${rgba(trimColor, 0.45)}`,
            `0 0 6px ${rgba(trimColor, 0.22)}`,
          ],
        }}
        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
      />

      {isMusic && (
        <>
          <IconWrap style={{ top: inset - 2, left: inset - 2 }} animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>
            <MicIcon color="#67e8f9" size={13} />
          </IconWrap>
          <IconWrap style={{ top: inset - 2, right: inset - 2 }} animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.9 }}>
            <MicIcon color="#a78bfa" size={13} />
          </IconWrap>
          <IconWrap style={{ bottom: inset - 2, left: inset - 2 }} animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.85 }}>
            <MicIcon color="#67e8f9" size={13} />
          </IconWrap>
          <IconWrap style={{ bottom: inset - 2, right: inset - 2 }} animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.95 }}>
            <MicIcon color="#a78bfa" size={13} />
          </IconWrap>
          <RowOf top={inset + 2} left={inset + 16} count={8} render={(i) => <MusicNoteIcon color={i % 2 === 0 ? '#67e8f9' : '#a78bfa'} />} />
          <RowOf bottom={inset + 2} left={inset + 16} count={8} render={(i) => <MusicNoteIcon color={i % 2 === 0 ? '#67e8f9' : '#a78bfa'} />} />
          <ColOf top={inset + 8} left={inset + 2} count={4} render={(i) => <MusicNoteIcon color={i % 2 === 0 ? '#67e8f9' : '#a78bfa'} />} />
          <ColOf top={inset + 8} right={inset + 2} count={4} render={(i) => <MusicNoteIcon color={i % 2 === 0 ? '#67e8f9' : '#a78bfa'} />} />
        </>
      )}

      {isSmoke && (
        <>
          <RowOf top={inset + 2} left={inset + 16} count={8} render={(i) => <SmokePuffIcon color={i % 2 === 0 ? '#d4d4d8' : '#a1a1aa'} />} />
          <RowOf bottom={inset + 2} left={inset + 16} count={8} render={(i) => <SmokePuffIcon color={i % 2 === 0 ? '#d4d4d8' : '#a1a1aa'} />} />
          <ColOf top={inset + 8} left={inset + 2} count={4} render={(i) => <SmokePuffIcon color={i % 2 === 0 ? '#d4d4d8' : '#a1a1aa'} />} />
          <ColOf top={inset + 8} right={inset + 2} count={4} render={(i) => <SmokePuffIcon color={i % 2 === 0 ? '#d4d4d8' : '#a1a1aa'} />} />
          {isSmoker420 && (
            <>
              <RowOf top={inset + 2} left={inset + 16} count={8} render={() => <WeedLeafIcon color="#22c55e" />} />
              <RowOf bottom={inset + 2} left={inset + 16} count={8} render={() => <WeedLeafIcon color="#22c55e" />} />
              <ColOf top={inset + 8} left={inset + 2} count={4} render={() => <WeedLeafIcon color="#22c55e" />} />
              <ColOf top={inset + 8} right={inset + 2} count={4} render={() => <WeedLeafIcon color="#22c55e" />} />
            </>
          )}
        </>
      )}

      {isDrinks && (
        <>
          <RowOf
            top={inset + 2}
            left={inset + 14}
            count={7}
            render={(i) => (
              <div className="relative">
                <WineGlassIcon color={i % 2 === 0 ? '#f472b6' : '#fb7185'} />
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-[1.5px] rounded-full bg-pink-200/80"
                  animate={{ opacity: [0.8, 0.3, 0.8], y: [0, 2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: i * 0.12 }}
                />
              </div>
            )}
          />
          <RowOf
            bottom={inset + 2}
            left={inset + 14}
            count={7}
            render={(i) => (
              <div className="relative">
                <WineGlassIcon color={i % 2 === 0 ? '#f472b6' : '#fb7185'} />
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-[1.5px] rounded-full bg-pink-200/80"
                  animate={{ opacity: [0.8, 0.3, 0.8], y: [0, 2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: i * 0.12 }}
                />
              </div>
            )}
          />
          <ColOf
            top={inset + 8}
            left={inset + 2}
            count={4}
            render={(i) => (
              <div className="relative">
                <WineGlassIcon color={i % 2 === 0 ? '#f472b6' : '#fb7185'} />
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-[1.5px] rounded-full bg-pink-200/80"
                  animate={{ opacity: [0.8, 0.3, 0.8], y: [0, 2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: i * 0.12 }}
                />
              </div>
            )}
          />
          <ColOf
            top={inset + 8}
            right={inset + 2}
            count={4}
            render={(i) => (
              <div className="relative">
                <WineGlassIcon color={i % 2 === 0 ? '#f472b6' : '#fb7185'} />
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-[1.5px] rounded-full bg-pink-200/80"
                  animate={{ opacity: [0.8, 0.3, 0.8], y: [0, 2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: i * 0.12 }}
                />
              </div>
            )}
          />
        </>
      )}

      {isGirly && (
        <>
          {isCrystal && <RowOf top={inset + 2} left={inset + 14} count={8} render={() => <CrystalIcon color="#f9a8d4" />} />}
          {isCrystal && <RowOf bottom={inset + 2} left={inset + 14} count={8} render={() => <CrystalIcon color="#f9a8d4" />} />}
          {isCrystal && <ColOf top={inset + 8} left={inset + 2} count={4} render={() => <CrystalIcon color="#f9a8d4" />} />}
          {isCrystal && <ColOf top={inset + 8} right={inset + 2} count={4} render={() => <CrystalIcon color="#f9a8d4" />} />}
          {isButterfly && <RowOf top={inset + 2} left={inset + 14} count={8} render={() => <ButterflyIcon color="#f0abfc" />} />}
          {isButterfly && <RowOf bottom={inset + 2} left={inset + 14} count={8} render={() => <ButterflyIcon color="#f0abfc" />} />}
          {isButterfly && <ColOf top={inset + 8} left={inset + 2} count={4} render={() => <ButterflyIcon color="#f0abfc" />} />}
          {isButterfly && <ColOf top={inset + 8} right={inset + 2} count={4} render={() => <ButterflyIcon color="#f0abfc" />} />}
        </>
      )}

      {isCar && (
        <>
          <RowOf top={inset + 2} left={inset + 12} count={8} render={(i) => (i % 2 === 0 ? <WheelIcon color="#94a3b8" /> : <PistonIcon color="#cbd5e1" />)} />
          <RowOf bottom={inset + 2} left={inset + 12} count={8} render={(i) => (i % 2 === 0 ? <WheelIcon color="#94a3b8" /> : <PistonIcon color="#cbd5e1" />)} />
          <ColOf top={inset + 8} left={inset + 2} count={4} render={(i) => (i % 2 === 0 ? <WheelIcon color="#94a3b8" /> : <PistonIcon color="#cbd5e1" />)} />
          <ColOf top={inset + 8} right={inset + 2} count={4} render={(i) => (i % 2 === 0 ? <WheelIcon color="#94a3b8" /> : <PistonIcon color="#cbd5e1" />)} />
        </>
      )}

      {isCash && (
        <>
          <RowOf top={inset + 2} left={inset + 12} count={8} render={(i) => <CashBillIcon color={i % 2 === 0 ? '#22c55e' : '#eab308'} />} />
          <RowOf bottom={inset + 2} left={inset + 12} count={8} render={(i) => <CashBillIcon color={i % 2 === 0 ? '#22c55e' : '#eab308'} />} />
          <ColOf top={inset + 8} left={inset + 2} count={4} render={(i) => <CashBillIcon color={i % 2 === 0 ? '#22c55e' : '#eab308'} />} />
          <ColOf top={inset + 8} right={inset + 2} count={4} render={(i) => <CashBillIcon color={i % 2 === 0 ? '#22c55e' : '#eab308'} />} />
        </>
      )}
    </div>
  );
}
