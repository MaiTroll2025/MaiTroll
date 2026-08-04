/**
 * Mai Troll Broadcast Theme Constants
 * Neon City OS / Futuristic Cyber City theme
 */

export const MaiTrollBroadcastTheme = {
  // Page shell
  pageShell: 'relative min-h-dvh overflow-hidden bg-slate-950 text-white',
  pageBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',

  // Background glow layers (same as Sidebar ShellBackdrop)
  backgroundLayers: [
    'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    'bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]',
    'bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]',
    'bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]',
    'bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]',
    'bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25',
  ],

  // Background glow layers (compact, already pointer-events-none; used for backdrop divs)
  backgroundGlows: {
    baseGradient: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    purpleRadial: 'bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]',
    tealRadial: 'bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]',
    pinkRadial: 'bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]',
    cyanWash: 'bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]',
    gridOverlay: 'bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25',
  },

  // Panel styles
  panel: 'rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl shadow-[0_0_28px_rgba(45,212,191,0.10)]',
  panelStrong: 'rounded-3xl border border-cyan-400/20 bg-slate-950/70 backdrop-blur-2xl shadow-[0_0_28px_rgba(45,212,191,0.20),inset_0_0_30px_rgba(147,51,234,0.08)]',

  // Host video card — premium broadcast cockpit panel
  hostVideoPanel: 'rounded-[26px] border border-cyan-400/20 bg-slate-950 shadow-[0_0_35px_rgba(45,212,191,0.20),inset_0_1px_0_rgba(255,255,255,0.04)]',

  // Stage guests section
  guestsPanel: 'rounded-[22px] border border-white/10 bg-white/[0.04] shadow-[0_0_25px_rgba(0,0,0,0.5)]',

  // Chat/gifts/top-fans sidebar panel
  chatPanel: 'rounded-[22px] border border-white/10 bg-white/[0.035] shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur-2xl',

  // Floating chat overlay - for mobile, positioned above broadcaster video (like TikTok)
  floatingChatOverlay: 'absolute inset-x-3 top-4 z-50 max-h-[40%] min-h-[120px] overflow-hidden pointer-events-none',

  // Bottom bar / footer strip
  bottomBar: 'rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-2xl',
  footerStrip: 'shrink-0 mx-5 mb-3 flex h-12 items-center gap-5 rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-2xl px-5 text-sm font-semibold text-slate-400',

  // Empty / dashed slot button
  emptySlot: 'rounded-2xl border border-dashed border-white/15 bg-black/20 text-slate-300 transition-all hover:border-purple-400/60 hover:bg-purple-500/10',

  // Badge / chip
  badge: 'inline-flex h-8 min-w-10 items-center justify-center rounded-full border px-3 shadow-inner text-xs font-black',

  // Button styles
  primaryButton: 'bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-500 text-white shadow-[0_0_22px_rgba(45,212,191,0.30)] hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500',
  hostCardPrimary: 'rounded-xl border border-purple-400/40 bg-purple-600/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.22)] hover:bg-purple-600/30',
  getCoinsButton: 'rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.25)] hover:bg-cyan-500/25',
  glassButton: 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_18px_rgba(45,212,191,0.18)]',
  pinkButton: 'rounded-xl border border-pink-400/35 bg-pink-500/15 text-pink-100 shadow-[0_0_18px_rgba(236,72,153,0.22)] hover:bg-pink-500/25',
  purpleButton: 'rounded-xl border border-purple-400/35 bg-purple-500/15 text-purple-100 shadow-[0_0_18px_rgba(168,85,247,0.22)] hover:bg-purple-500/25',
  cyanButton: 'rounded-xl border border-cyan-400/35 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_rgba(45,212,191,0.22)] hover:bg-cyan-500/25',
  // Admin / stats grid item button
  adminGridButton: 'grid place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:text-white transition-all',

  // State styles
  active: 'border-cyan-300/60 bg-white/[0.09] text-white shadow-[0_0_18px_rgba(45,212,191,0.23),inset_0_1px_0_rgba(255,255,255,0.08)]',
  live: 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.25)]',

  // Cam / Mic pill (emerald-green when on, red when off)
  emeraldPill: 'rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10',
  redPill: 'rounded-full border border-red-400/30 bg-red-500/15 text-red-300 shadow-red-500/10',

  // Danger/End/Officer
  danger: 'border border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',

  // Stage guest empty-slots accumulate count label
  stageCountLabel: 'flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300',
}

// Composite background section label styles (for Stage Guests section header)
export const stageSectionLabel = 'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur'

// Composite label for glow-on-hover sections (Stage Guest card top label)
export const stageGuestLabelGlow = 'rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-black text-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]'

// Host identity halo ring class (around avatar on host video)
export const hostIdentityRing = 'rounded-md border border-white/20 object-cover shadow-[0_0_18px_rgba(45,212,191,0.28)]'

// Shimmer button sweep overlay label - use inside an `overflow-hidden` parent
export const shimmerOverlay = 'absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.28),transparent)] opacity-50'

// Pinned product overlay on host video
export const pinnedProductPanel = 'rounded-2xl border border-purple-400/30 bg-white/[0.06] p-4 shadow-[0_0_30px_rgba(168,85,247,0.35)] backdrop-blur-2xl'

export const pinnedProductBadge = 'rounded-lg bg-purple-500/40 px-2.5 py-1 text-[11px] font-black uppercase text-purple-100'
export const pinnedProductViewButton = 'rounded-xl border border-purple-300/30 bg-gradient-to-r from-purple-700 to-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-[0_0_16px_rgba(168,85,247,0.35)]'
export const pinnedProductCoinIcon = 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/25 text-violet-200 text-xs'

// Ghost button for small icon-only actions on stage guest card
export const iconGhostButton = 'relative z-20 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-purple-500/20 hover:text-purple-200'

// Composite background section label styles (for Stage Guests section header)
export const stageTag = 'inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur'

// Bottom bar glassy base
export const bottomBarShell = 'shrink-0 px-5 pb-4'
export const bottomBarAmbient = 'absolute bottom-0 left-0 right-0 h-32 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(168,85,247,0.12),transparent)]'
export const hostActionButtonCenter = 'flex h-[86px] items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 backdrop-blur-2xl'

// Composite background styles for page
export const pageBackgroundStyle = {
  position: 'relative' as const,
  minHeight: '100dvh' as const,
  overflow: 'hidden' as const,
  className: 'bg-slate-950 text-white',
  backgroundLayers: [
    'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    'bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]',
    'bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]',
    'bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]',
    'bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]',
  ]
}