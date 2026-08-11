export type GiftRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type GiftAnimationType =
  | 'emoji'
  | 'particle'
  | 'video'
  | 'fullscreen_video'
  | 'screen_takeover'
  | 'shake'
  | 'portal'
  | 'burst'
  | 'float'
  | 'spin'
  | 'drop'
  | 'orbit'
  | 'spotlight'
  | 'fireworks';

export interface GiftVisualConfig {
  animationKey: string;
  animationType: GiftAnimationType;
  rarity: GiftRarity;
  gradient: string;
  glowClass: string;
  isFullscreen: boolean;
  durationMs: number;
  description?: string;
  trayLabel?: string;
  animationUrl?: string | null;
  resolvedUrl?: string | null;
  resolvedSource?: 'animation_url' | 'icon_url' | 'local_fallback' | 'missing' | null;
  resolvedType?: 'video' | 'image' | 'fallback';
  resolvedVideoUrl?: string | null;
  resolvedImageUrl?: string | null;
  slug?: string | null;
  soundUrl?: string | null;
  trayVisualUrl?: string | null;
  trayGradient?: string | null;
}

const PRESET_GIFT_CONFIG: Array<{
  matcher: (name: string, slug?: string) => boolean;
  config: Partial<GiftVisualConfig>;
}> = [
  {
    matcher: (name) => name.includes('alien'),
    config: {
      animationKey: 'alien_invasion',
      rarity: 'legendary',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 6200,
      gradient: 'linear-gradient(135deg, rgba(0,20,25,0.95), rgba(2,255,204,0.12))',
      glowClass: 'shadow-[0_0_35px_rgba(30,255,182,0.75)]',
      description: 'UFO tractor beam scans the broadcast and sparks neon cosmic energy.',
      trayVisualUrl: null,
      trayGradient: 'linear-gradient(135deg, #041213, #0e1c20)',
    },
  },
  {
    matcher: (name) => name.includes('yacht'),
    config: {
      animationKey: 'yacht',
      rarity: 'epic',
      isFullscreen: false,
      animationType: 'video',
      durationMs: 4200,
      gradient: 'linear-gradient(135deg, rgba(10,20,40,0.95), rgba(60,130,255,0.18))',
      glowClass: 'shadow-[0_0_25px_rgba(59,130,246,0.45)]',
      description: 'A luxury yacht glides across neon water with gold sparkles trailing behind.',
      trayGradient: 'linear-gradient(135deg, #0b1b2c, #1b3d75)',
    },
  },
  {
    matcher: (name) => name.includes('phoenix'),
    config: {
      animationKey: 'phoenix',
      rarity: 'legendary',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 6000,
      gradient: 'linear-gradient(135deg, rgba(40,3,0,0.95), rgba(255,93,14,0.2))',
      glowClass: 'shadow-[0_0_40px_rgba(255,102,0,0.75)]',
      description: 'A phoenix rises in blazing neon fire and dissolves into sparks.',
      trayGradient: 'linear-gradient(135deg, #190b0b, #7f2f0d)',
    },
  },
  {
    matcher: (name) => name.includes('private jet') || name.includes('jet'),
    config: {
      animationKey: 'private_jet',
      rarity: 'epic',
      isFullscreen: false,
      animationType: 'video',
      durationMs: 4300,
      gradient: 'linear-gradient(135deg, rgba(5,10,25,0.95), rgba(93,245,255,0.14))',
      glowClass: 'shadow-[0_0_30px_rgba(56,189,248,0.55)]',
      description: 'A luxury jet streaks through the broadcast leaving a cyan contrail.',
      trayGradient: 'linear-gradient(135deg, #07101f, #1c3349)',
    },
  },
  {
    matcher: (name) => name.includes('dragon'),
    config: {
      animationKey: 'dragon',
      rarity: 'legendary',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 6100,
      gradient: 'linear-gradient(135deg, rgba(4,8,12,0.95), rgba(143,0,255,0.2))',
      glowClass: 'shadow-[0_0_40px_rgba(173,34,255,0.8)]',
      description: 'A neon dragon breathes fire that turns into particles across the screen.',
      trayGradient: 'linear-gradient(135deg, #071115, #2f1c39)',
    },
  },
  {
    matcher: (name) => name.includes('black hole') || name.includes('blackhole'),
    config: {
      animationKey: 'black_hole',
      rarity: 'mythic',
      isFullscreen: true,
      animationType: 'screen_takeover',
      durationMs: 6500,
      gradient: 'linear-gradient(135deg, rgba(0,0,0,0.92), rgba(112,57,255,0.2))',
      glowClass: 'shadow-[0_0_50px_rgba(147,51,255,0.85)]',
      description: 'A cosmic black hole bends neon rings and explodes into a galaxy burst.',
      trayGradient: 'linear-gradient(135deg, #000000, #2a0830)',
    },
  },
  {
    matcher: (name) => name.includes('gold bar') || name.includes('gold_bar') || name.includes('goldbar'),
    config: {
      animationKey: 'gold_bar',
      rarity: 'epic',
      isFullscreen: false,
      animationType: 'burst',
      durationMs: 4000,
      gradient: 'linear-gradient(135deg, rgba(30,20,0,0.95), rgba(255,191,0,0.18))',
      glowClass: 'shadow-[0_0_30px_rgba(251,191,36,0.6)]',
      description: 'Gold bars rain down and stack with shimmering dust.',
      trayGradient: 'linear-gradient(135deg, #1c1505, #4d3b0d)',
    },
  },
  {
    matcher: (name) => name.includes('planet'),
    config: {
      animationKey: 'planet',
      rarity: 'legendary',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 5600,
      gradient: 'linear-gradient(135deg, rgba(4,10,18,0.95), rgba(96,165,250,0.2))',
      glowClass: 'shadow-[0_0_40px_rgba(96,165,250,0.75)]',
      description: 'A glowing planet rotates into view with orbit rings and cosmic pulse.',
      trayGradient: 'linear-gradient(135deg, #04131f, #233554)',
    },
  },
  {
    matcher: (name) => name.includes('rocket'),
    config: {
      animationKey: 'rocket',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'video',
      durationMs: 3700,
      gradient: 'linear-gradient(135deg, rgba(5,8,15,0.95), rgba(255,104,31,0.16))',
      glowClass: 'shadow-[0_0_30px_rgba(248,113,113,0.6)]',
      description: 'A rocket launches with neon smoke and fire trail.',
      trayGradient: 'linear-gradient(135deg, #081021, #3b151a)',
    },
  },
  {
    matcher: (name) => name.includes('rolex') || name.includes('watch'),
    config: {
      animationKey: 'rolex',
      rarity: 'epic',
      isFullscreen: false,
      animationType: 'portal',
      durationMs: 4300,
      gradient: 'linear-gradient(135deg, rgba(10,6,15,0.95), rgba(249,168,37,0.18))',
      glowClass: 'shadow-[0_0_36px_rgba(250,204,21,0.65)]',
      description: 'A luxury watch spins with diamond sparkles and gold light.',
      trayGradient: 'linear-gradient(135deg, #11100d, #5f4a11)',
    },
  },
  {
    matcher: (name) => name.includes('cash stack') || name.includes('money stack') || name.includes('cash'),
    config: {
      animationKey: 'cash_stack',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'burst',
      durationMs: 3400,
      gradient: 'linear-gradient(135deg, rgba(6,11,4,0.95), rgba(74,222,128,0.16))',
      glowClass: 'shadow-[0_0_30px_rgba(34,197,94,0.65)]',
      description: 'Stacks of cash pop up and bills rain down.',
      trayGradient: 'linear-gradient(135deg, #071105, #11381a)',
    },
  },
  {
    matcher: (name) => name.includes('time machine') || name.includes('time portal') || name.includes('time'),
    config: {
      animationKey: 'time_machine',
      rarity: 'mythic',
      isFullscreen: true,
      animationType: 'screen_takeover',
      durationMs: 6400,
      gradient: 'linear-gradient(135deg, rgba(8,8,16,0.95), rgba(168,85,247,0.18))',
      glowClass: 'shadow-[0_0_45px_rgba(168,85,247,0.8)]',
      description: 'A time portal opens with glowing clock rings and lightning arcs.',
      trayGradient: 'linear-gradient(135deg, #090611, #3f1e5a)',
    },
  },
  {
    matcher: (name) => name.includes('sports car') || name.includes('sportscar') || name.includes('race car'),
    config: {
      animationKey: 'sports_car',
      rarity: 'epic',
      isFullscreen: false,
      animationType: 'video',
      durationMs: 3800,
      gradient: 'linear-gradient(135deg, rgba(8,8,12,0.95), rgba(248,113,113,0.16))',
      glowClass: 'shadow-[0_0_30px_rgba(248,113,113,0.65)]',
      description: 'A neon sports car speeds across the bottom with flare and smoke.',
      trayGradient: 'linear-gradient(135deg, #081014, #3f1720)',
    },
  },
  {
    matcher: (name) => name.includes('galaxy'),
    config: {
      animationKey: 'galaxy',
      rarity: 'mythic',
      isFullscreen: true,
      animationType: 'screen_takeover',
      durationMs: 6200,
      gradient: 'linear-gradient(135deg, rgba(7,6,22,0.96), rgba(79,70,229,0.18))',
      glowClass: 'shadow-[0_0_45px_rgba(79,70,229,0.8)]',
      description: 'A galaxy spiral opens and collapses into a cosmic crown burst.',
      trayGradient: 'linear-gradient(135deg, #060815, #1f1b49)',
    },
  },
  {
    matcher: (name) => name.includes('diamond'),
    config: {
      animationKey: 'diamond',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'portal',
      durationMs: 3000,
      gradient: 'linear-gradient(135deg, rgba(6,10,18,0.95), rgba(59,130,246,0.18))',
      glowClass: 'shadow-[0_0_30px_rgba(59,130,246,0.65)]',
      description: 'A blue diamond drops, spins, and flashes into crystal sparkles.',
      trayGradient: 'linear-gradient(135deg, #07111e, #1f3a67)',
    },
  },
  {
    matcher: (name) => name.includes('unicorn'),
    config: {
      animationKey: 'unicorn',
      rarity: 'legendary',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 5900,
      gradient: 'linear-gradient(135deg, rgba(10,8,18,0.95), rgba(255,117,226,0.18))',
      glowClass: 'shadow-[0_0_40px_rgba(236,72,153,0.75)]',
      description: 'A unicorn races across a neon rainbow trail with stars and sparkles.',
      trayGradient: 'linear-gradient(135deg, #0b0819, #5a2763)',
    },
  },
  {
    matcher: (name) => name.includes('ring'),
    config: {
      animationKey: 'ring',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'burst',
      durationMs: 3000,
      gradient: 'linear-gradient(135deg, rgba(12,8,14,0.95), rgba(251,191,36,0.16))',
      glowClass: 'shadow-[0_0_30px_rgba(250,204,21,0.68)]',
      description: 'A sparkling ring glints and sends out heart-shaped particles.',
      trayGradient: 'linear-gradient(135deg, #110e11, #4f3210)',
    },
  },
  {
    matcher: (name) => name.includes('mansion'),
    config: {
      animationKey: 'mansion',
      rarity: 'epic',
      isFullscreen: true,
      animationType: 'fullscreen_video',
      durationMs: 5400,
      gradient: 'linear-gradient(135deg, rgba(8,7,18,0.95), rgba(225,190,47,0.16))',
      glowClass: 'shadow-[0_0_38px_rgba(245,158,11,0.75)]',
      description: 'A mansion rises with lights and luxury fireworks behind it.',
      trayGradient: 'linear-gradient(135deg, #0c0915, #4f4015)',
    },
  },
  {
    matcher: (name) => name.includes('404') || name.includes('error'),
    config: {
      animationKey: 'error_404',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'shake',
      durationMs: 3000,
      gradient: 'linear-gradient(135deg, rgba(20,0,10,0.95), rgba(239,68,68,0.18))',
      glowClass: 'shadow-[0_0_30px_rgba(248,113,113,0.75)]',
      description: 'A glitch shakes the screen and bursts into red/cyan static.',
      trayGradient: 'linear-gradient(135deg, #120a10, #5c151b)',
    },
  },
  {
    matcher: (name) => name.includes('lag switch'),
    config: {
      animationKey: 'lag_switch',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'shake',
      durationMs: 2500,
      gradient: 'linear-gradient(135deg, rgba(10,10,18,0.95), rgba(56,189,248,0.12))',
      glowClass: 'shadow-[0_0_28px_rgba(56,189,248,0.7)]',
      description: 'A pixel glitch and signal pulse briefly stutter the view.',
      trayGradient: 'linear-gradient(135deg, #081019, #14374c)',
    },
  },
  {
    matcher: (name) => name.includes('trophy'),
    config: {
      animationKey: 'trophy',
      rarity: 'rare',
      isFullscreen: false,
      animationType: 'burst',
      durationMs: 3000,
      gradient: 'linear-gradient(135deg, rgba(10,8,15,0.95), rgba(250,204,21,0.16))',
      glowClass: 'shadow-[0_0_32px_rgba(250,204,21,0.7)]',
      description: 'A trophy pops up with confetti and a victory pulse.',
      trayGradient: 'linear-gradient(135deg, #100f11, #533d0d)',
    },
  },
];

