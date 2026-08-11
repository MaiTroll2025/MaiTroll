import React from 'react';
import { motion } from 'framer-motion';
import ThemeEffectLayer from './themes/ThemeEffectLayer';
import { getThemeEffectType, getThemeCssClass } from './themes/themeEffectMap';

export type BroadcastTheme = {
  id: string;
  name: string;
  category: string;
  accentColor: string;
  backgroundImage: string;
  isPremium: boolean;
};

function rgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full  = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n     = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function SoloBroadcastMockup({ theme }: { theme: BroadcastTheme }) {
  const effectType = getThemeEffectType(theme);
  const cssClass   = getThemeCssClass(theme);

  return (
    // broadcast-theme-container + theme class → activates overlay ::before in broadcast-themes.css
    <div className={`broadcast-theme-container ${cssClass} relative w-full aspect-video overflow-hidden rounded-xl`}>

      {/* Base background gradient — kept as inline so each theme still has its own tint */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: `linear-gradient(140deg, ${rgba(theme.accentColor, 0.28)}, rgba(0,0,0,0.95) 65%)` }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }}
      />

      {/* Particle / FX layer */}
      <ThemeEffectLayer effectType={effectType} accentColor={theme.accentColor} />

      {/* Slot layout — CSS class targets .broadcast-center-slot, .broadcast-guest-slot, .guest-seat */}
      <div className="absolute inset-0 z-10 p-3">

        {/* Centre broadcast slot */}
        <motion.div
          className="broadcast-center-slot tc-theme-frame absolute left-20 right-36 top-3 bottom-3 rounded-lg"
          animate={{
            boxShadow: [
              `0 0 8px  ${rgba(theme.accentColor, 0.18)}`,
              `0 0 14px ${rgba(theme.accentColor, 0.42)}`,
              `0 0 8px  ${rgba(theme.accentColor, 0.18)}`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 2.3 }}
        />

        {/* Guest seat column */}
        <div className="absolute left-3 top-3 w-14 space-y-2">
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div
              key={i}
              className="guest-seat h-8 rounded-lg bg-black/55"
              animate={{
                boxShadow: [
                  `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
                  `0 0 18px ${rgba(theme.accentColor, 0.55)}`,
                  `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
                ],
              }}
              transition={{ repeat: Infinity, duration: 2.1, delay }}
            />
          ))}
        </div>

        {/* Top bar */}
        <motion.div
          className="broadcast-guest-slot absolute left-20 right-36 top-3 rounded-lg bg-black/55 p-2 text-xs text-white"
          animate={{
            boxShadow: [
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
              `0 0 20px ${rgba(theme.accentColor, 0.5)}`,
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 2.3 }}
        >
          Live Broadcast
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          className="broadcast-guest-slot absolute left-20 right-36 bottom-3 rounded-lg bg-black/60 p-2 text-xs text-white"
          animate={{
            boxShadow: [
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
              `0 0 20px ${rgba(theme.accentColor, 0.5)}`,
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 2.2, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <span>@streamer_name</span>
            <span style={{ color: theme.accentColor }}>12.8K</span>
          </div>
        </motion.div>

        {/* Chat panel */}
        <motion.div
          className="absolute right-3 top-3 bottom-3 w-32 rounded-lg bg-black/75"
          style={{ borderColor: `${theme.accentColor}30` }}
          animate={{
            boxShadow: [
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
              `0 0 20px ${rgba(theme.accentColor, 0.45)}`,
              `0 0 8px  ${rgba(theme.accentColor, 0.2)}`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        >
          <div className="border-b p-2 text-[10px] text-white" style={{ borderColor: `${theme.accentColor}30` }}>Chat</div>
          <div className="space-y-1 p-2 text-[10px] text-gray-200">
            <div>this theme is fire</div>
            <div>gift train incoming</div>
            <div style={{ color: theme.accentColor }}>+999 coins</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}