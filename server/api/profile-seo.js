/**
 * Profile SEO Endpoint
 * 
 * Returns full HTML with OG/Twitter meta tags for social crawlers
 * visiting profile URLs like /kain
 * 
 * Also handles /:username routes for bot/crawler requests.
 */

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com';
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/images/mai-troll-preview.png`;

function escapeJsonLd(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\b/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u0062')
    .replace(/&/g, '\\u0026');
}

function safeJsonLd(obj) {
  const json = JSON.stringify(obj);
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u0062').replace(/&/g, '\\u0026');
}

/**
 * Generate HTML with SEO meta tags for a profile page
 */
function generateProfileSEOHTML(profile, liveStream, baseUrl, options = {}) {
  const { isIndexed = true, isBanned = false, isPrivate = false, isProfilePublic = true } = options;
  const username = profile.username || profile.display_name || 'User';
  const displayName = profile.display_name || profile.username || 'User';
  const bio = profile.bio || `${displayName} on MaiTroll`;
  const avatarUrl = profile.avatar_url || FALLBACK_PREVIEW_IMAGE;
  const profileUrl = `${baseUrl}/profile/${username}`;

  const isLive = !!liveStream;
  const title = isLive
    ? `${displayName} (@${username}) LIVE | MaiTroll`
    : `${displayName} (@${username}) | MaiTroll`;

  const description = isLive
    ? `Watch ${displayName} live on MaiTroll right now! ${liveStream.title || ''}`
    : bio;

  const ogImage = isLive && liveStream.thumbnail_url
    ? liveStream.thumbnail_url
    : avatarUrl;

  const esc = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const jsonLd = safeJsonLd({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "url": profileUrl,
    "mainEntity": {
      "@type": "Person",
      "name": displayName,
      "alternateName": `@${username}`,
      "url": profileUrl,
      ...(profile.avatar_url ? { "image": profile.avatar_url } : {}),
      ...(profile.bio ? { "description": profile.bio } : {})
    }
  });

  const robotsContent = (isBanned || isPrivate || !isIndexed || !isProfilePublic)
    ? 'noindex, nofollow'
    : 'index, follow';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robotsContent}">
  <link rel="canonical" href="${esc(profileUrl)}">

  <!-- Open Graph -->
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:secure_url" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(profileUrl)}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="MaiTroll">
  <meta property="og:locale" content="en_US">
  <meta property="profile:username" content="${esc(username)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <meta name="twitter:image:alt" content="${esc(title)}">

  ${isLive ? `
  <!-- Live badge meta -->
  <meta property="og:live" content="true">
  ` : ''}

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${jsonLd}</script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0814; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    .container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #22d3ee; margin-bottom: 16px; }
    .live-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 12px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    h1 { font-size: 28px; margin: 0 0 4px 0; }
    .username { font-size: 18px; color: #22d3ee; margin-bottom: 12px; }
    p { font-size: 16px; color: #9ca3af; max-width: 400px; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    ${isLive ? '<span class="live-badge">● LIVE NOW</span>' : ''}
    <img class="avatar" src="${esc(avatarUrl)}" alt="${esc(displayName)}" onerror="this.src='${FALLBACK_PREVIEW_IMAGE}'">
    <h1>${esc(displayName)}</h1>
    <div class="username">@${esc(username)}</div>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(profileUrl)}">${isLive ? 'Watch Live' : 'View Profile'}</a>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML with SEO meta tags for a stream page (username/slug format)
 */
function generateStreamSEOHTML(stream, broadcaster, baseUrl) {
  const username = broadcaster?.username || 'streamer';
  const displayName = broadcaster?.display_name || username;
  const title = stream.title || `${displayName}'s Stream`;
  const streamUrl = `${baseUrl}/${username}/live/${stream.slug || stream.id}`;
  const isLive = stream.status === 'live';
  const isPublic = stream.is_public !== false;
  const isBanned = broadcaster?.is_banned === true;

  // Noindex for private/banned/deleted content
  const noindex = !isPublic || isBanned || stream.status === 'deleted';

  const description = isLive
    ? `Watch ${displayName} live on MaiTroll right now! ${stream.title || ''}`
    : `Watch ${stream.title || displayName + '\'s Stream'} on MaiTroll.`;

  const previewImage = stream.thumbnail_url
    || broadcaster?.thumbnail_url
    || broadcaster?.avatar_url
    || FALLBACK_PREVIEW_IMAGE;

  const esc = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const jsonLd = safeJsonLd({
    "@context": "https://schema.org",
    "@type": "BroadcastEvent",
    "name": title,
    "description": description,
    "url": streamUrl,
    "liveBroadcast": isLive,
    "image": previewImage,
    "organizer": {
      "@type": "Person",
      "name": displayName,
      "url": `${baseUrl}/${username}`
    }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | MaiTroll</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(streamUrl)}">

  ${noindex ? '<!-- Noindex: content is private, banned, or deleted -->\n  <meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}

  <!-- Open Graph -->
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(previewImage)}">
  <meta property="og:image:secure_url" content="${esc(previewImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(streamUrl)}">
  <meta property="og:type" content="${isLive ? 'video.other' : 'website'}">
  <meta property="og:site_name" content="MaiTroll">
  <meta property="og:locale" content="en_US">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(previewImage)}">
  <meta name="twitter:image:alt" content="${esc(title)}">

  ${isLive ? '<meta property="og:live" content="true">' : ''}

  <!-- JSON-LD -->
  <script type="application/ld+json">${jsonLd}</script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0814; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    .container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .live-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 12px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; }
    .streamer { font-size: 16px; color: #22d3ee; margin-bottom: 12px; }
    p { font-size: 16px; color: #9ca3af; max-width: 400px; margin-bottom: 24px; }
    .preview-image { max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    ${isLive ? '<span class="live-badge">● LIVE</span>' : ''}
    <img class="preview-image" src="${esc(previewImage)}" alt="${esc(title)}" onerror="this.style.display='none'">
    <h1>${esc(title)}</h1>
    <div class="streamer">${esc(displayName)} (@${esc(username)})</div>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(streamUrl)}">${isLive ? 'Watch Live' : 'Watch Replay'}</a>
  </div>
</body>
</html>`;
}

/**
 * Express route handler for /api/social/profile/:username
 * Returns HTML with OG meta tags for profile URLs
 */
async function handleProfileSEO(req, res) {
  const { username } = req.params;

  if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).send('Invalid username');
  }

  try {
    const supabase = req.app.locals.supabase;
    if (!supabase) {
      return res.status(500).send('Server configuration error');
    }

    // Look up profile by username (case-insensitive)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, is_banned, account_state')
      .ilike('username', username)
      .maybeSingle();

    if (profileError) {
      console.error('[ProfileSEO] Error:', profileError);
      return res.status(500).send('Error fetching profile');
    }

    if (!profile) {
      // Return 404 with fallback meta
      const html = generateProfileSEOHTML(
        { username, display_name: 'User Not Found', bio: 'This profile does not exist.' },
        null,
        APP_URL,
        { isIndexed: false, isProfilePublic: false }
      );
      return res.status(404).send(html);
    }

    const isPrivate = profile.account_state === 'suspended' || profile.account_state === 'banned';
    const isBanned = profile.is_banned === true;

    if (isBanned || isPrivate) {
      const html = generateProfileSEOHTML(
        profile,
        null,
        APP_URL,
        { isIndexed: false, isBanned, isPrivate: true }
      );
      return res.status(200).send(html);
    }

    // Check if user is currently live
    const { data: liveStream } = await supabase
      .from('streams')
      .select('id, title, slug, thumbnail_url, status, is_public')
      .eq('user_id', profile.id)
      .eq('status', 'live')
      .eq('is_public', true)
      .maybeSingle();

    const html = generateProfileSEOHTML(profile, liveStream, APP_URL, { isIndexed: true, isBanned, isPrivate, isProfilePublic: true });
    res.status(200).send(html);

  } catch (error) {
    console.error('[ProfileSEO] Error:', error);
    return res.status(500).send('Error generating profile preview');
  }
}

/**
 * Express route handler for /api/social/stream/:username/:slug
 * Returns HTML with OG meta tags for stream URLs
 */
async function handleStreamSEO(req, res) {
  const { username, slug } = req.params;

  if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).send('Invalid username');
  }

  try {
    const supabase = req.app.locals.supabase;
    if (!supabase) {
      return res.status(500).send('Server configuration error');
    }

    // Look up profile by username
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, is_banned')
      .ilike('username', username)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(404).send('Stream not found');
    }

    // Look up stream by user_id + slug
    let query = supabase
      .from('streams')
      .select('id, title, slug, thumbnail_url, status, is_public')
      .eq('user_id', profile.id)
      .eq('is_public', true);

    if (slug && slug !== 'live') {
      query = query.eq('slug', slug);
    } else {
      query = query.eq('status', 'live');
    }

    const { data: stream, error: streamError } = await query.maybeSingle();

    if (streamError || !stream) {
      return res.status(404).send('Stream not found');
    }

    const html = generateStreamSEOHTML(stream, profile, APP_URL);
    res.status(200).send(html);

  } catch (error) {
    console.error('[StreamSEO] Error:', error);
    return res.status(500).send('Error generating stream preview');
  }
}

module.exports = {
  handleProfileSEO,
  handleStreamSEO,
  generateProfileSEOHTML,
  generateStreamSEOHTML,
  FALLBACK_PREVIEW_IMAGE
};