const getDefaultRarity = (value: number): GiftRarity => {
  if (value >= 5000) return 'mythic';
  if (value >= 2500) return 'legendary';
  if (value >= 500) return 'epic';
  if (value >= 200) return 'rare';
  if (value >= 100) return 'uncommon';
  return 'common';
};

const getDefaultAnimationType = (value: number): GiftAnimationType => {
  if (value >= 5000) return 'fullscreen_video';
  if (value >= 1000) return 'video';
  if (value >= 200) return 'particle';
  return 'emoji';
};

const getDefaultGradient = (rarity: GiftRarity): string => {
  switch (rarity) {
    case 'mythic': return 'linear-gradient(135deg, rgba(15,10,45,0.94), rgba(79,70,229,0.2))';
    case 'legendary': return 'linear-gradient(135deg, rgba(10,5,25,0.95), rgba(249,115,22,0.2))';
    case 'epic': return 'linear-gradient(135deg, rgba(10,10,30,0.95), rgba(168,85,247,0.18))';
    case 'rare': return 'linear-gradient(135deg, rgba(10,10,25,0.95), rgba(59,130,246,0.16))';
    case 'uncommon': return 'linear-gradient(135deg, rgba(10,20,15,0.95), rgba(34,197,94,0.16))';
    default: return 'linear-gradient(135deg, rgba(15,15,20,0.95), rgba(107,114,128,0.15))';
  }
};

