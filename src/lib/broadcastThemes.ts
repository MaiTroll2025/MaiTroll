import type { BroadcastCategoryId } from '../config/broadcastCategories';
import type { ThemeEffectType } from '../components/themes/themeEffectMap';

export const DEFAULT_BROADCAST_THEME_ID    = 'default';
export const CEO_BROADCAST_THEME_ID        = 'ceo_gold_premium';
export const PRESIDENT_BROADCAST_THEME_ID  = 'president_mansion';
export const PRIDE_LEGACY_THEME_ID         = 'pride_legacy_2026';
export const CEO_THEME_ALLOWED_USER_ID     = '8dff9f37-21b5-4b8e-adc2-b9286874be1a';
export const CEO_THEME_ALLOWED_EMAIL       = 'Trollcity2025@gmail.com';

const ALL_BROADCAST_CATEGORIES: BroadcastCategoryId[] = [
  'general', 'gaming', 'irl', 'debate', 'education',
  'fitness', 'business', 'spiritual', 'election', 'tcnn', 'battle',
];

type BroadcastThemeCategory =
  | 'cash' | 'smoke' | 'drinks' | 'girly' | 'pride'
  | 'car'  | 'music' | 'ceo'   | 'president';

export interface BroadcastTheme {
  id: string;
  label: string;
  category: BroadcastThemeCategory;
  accentColor: string;
  effectType: ThemeEffectType;
  allowedCategories: BroadcastCategoryId[] | ['all'];
  /** Applied to the outermost wrapper div — MUST include broadcast-theme-container + theme-xxx */
  shellClassName: string;
  /** Applied to the inner overlay div */
  overlayClassName: string;
  /** Applied to the player/video frame element */
  playerFrameClassName: string;
  fallbackCardClassName: string;
  accentClassName: string;
  isLegacyReward?: boolean;
}

const SHARED: BroadcastCategoryId[] = [...ALL_BROADCAST_CATEGORIES];

export const BROADCAST_THEMES: BroadcastTheme[] = [
  // ── CASH ──────────────────────────────────────────────────────────────────
  {
    id: 'cash-1',
    label: 'Cashfall Storm',
    category: 'cash',
    accentColor: '#22c55e',
    effectType: 'cashfall-storm',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-cashfall-storm theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-emerald-900/20 border border-emerald-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-emerald-300 border-emerald-400/30 bg-emerald-900/20',
  },
  {
    id: 'cash-2',
    label: 'Money Rain Vault',
    category: 'cash',
    accentColor: '#eab308',
    effectType: 'money-rain-vault',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-money-rain-vault theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-amber-900/20 border border-amber-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-amber-300 border-amber-400/30 bg-amber-900/20',
  },

  // ── SMOKE ─────────────────────────────────────────────────────────────────
  {
    id: 'smoke-1',
    label: 'Smoker Cloud Drift',
    category: 'smoke',
    accentColor: '#22c55e',
    effectType: 'smoker-cloud-drift',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-smoker-cloud-drift theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-lime-900/20 border border-lime-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-lime-300 border-lime-400/30 bg-lime-900/20',
  },
  {
    id: 'smoke-2',
    label: 'Blue Haze Roll',
    category: 'smoke',
    accentColor: '#22d3ee',
    effectType: 'blue-haze-roll',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-blue-haze-roll theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-cyan-900/20 border border-cyan-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-cyan-300 border-cyan-400/30 bg-cyan-900/20',
  },

  // ── DRINKS ────────────────────────────────────────────────────────────────
  {
    id: 'drinks-1',
    label: 'Neon Bar Pour',
    category: 'drinks',
    accentColor: '#f59e0b',
    effectType: 'neon-bar-pour',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-neon-bar-pour theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-orange-900/20 border border-orange-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-orange-300 border-orange-400/30 bg-orange-900/20',
  },
  {
    id: 'drinks-2',
    label: 'Pink Champagne Lounge',
    category: 'drinks',
    accentColor: '#ec4899',
    effectType: 'pink-champagne-lounge',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-pink-champagne-lounge theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-pink-900/20 border border-pink-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-pink-300 border-pink-400/30 bg-pink-900/20',
  },

  // ── GIRLY ─────────────────────────────────────────────────────────────────
  {
    id: 'girly-1',
    label: 'Crystal Rose Shine',
    category: 'girly',
    accentColor: '#f472b6',
    effectType: 'crystal-rose-shine',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-crystal-rose-shine theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-fuchsia-900/20 border border-fuchsia-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-900/20',
  },
  {
    id: 'girly-2',
    label: 'Butterfly Glitter Sky',
    category: 'girly',
    accentColor: '#e879f9',
    effectType: 'butterfly-glitter-sky',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-butterfly-glitter-sky theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-violet-900/20 border border-violet-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-violet-300 border-violet-400/30 bg-violet-900/20',
  },

  // ── PRIDE ─────────────────────────────────────────────────────────────────
  {
    id: 'pride-1',
    label: 'Rainbow Flag Motion',
    category: 'pride',
    accentColor: '#8b5cf6',
    effectType: 'rainbow-flag-motion',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-rainbow-flag-motion theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-indigo-900/20 border border-indigo-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-indigo-300 border-indigo-400/30 bg-indigo-900/20',
  },
  {
    id: 'pride-2',
    label: 'Pride Wave Lights',
    category: 'pride',
    accentColor: '#34d399',
    effectType: 'pride-wave-lights',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-pride-wave-lights theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-teal-900/20 border border-teal-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-teal-300 border-teal-400/30 bg-teal-900/20',
  },

  // ── CAR ───────────────────────────────────────────────────────────────────
  {
    id: 'car-1',
    label: 'Parts and Pistons',
    category: 'car',
    accentColor: '#3b82f6',
    effectType: 'parts-and-pistons',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-parts-and-pistons theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-blue-900/20 border border-blue-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-blue-300 border-blue-400/30 bg-blue-900/20',
  },
  {
    id: 'car-2',
    label: 'Street Roll Motion',
    category: 'car',
    accentColor: '#f97316',
    effectType: 'street-roll-motion',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-street-roll-motion theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-orange-900/20 border border-orange-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-orange-300 border-orange-400/30 bg-orange-900/20',
  },

  // ── MUSIC ─────────────────────────────────────────────────────────────────
  {
    id: 'music-1',
    label: 'Mic Drop Reactor',
    category: 'music',
    accentColor: '#8b5cf6',
    effectType: 'mic-drop-reactor',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-mic-drop-reactor theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-purple-900/20 border border-purple-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-purple-300 border-purple-400/30 bg-purple-900/20',
  },
  {
    id: 'music-2',
    label: 'Note Wave Studio',
    category: 'music',
    accentColor: '#06b6d4',
    effectType: 'note-wave-studio',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-note-wave-studio theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-sky-900/20 border border-sky-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-sky-300 border-sky-400/30 bg-sky-900/20',
  },

  // ── PRIDE LEGACY (owned / airdropped) ─────────────────────────────────────
  {
    id: PRIDE_LEGACY_THEME_ID,
    label: 'Pride Broadcast Theme (2026 Legacy Edition)',
    category: 'pride',
    accentColor: '#ef4444',
    effectType: 'pride-legacy-2026',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-rainbow-flag-motion theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-red-900/20 border border-red-400/40 rounded-lg p-8 text-center',
    accentClassName:       'text-red-300 border-red-400/30 bg-red-900/20',
    isLegacyReward: true,
  },

  // ── CEO GOLD PREMIUM ──────────────────────────────────────────────────────
  {
    id: CEO_BROADCAST_THEME_ID,
    label: 'CEO Gold Premium',
    category: 'ceo',
    accentColor: '#facc15',
    effectType: 'ceo-gold-premium',
    allowedCategories: SHARED,
    // theme-ceo-gold matches the selector in broadcast-themes.css
    shellClassName:        'broadcast-theme-container theme-ceo-gold theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-yellow-900/20 border border-yellow-400/50 rounded-lg p-8 text-center',
    accentClassName:       'text-yellow-300 border-yellow-400/30 bg-yellow-900/20',
  },

  // ── PRESIDENT MANSION ─────────────────────────────────────────────────────
  {
    id: PRESIDENT_BROADCAST_THEME_ID,
    label: 'President Mansion',
    category: 'president',
    accentColor: '#FBBF24',
    effectType: 'president-mansion',
    allowedCategories: SHARED,
    shellClassName:        'broadcast-theme-container theme-president-mansion theme-shell',
    overlayClassName:      'tc-theme-overlay',
    playerFrameClassName:  'tc-theme-frame broadcast-center-slot',
    fallbackCardClassName: 'bg-purple-900/20 border border-yellow-400/50 rounded-lg p-8 text-center',
    accentClassName:       'text-yellow-300 border-yellow-400/30 bg-purple-900/20',
  },
];

