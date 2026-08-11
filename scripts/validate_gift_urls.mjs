import fetch from 'node-fetch';

const SUPABASE_URL = 'https://gejtbllazzighxwxudyu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8';

const toStorageFileName = (value) => {
  if (!value) return null;
  return value
    .replace(/^gift_/i, '')
    .replace(/_/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase() || null;
};

const buildUrl = (fileName) =>
  fileName
    ? `${SUPABASE_URL.replace(/\/+$/,'')}/storage/v1/object/public/gift-videos/${fileName}.webm`
    : null;

const getAnimationKeyFromName = (name = '', slug = '') => {
  const normalized = `${name || ''} ${slug || ''}`.toLowerCase();
  if (normalized.includes('alien')) return 'alien_invasion';
  if (normalized.includes('yacht')) return 'yacht';
  if (normalized.includes('phoenix')) return 'phoenix';
  if (normalized.includes('private jet') || normalized.includes('jet')) return 'private_jet';
  if (normalized.includes('dragon')) return 'dragon';
  if (normalized.includes('black hole') || normalized.includes('blackhole')) return 'black_hole';
  if (normalized.includes('gold bar') || normalized.includes('gold_bar') || normalized.includes('goldbar')) return 'gold_bar';
  if (normalized.includes('planet')) return 'planet';
  if (normalized.includes('rocket')) return 'rocket';
  if (normalized.includes('rolex') || normalized.includes('watch')) return 'rolex';
  if (normalized.includes('cash stack') || normalized.includes('money stack') || normalized.includes('cash')) return 'cash_stack';
  if (normalized.includes('time machine') || normalized.includes('time portal') || normalized.includes('time')) return 'time_machine';
  if (normalized.includes('sports car') || normalized.includes('sportscar') || normalized.includes('car')) return 'sports_car';
  if (normalized.includes('galaxy')) return 'galaxy';
  if (normalized.includes('diamond')) return 'diamond';
  if (normalized.includes('unicorn')) return 'unicorn';
  if (normalized.includes('ring')) return 'ring';
  if (normalized.includes('mansion')) return 'mansion';
  if (normalized.includes('404') || normalized.includes('error')) return 'error_404';
  if (normalized.includes('lag switch') || normalized.includes('lag_switch')) return 'lag_switch';
  if (normalized.includes('trophy')) return 'trophy';
  if (slug) {
    return slug.replace(/^gift_/i, '').replace(/[^a-z0-9_]+/g, '_').replace(/(^_|_$)/g, '') || 'gift_boost';
  }
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'gift_boost';
};

const isFullUrl = (value) =>
  typeof value === 'string' && /^(https?:)?\/\//i.test(value);

(async () => {
  const restUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/gift_items?select=*`;
  const response = await fetch(restUrl, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Supabase fetch failed', response.status, await response.text());
    process.exit(1);
  }

  const gifts = await response.json();
  const samples = gifts.filter((g) =>
    ['Troll ', 'Coffee', 'Heart', 'Dragon', 'Cash Stack', 'Alien Invasion'].includes(
      (g.name || g.gift_name || g.title || '').trim()
    )
  );

  for (const gift of samples) {
    const name = (gift.name || gift.gift_name || gift.title || '').trim();
    const slug = gift.slug || gift.gift_slug || gift.animation_key || gift.animationKey || '';
    const animationKey = getAnimationKeyFromName(name, slug);
    const explicitVideo = gift.video_url || gift.videoUrl || gift.animation_url || gift.animationUrl || null;
    const explicitFull = isFullUrl(explicitVideo) ? explicitVideo : null;
    const keyFile = toStorageFileName(animationKey);
    const slugFile = toStorageFileName(slug);
    const fallback = buildUrl(keyFile) || buildUrl(slugFile);
    const resolved = explicitFull || fallback;

    console.log('---');
    console.log('id:', gift.id);
    console.log('name:', name);
    console.log('slug:', slug);
    console.log('animationKey:', animationKey);
    console.log('explicitVideo:', explicitVideo);
    console.log('keyFile:', keyFile);
    console.log('slugFile:', slugFile);
    console.log('resolvedUrl:', resolved);
  }
})();