const getDefaultGlowClass = (rarity: GiftRarity): string => {
  switch (rarity) {
    case 'mythic': return 'shadow-[0_0_35px_rgba(79,70,229,0.9)]';
    case 'legendary': return 'shadow-[0_0_30px_rgba(249,115,22,0.8)]';
    case 'epic': return 'shadow-[0_0_26px_rgba(168,85,247,0.75)]';
    case 'rare': return 'shadow-[0_0_24px_rgba(59,130,246,0.7)]';
    case 'uncommon': return 'shadow-[0_0_22px_rgba(34,197,94,0.65)]';
    default: return 'shadow-[0_0_20px_rgba(148,163,184,0.45)]';
  }
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const KNOWN_GIFT_STORAGE_BUCKETS = ['gift-videos', 'gift-animations', 'gifts', 'public']

const normalizeSlug = (value?: string | null): string | null => {
  if (!value) return null
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/(^-|-$)/g, '') || null
}

const toStorageFileName = (value?: string | null): string | null => {
  if (!value) return null
  return String(value)
    .replace(/^gift_/, '')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .toLowerCase() || null
}

const buildSupabaseStorageUrl = (bucket: string, filePath: string): string | null => {
  if (!bucket || !filePath || !SUPABASE_URL) return null
  const sanitizedBucket = bucket.replace(/\/+$/g, '')
  const sanitizedPath = String(filePath).replace(/^\/+/, '')
  return `${SUPABASE_URL.replace(/\/+$/g, '')}/storage/v1/object/public/${sanitizedBucket}/${sanitizedPath}`
}

