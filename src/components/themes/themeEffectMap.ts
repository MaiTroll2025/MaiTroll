export type ThemeEffectType =
  | 'cashfall-storm'
  | 'money-rain-vault'
  | 'smoker-cloud-drift'
  | 'blue-haze-roll'
  | 'neon-bar-pour'
  | 'pink-champagne-lounge'
  | 'crystal-rose-shine'
  | 'butterfly-glitter-sky'
  | 'parts-and-pistons'
  | 'street-roll-motion'
  | 'mic-drop-reactor'
  | 'note-wave-studio'
  | 'ceo-gold-premium'
  | 'president-mansion'
  | 'default';

export type ThemeLike = {
  id: string;
  name: string;
  category: string;
};

// Maps every ThemeEffectType to the CSS class that drives the
// border glow, overlay radiance, and slot frame in broadcast-themes.css
export const THEME_CSS_CLASS: Record<ThemeEffectType, string> = {
  'cashfall-storm':        'theme-cashfall-storm',
  'money-rain-vault':      'theme-money-rain-vault',
  'smoker-cloud-drift':    'theme-smoker-cloud-drift',
  'blue-haze-roll':        'theme-blue-haze-roll',
  'neon-bar-pour':         'theme-neon-bar-pour',
  'pink-champagne-lounge': 'theme-pink-champagne-lounge',
  'crystal-rose-shine':    'theme-crystal-rose-shine',
  'butterfly-glitter-sky': 'theme-butterfly-glitter-sky',
  'parts-and-pistons':     'theme-parts-and-pistons',
  'street-roll-motion':    'theme-street-roll-motion',
  'mic-drop-reactor':      'theme-mic-drop-reactor',
  'note-wave-studio':      'theme-note-wave-studio',
  'ceo-gold-premium':      'theme-ceo-gold',
  'president-mansion':     'theme-president-mansion',
  'default':               '',
};

export function getThemeEffectType(theme: ThemeLike): ThemeEffectType {
  const id   = theme.id.toLowerCase();
  const name = theme.name.toLowerCase();

  if (id === 'cash-1'            || name.includes('cashfall'))          return 'cashfall-storm';
  if (id === 'cash-2'            || name.includes('vault'))             return 'money-rain-vault';
  if (id === 'smoke-1'           || name.includes('cloud drift'))       return 'smoker-cloud-drift';
  if (id === 'smoke-2'           || name.includes('blue haze'))         return 'blue-haze-roll';
  if (id === 'drinks-1'          || name.includes('neon bar'))          return 'neon-bar-pour';
  if (id === 'drinks-2'          || name.includes('champagne'))         return 'pink-champagne-lounge';
  if (id === 'girly-1'           || name.includes('crystal rose'))      return 'crystal-rose-shine';
  if (id === 'girly-2'           || name.includes('butterfly glitter')) return 'butterfly-glitter-sky';
  if (id === 'car-1'             || name.includes('parts and pistons')) return 'parts-and-pistons';
  if (id === 'car-2'             || name.includes('street roll'))       return 'street-roll-motion';
  if (id === 'music-1'           || name.includes('mic drop'))          return 'mic-drop-reactor';
  if (id === 'music-2'           || name.includes('note wave'))         return 'note-wave-studio';
  if (id === 'ceo_gold_premium'  || name.includes('ceo'))               return 'ceo-gold-premium';
  if (id === 'president-mansion' || name.includes('president') || name.includes('mansion')) return 'president-mansion';

  if (theme.category === 'cash')      return 'cashfall-storm';
  if (theme.category === 'smoke')     return 'smoker-cloud-drift';
  if (theme.category === 'drinks')    return 'pink-champagne-lounge';
  if (theme.category === 'girly')     return 'butterfly-glitter-sky';
  if (theme.category === 'car')       return 'street-roll-motion';
  if (theme.category === 'music')     return 'note-wave-studio';
  if (theme.category === 'president') return 'president-mansion';

  return 'default';
}

/** Convenience: get the CSS class string directly from a theme object */
export function getThemeCssClass(theme: ThemeLike): string {
  return THEME_CSS_CLASS[getThemeEffectType(theme)] ?? '';
}