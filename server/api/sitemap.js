/**
 * Dynamic Sitemap Generator
 * 
 * Generates sitemap.xml with:
 * - Static pages (homepage, explore, etc.)
 * - All public profiles (/:username)
 * - All public streams (/:username/live/:slug)
 */

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://maiMai Troll.com';

/**
 * Generate the full sitemap XML
 */
async function generateSitemap(supabase) {
  const urls = [];
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // ============================================================
  // STATIC PAGES
  // ============================================================
  const staticPages = [
    { loc: `${APP_URL}/`, priority: 1.0, changefreq: 'daily' },
    { loc: `${APP_URL}/explore`, priority: 1.0, changefreq: 'always' },
    { loc: `${APP_URL}/live`, priority: 0.9, changefreq: 'always' },
    { loc: `${APP_URL}/live-swipe`, priority: 0.9, changefreq: 'always' },
    { loc: `${APP_URL}/broadcasts`, priority: 0.9, changefreq: 'always' },
    { loc: `${APP_URL}/podcasts`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/hytro`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/news`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/trending`, priority: 0.9, changefreq: 'always' },
    { loc: `${APP_URL}/new-creators`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/auctions`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/marketplace`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/hytrogaming`, priority: 0.8, changefreq: 'daily' },
    { loc: `${APP_URL}/podcast`, priority: 0.7, changefreq: 'daily' },
    { loc: `${APP_URL}/troll-wheel`, priority: 0.7, changefreq: 'daily' },
    { loc: `${APP_URL}/troll-court`, priority: 0.7, changefreq: 'weekly' },
    { loc: `${APP_URL}/government`, priority: 0.6, changefreq: 'weekly' },
    { loc: `${APP_URL}/garage`, priority: 0.6, changefreq: 'weekly' },
    { loc: `${APP_URL}/family/browse`, priority: 0.6, changefreq: 'weekly' },
    { loc: `${APP_URL}/about`, priority: 0.5, changefreq: 'monthly' },
    { loc: `${APP_URL}/contact`, priority: 0.5, changefreq: 'monthly' },
    { loc: `${APP_URL}/faq`, priority: 0.5, changefreq: 'monthly' },
    { loc: `${APP_URL}/privacy`, priority: 0.3, changefreq: 'monthly' },
    { loc: `${APP_URL}/terms`, priority: 0.3, changefreq: 'monthly' },
  ];

  for (const page of staticPages) {
    urls.push(`  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // ============================================================
  // PUBLIC PROFILES
  // ============================================================
  if (supabase) {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('username, updated_at')
        .eq('is_profile_public', true)
        .eq('is_banned', false)
        .eq('is_indexed', true)
        .not('username', 'is', null)
        .not('username', 'eq', '');

      if (!profileError && profiles) {
        for (const profile of profiles) {
          const lastmod = profile.updated_at
            ? new Date(profile.updated_at).toISOString().split('T')[0]
            : now;
          urls.push(`  <url>
    <loc>${escapeXml(`${APP_URL}/${profile.username}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
        }
      }
    } catch (err) {
      console.error('[Sitemap] Error fetching profiles:', err.message);
    }

    // ============================================================
    // PUBLIC STREAMS
    // ============================================================
    try {
      const { data: streams, error: streamError } = await supabase
        .from('streams')
        .select('id, slug, status, updated_at, user_profiles!streams_broadcaster_id_fkey(username)')
        .eq('is_public', true)
        .not('status', 'eq', 'deleted')
        .not('slug', 'is', null)
        .not('slug', 'eq', '');

      if (!streamError && streams) {
        for (const stream of streams) {
          const username = stream.user_profiles?.username;
          if (!username) continue;

          const lastmod = stream.updated_at
            ? new Date(stream.updated_at).toISOString().split('T')[0]
            : now;

          const isLive = stream.status === 'live';
          const priority = isLive ? 0.9 : 0.6;
          const changefreq = isLive ? 'always' : 'daily';

          urls.push(`  <url>
    <loc>${escapeXml(`${APP_URL}/${username}/live/${stream.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
        }
      }
    } catch (err) {
      console.error('[Sitemap] Error fetching streams:', err.message);
    }
  }

  // ============================================================
  // BUILD XML
  // ============================================================
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('\n')}
</urlset>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateSitemap, escapeXml };