const isFullUrl = (value?: string | null): value is string => {
  return typeof value === 'string' && /^(https?:)?\/\//i.test(value)
}

const getAssetTypeFromField = (field: string, value?: string | null): 'video' | 'image' | 'unknown' => {
  if (!value) return 'unknown'
  if (field === 'icon_url') return 'image'
  if (field === 'animation_url') return 'video'
  return 'unknown'
}

const getAssetTypeFromUrl = (url?: string | null): 'video' | 'image' | null => {
  if (!url) return null
  const lower = url.toLowerCase()
  if (lower.match(/\.(webm|mp4|mov|m4v|ogv|ogg)(\?.*)?$/)) return 'video'
  if (lower.match(/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/)) return 'image'
  return null
}

const resolveSupabaseStorageUrl = (value?: string | null): { url: string; type: 'video' | 'image' } | null => {
  if (!value || !SUPABASE_URL) return null
  const normalized = String(value).trim().replace(/^\/+/, '')
  const firstSegment = normalized.split('/')[0]

  if (KNOWN_GIFT_STORAGE_BUCKETS.includes(firstSegment) && normalized.split('/').length > 1) {
    const bucket = firstSegment
    const path = normalized.slice(bucket.length + 1)
    const assetType = getAssetTypeFromUrl(path) || (path.includes('gif') ? 'image' : 'video')
    return {
      url: buildSupabaseStorageUrl(bucket, path) as string,
      type: assetType,
    }
  }

  const extensionType = getAssetTypeFromUrl(normalized)
  if (extensionType) {
    const bucket = KNOWN_GIFT_STORAGE_BUCKETS[0]
    const path = normalized
    return {
      url: buildSupabaseStorageUrl(bucket, path) as string,
      type: extensionType,
    }
  }

  return null
}

