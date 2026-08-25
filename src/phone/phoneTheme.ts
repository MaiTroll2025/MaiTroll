/**
 * Neon cyberpunk theme for the phone experience.
 *
 * Vibrant neon blue (#00BFFF → #1E90FF) and neon purple (#BF00FF → #9B30FF)
 * with intense luminous outlines, dark-to-neon gradient background and
 * radiant blue/purple light rays. All phone screens share this theme.
 */

import React from 'react'

export const NEON = {
  blue: '#00BFFF',
  blueBright: '#1E90FF',
  purple: '#BF00FF',
  purpleBright: '#9B30FF',
  bg: '#05010f',
}

// Full-screen neon background layers. Place once at the app root.
export const PHONE_BG_LAYERS = React.createElement(
  React.Fragment,
  null,
  React.createElement('div', { className: 'pointer-events-none fixed inset-0 -z-10 bg-[#05010f]' }),
  React.createElement('div', { className: 'pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(130%_90%_at_12%_-10%,rgba(0,191,255,0.32),transparent_46%),radial-gradient(130%_90%_at_92%_110%,rgba(191,0,255,0.34),transparent_46%)]' }),
  React.createElement('div', { className: 'pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(0,191,255,0.07)_0%,rgba(155,48,255,0.07)_100%)]' }),
)

/** Card surface with a neon outline + subtle inner glow. */
export const neonCard =
  'rounded-2xl border bg-[#0b0820]/70 backdrop-blur border-[#00BFFF]/35 shadow-[0_0_18px_rgba(0,191,255,0.25),inset_0_0_14px_rgba(155,48,255,0.12)]'

/** Header / bar surface. */
export const neonBar =
  'border-b bg-[#0a0420]/80 backdrop-blur border-[#BF00FF]/30'

/** Primary neon button. */
export const neonButton =
  'rounded-xl font-bold text-white transition shadow-[0_0_18px_rgba(0,191,255,0.45)] bg-gradient-to-r from-[#00BFFF] via-[#1E90FF] to-[#9B30FF] hover:shadow-[0_0_26px_rgba(155,48,255,0.6)] disabled:opacity-50'

/** Secondary / ghost neon button. */
export const neonGhost =
  'rounded-lg text-white transition hover:bg-[#00BFFF]/10 border border-[#00BFFF]/25'

/** Nav item row used in the phone drawer. */
export const neonNavItem =
  'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-white transition hover:bg-[#BF00FF]/15 border border-transparent hover:border-[#00BFFF]/30'

/** Accent text gradient (headings). */
export const neonTextGradient =
  'bg-gradient-to-r from-[#00BFFF] via-[#1E90FF] to-[#9B30FF] bg-clip-text text-transparent'

/** Thin neon divider. */
export const neonDivider = 'border-[#BF00FF]/25'