// ── Eligibility helpers ───────────────────────────────────────────────────────

export function isCeoThemeEligible(userId?: string | null, email?: string | null): boolean {
  return userId === CEO_THEME_ALLOWED_USER_ID &&
         email?.trim().toLowerCase() === CEO_THEME_ALLOWED_EMAIL;
}

export function isPresidentThemeEligible(role?: string | null, isAdmin?: boolean): boolean {
  if (isAdmin === true) return true;
  const r = role?.toLowerCase() ?? '';
  return ['admin', 'president', 'vice_president', 'superadmin', 'ceo'].includes(r);
}

export function isThemeOwned(themeId: string, ownedThemeIds: string[]): boolean {
  return ownedThemeIds.includes(themeId);
}

export function getSelectableBroadcastThemes(options?: {
  includeCeoTheme?: boolean;
  includePresidentTheme?: boolean;
  ownedThemeIds?: string[];
}): BroadcastTheme[] {
  const includeCeo       = options?.includeCeoTheme === true;
  const includePresident = options?.includePresidentTheme === true;
  const owned            = options?.ownedThemeIds ?? [];

  return BROADCAST_THEMES.filter((theme) => {
    if (theme.id === CEO_BROADCAST_THEME_ID       && !includeCeo)       return false;
    if (theme.id === PRESIDENT_BROADCAST_THEME_ID && !includePresident) return false;
    if (theme.isLegacyReward && !owned.includes(theme.id))              return false;
    return true;
  });
}

export function getBroadcastTheme(
  themeId: string | null | undefined,
  category: string,
): BroadcastTheme | null {
  if (!themeId || themeId === DEFAULT_BROADCAST_THEME_ID) return null;

  const theme = BROADCAST_THEMES.find((t) => t.id === themeId);
  if (!theme) return null;
  if (theme.allowedCategories[0] === 'all') return theme;
  if (!category) return theme;

  return (theme.allowedCategories as BroadcastCategoryId[]).includes(
    category as BroadcastCategoryId,
  ) ? theme : null;
}