const getLocalFallbackSlugs = (slug: string): string[] => {
  const normalizedSlug = normalizeSlug(slug) || ''
  const strippedSlug = normalizedSlug.replace(/^gift[-_]/i, '')
  return Array.from(new Set([normalizedSlug, strippedSlug].filter(Boolean)))
}

const buildLocalGiftCandidates = (slug: string, type: 'video' | 'image'): string[] => {
  const slugs = getLocalFallbackSlugs(slug)
  if (type === 'image') {
    return slugs.map((candidate) => `/gift-images/${candidate}.png`)
  }
  return slugs.flatMap((candidate) => [`/gift-videos/${candidate}.webm`, `/gift-videos/${candidate}.mp4`, `/gift-animations/${candidate}.webm`, `/gift-animations/${candidate}.mp4`])
}

const debugGiftResolutionMap = new Map<string, Record<string, any>>()

export function getGiftVisualConfig(gift: {
  id?: string;
  gift_id?: string;
  name?: string;
  slug?: string;
  gift_slug?: string;
  icon?: string;
  coinCost?: number;
  value?: number;
  amount?: number;
  animation_key?: string;
  animationKey?: string;
  animation_type?: string;
  animationType?: string;
  animation_url?: string;
  animationUrl?: string;
  video_url?: string;
  videoUrl?: string;
  media_url?: string;
  mediaUrl?: string;
  image_url?: string;
  imageUrl?: string;
  icon_url?: string;
  iconUrl?: string;
  animation_duration_ms?: number;
  animationDurationMs?: number;
  sound_url?: string;
  soundUrl?: string;
  is_fullscreen?: boolean;
  isFullscreen?: boolean;
  rarity?: GiftRarity | string;
  description?: string;
  tray_visual_url?: string;
  tray_gradient?: string;
  trayVisualUrl?: string;
  trayGradient?: string;
}): GiftVisualConfig {
  const name = (gift.name || '').trim();
  const slug = normalizeSlug(
    gift.slug || gift.gift_slug || gift.gift_id || gift.animationKey || gift.animation_key || gift.name || ''
  ) || '';
  const value = gift.coinCost ?? gift.value ?? gift.amount ?? 0;
  const animationKey = gift.animationKey || gift.animation_key || getAnimationKeyFromName(name, slug);
  const preset = PRESET_GIFT_CONFIG.find((entry) => entry.matcher(name.toLowerCase(), slug.toLowerCase()));

  const rarity = (gift.rarity as GiftRarity) || preset?.config.rarity || getDefaultRarity(value);
  const animationType = (gift.animationType as GiftAnimationType) || (gift.animation_type as GiftAnimationType) || preset?.config.animationType || getDefaultAnimationType(value);
  const isFullscreen = gift.isFullscreen ?? gift.is_fullscreen ?? preset?.config.isFullscreen ?? value >= 5000;
  const durationMs = gift.animationDurationMs ?? gift.animation_duration_ms ?? preset?.config.durationMs ?? (value >= 5000 ? 5800 : value >= 1000 ? 4200 : value >= 200 ? 3400 : 2800);

  let resolvedUrl: string | null = null;
  let resolvedType: 'video' | 'image' | 'fallback' = 'fallback';
  let resolvedVideoUrl: string | null = null;
  let resolvedImageUrl: string | null = null;
  let resolvedSource: 'animation_url' | 'icon_url' | 'local_fallback' | 'missing' | null = null;

  const debugEntry: Record<string, any> = {
    id: gift.id,
    name,
    slug,
    gift_slug: gift.gift_slug || null,
    animation_url: gift.animation_url || null,
    resolvedUrl: null,
    resolvedSource: null,
    resolvedType: 'fallback',
  };

  // 1) animation_url (primary)
  const animUrl = gift.animation_url || gift.animationUrl || null;
  if (animUrl) {
    if (isFullUrl(animUrl)) {
      resolvedUrl = animUrl;
      resolvedType = (getAssetTypeFromUrl(animUrl) as any) || 'video';
      resolvedSource = 'animation_url';
    } else {
      const r = resolveSupabaseStorageUrl(animUrl);
      if (r) {
        resolvedUrl = r.url;
        resolvedType = r.type;
        resolvedSource = 'animation_url';
      }
    }
  }

  // 2) icon_url (fallback image)
  if (!resolvedUrl && (gift.icon_url || (gift as any).iconUrl)) {
    const iconVal = (gift.icon_url || (gift as any).iconUrl) as string;
    if (isFullUrl(iconVal)) {
      resolvedUrl = iconVal;
      resolvedType = 'image';
      resolvedSource = 'icon_url';
    } else {
      const r = resolveSupabaseStorageUrl(iconVal);
      if (r) {
        resolvedUrl = r.url;
        resolvedType = r.type === 'video' ? 'image' : r.type;
        resolvedSource = 'icon_url';
      }
    }
  }

  // 3) local video fallbacks
  if (!resolvedUrl) {
    const vids = buildLocalGiftCandidates(slug, 'video');
    if (vids && vids.length > 0) {
      resolvedUrl = vids[0];
      resolvedType = 'video';
      resolvedSource = 'local_fallback';
    }
  }

  // 4) local image fallback
  if (!resolvedUrl) {
    const imgs = buildLocalGiftCandidates(slug, 'image');
    if (imgs && imgs.length > 0) {
      resolvedUrl = imgs[0];
      resolvedType = 'image';
      resolvedSource = 'local_fallback';
    }
  }

  // 5) missing -> keep fallback
  if (!resolvedUrl) {
    resolvedType = 'fallback';
    resolvedSource = 'missing';
  }

  if (resolvedType === 'video') {
    resolvedVideoUrl = resolvedUrl
    resolvedImageUrl = `/gift-images/${slug}.png`
  } else if (resolvedType === 'image') {
    resolvedImageUrl = resolvedUrl
  }

  debugEntry.resolvedUrl = resolvedUrl
  debugEntry.resolvedSource = resolvedSource
  debugEntry.resolvedType = resolvedType
  debugGiftResolutionMap.set(gift.id || `${name}-${slug}`, debugEntry)

  if (import.meta.env.DEV && debugGiftResolutionMap.size <= 1) {
    // Only log on first resolution to avoid console spam on every gift render
    const tableRows = Array.from(debugGiftResolutionMap.values()).map((v) => ({
      name: v.name,
      slug: v.slug,
      gift_slug: v.gift_slug,
      animation_url: v.animation_url,
      resolvedUrl: v.resolvedUrl,
      resolvedSource: v.resolvedSource,
    }))
    console.table(tableRows)
  }

  return {
    animationKey,
    animationType,
    rarity,
    gradient: preset?.config.gradient || getDefaultGradient(rarity),
    glowClass: preset?.config.glowClass || getDefaultGlowClass(rarity),
    isFullscreen,
    durationMs,
    description: gift.description || preset?.config.description || undefined,
    trayLabel: name || 'Gift',
    animationUrl: resolvedUrl,
    resolvedUrl,
    resolvedSource: resolvedSource || null,
    resolvedType,
    resolvedVideoUrl,
    resolvedImageUrl,
    slug,
    soundUrl: gift.soundUrl || gift.sound_url || null,
    trayVisualUrl: gift.tray_visual_url || gift.trayVisualUrl || undefined,
    trayGradient: gift.tray_gradient || gift.trayGradient || preset?.config.trayGradient || undefined,
  };
}
function getAnimationKeyFromName(name: string, slug: string): string {
  return slug;
}

