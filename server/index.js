import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('node:fs/promises');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple in-memory rate limiter (no external dependency needed)
const rateLimitStore = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 120; // 120 requests per minute per IP

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  const record = rateLimitStore.get(ip);
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((record.resetAt - now) / 1000) });
    return;
  }
  next();
}

// Clean up rate limit store every 5 minutes (prevent memory growth)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

// Load environment variables from the root directory
const findConfig = require('find-config');
dotenv.config({ path: findConfig('.env.local') || findConfig('.env') });

// Telemetry handler - safe to load early (no Supabase client at module level)
const telemetryHandler = require('./api/telemetryHandler');
const { enforceRateLimit, verifyAdmin, getSummary, getBreakdown, getHistorical, refreshSnapshot } = require('./api/adminSupabaseUsage');

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This file defines API routes for LiveKit integration.
 * Key endpoints:
 *   POST /api/broadcasts/start-streaming  → starts LiveKit egress
 *   POST /api/broadcasts/stop-streaming   → stops egress
 *
 * DO NOT modify route paths without coordinating with:
 *   - Frontend: SetupPage.tsx and BroadcastPage.tsx
 *   - Handler: server/api/broadcasts.js
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

const app = express();
const PORT = process.env.PORT || 3002;

const { generateSitemap } = require('./api/sitemap');

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize Supabase client for server-side queries
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Startup diagnostics
console.log('[Server] 🔧 Configuration check:');
console.log('[Server]   SUPABASE_URL:', supabaseUrl ? '✅ set' : '❌ MISSING');
console.log('[Server]   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ set' : '❌ MISSING');
if (supabaseServiceKey && supabaseServiceKey.startsWith('eyJ')) {
  // JWT tokens start with "eyJ" — anon and service keys both do, but we can at least confirm it's set
  console.log('[Server]   ⚠️  Service key appears valid (JWT format)');
} else {
  console.log('[Server]   ❌ Service key missing or malformed');
}

// App URL for canonical URLs
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com';

// Default fallback image (used when no stream thumbnail available)
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/images/mai-troll-preview.png`;
const SITE_UPDATE_COLUMNS = 'id, title, slug, summary, content, post_type, is_published, published_at, updated_at, created_at';

function normalizeSiteUpdateInput(body = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const postType = body.post_type;

  if (!title || title.length > 160) throw new Error('Title is required and must be 160 characters or fewer');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new Error('Slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!summary || summary.length > 320) throw new Error('Summary is required and must be 320 characters or fewer');
  if (!content || content.length > 50000) throw new Error('Content is required and must be 50,000 characters or fewer');
  if (postType !== 'update' && postType !== 'blog') throw new Error('Post type must be update or blog');

  return {
    title,
    slug,
    summary,
    content,
    post_type: postType,
    is_published: body.is_published === true,
  };
}

async function notifyIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  const host = new URL(APP_URL).host;
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `${APP_URL}/${encodeURIComponent(key)}.txt`;
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`[IndexNow] Submission returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('[IndexNow] Submission failed:', error.message);
  }
}

async function notifyPublicStream(streamId) {
  if (!supabase) return;
  try {
    const { data: stream, error } = await supabase
      .from('streams')
      .select('is_public, user_profiles!streams_broadcaster_id_fkey(username)')
      .eq('id', streamId)
      .maybeSingle();
    if (error) throw error;
    const username = stream?.user_profiles?.username;
    if (stream?.is_public && username) {
      await notifyIndexNow([`${APP_URL}/live/${encodeURIComponent(username)}`, `${APP_URL}/sitemap.xml`]);
    }
  } catch (error) {
    console.error('[IndexNow] Failed to prepare live stream submission:', error);
  }
}

async function getSiteUpdateBySlug(slug, postType) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('site_updates')
    .select(SITE_UPDATE_COLUMNS)
    .eq('slug', slug)
    .eq('post_type', postType)
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/sitemap.xml', async (req, res) => {
  try {
    if (!supabase) {
      res.status(200).sendFile(path.join(__dirname, '../public/sitemap.xml'));
      return;
    }

    const sitemap = await generateSitemap(supabase);
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('[Sitemap] Error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  immutable: true
}));

app.use(cors());
app.use(rateLimit);
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next();
  });
});

// ============================================================================
// PLATFORM CAPACITY LIMITS (Beta)
// ============================================================================
const MAX_CONCURRENT_CONNECTIONS = 675;
let activeConnections = 0;
const connectionListeners = new Set();
function notifyConnectionListeners() {
  connectionListeners.forEach(fn => { try { fn(); } catch {} });
}

app.use((req, res, next) => {
  activeConnections++;
  notifyConnectionListeners();
  res.on('finish', () => {
    activeConnections = Math.max(0, activeConnections - 1);
    notifyConnectionListeners();
  });
  res.on('close', () => {
    activeConnections = Math.max(0, activeConnections - 1);
    notifyConnectionListeners();
  });
  next();
});

app.get('/api/admin/capacity', (req, res) => {
  res.status(200).json({
    activeConnections,
    maxConnections: MAX_CONCURRENT_CONNECTIONS,
    remainingConnections: Math.max(0, MAX_CONCURRENT_CONNECTIONS - activeConnections),
  });
});

app.post('/api/admin/capacity/subscribe', (req, res) => {
  const _id = Date.now().toString();
  const listener = () => {
    res.write(`data: ${JSON.stringify({ activeConnections, maxConnections: MAX_CONCURRENT_CONNECTIONS, remainingConnections: Math.max(0, MAX_CONCURRENT_CONNECTIONS - activeConnections) })}\n\n`);
  };
  connectionListeners.add(listener);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ activeConnections, maxConnections: MAX_CONCURRENT_CONNECTIONS, remainingConnections: Math.max(0, MAX_CONCURRENT_CONNECTIONS - activeConnections) })}\n\n`);
  req.on('close', () => {
    connectionListeners.delete(listener);
    res.end();
  });
});

// API Routes - Lazy-loaded to defer Supabase client initialization until after env is confirmed

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      LIVEKIT_URL: process.env.LIVEKIT_URL ? 'set' : 'MISSING',
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ? 'set' : 'MISSING',
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ? 'set' : 'MISSING',
    },
    nodeVersion: process.version,
    platform: process.platform
  });
});

// PayPal Test
app.get('/api/paypal/test', (req, res) => {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  res.status(clientId ? 200 : 500).json({ 
    status: clientId ? 'ok' : 'error', 
    message: clientId ? 'PayPal configured' : 'PayPal configuration missing' 
  });
});

// Telemetry
app.post('/api/telemetry', async (req, res) => {
  await telemetryHandler(req, res);
});

// Admin: Cache Clear
app.post('/api/admin/cache/clear', (req, res) => {
  console.log('Cache clear requested');
  res.status(200).json({ success: true, message: 'Server cache cleared successfully' });
});

// Admin: Database Backup Trigger (single definition)
app.post('/api/admin/backup/trigger', (req, res) => {
  console.log('Backup trigger requested');
  res.status(200).json({ success: true, message: 'Backup process started', jobId: Date.now() });
});

app.get('/api/admin/supabase-usage/summary', enforceRateLimit, verifyAdmin, getSummary);
app.get('/api/admin/supabase-usage/breakdown', enforceRateLimit, verifyAdmin, getBreakdown);
app.get('/api/admin/supabase-usage/historical', enforceRateLimit, verifyAdmin, getHistorical);
app.post('/api/admin/supabase-usage/refresh', enforceRateLimit, verifyAdmin, refreshSnapshot);

// Broadcast API Routes - lazy load handler
app.post('/api/broadcasts/start-streaming', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    if (!broadcastHandler.startStreaming) {
      console.error('[StartStreaming] Handler module loaded but startStreaming function not found');
      return res.status(500).json({
        error: 'Internal server error: Handler function not found',
        details: 'startStreaming function missing from broadcasts module',
      });
    }
    await broadcastHandler.startStreaming(req, res);
    if (res.statusCode === 200 && req.body?.streamId) {
      void notifyPublicStream(req.body.streamId);
    }
  } catch (err) {
    console.error('[StartStreaming] Handler error:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      type: err?.constructor?.name,
    });
    
    // Ensure we always return JSON, even on handler error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to start broadcast',
        details: err?.message || 'Unknown error',
        step: 'handler_execution',
      });
    }
  }
});

app.post('/api/broadcasts/stop-streaming', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    if (!broadcastHandler.stopStreaming) {
      console.error('[StopStreaming] Handler module loaded but stopStreaming function not found');
      return res.status(500).json({
        error: 'Internal server error: Handler function not found',
        details: 'stopStreaming function missing from broadcasts module',
      });
    }
    await broadcastHandler.stopStreaming(req, res);
  } catch (err) {
    console.error('[StopStreaming] Handler error:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      type: err?.constructor?.name,
    });
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to stop broadcast',
        details: err?.message || 'Unknown error',
        step: 'handler_execution',
      });
    }
  }
});

app.post('/api/broadcasts/save-video', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    await broadcastHandler.saveVideo(req, res);
  } catch (err) {
    console.error('[SaveVideo] Handler error:', err);
    res.status(500).json({ error: 'Failed to save video', details: err.message });
  }
});

// Make supabase available to route handlers via app.locals
app.locals.supabase = supabase;
app.locals.notifyIndexNow = notifyIndexNow;

app.get('/api/site-updates', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Site updates are unavailable until server database credentials are configured' });

  try {
    let query = supabase
      .from('site_updates')
      .select(SITE_UPDATE_COLUMNS)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (req.query.type === 'blog' || req.query.type === 'update') {
      query = query.eq('post_type', req.query.type);
    }
    if (typeof req.query.slug === 'string') {
      query = query.eq('slug', req.query.slug);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ posts: data || [] });
  } catch (error) {
    console.error('[SiteUpdates] Public query failed:', error);
    return res.status(500).json({ error: 'Failed to load site updates' });
  }
});

async function requireSiteUpdateAdmin(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: 'Site update publishing is unavailable until server database credentials are configured' });
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(match[1]);
    if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token' });

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== 'admin' && profile?.is_admin !== true) {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    req.siteUpdateAdminId = user.id;
    return next();
  } catch (error) {
    console.error('[SiteUpdates] Admin authorization failed:', error);
    return res.status(500).json({ error: 'Failed to verify administrator access' });
  }
}

app.get('/api/admin/site-updates', requireSiteUpdateAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_updates')
      .select(SITE_UPDATE_COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.status(200).json({ posts: data || [] });
  } catch (error) {
    console.error('[SiteUpdates] Admin query failed:', error);
    return res.status(500).json({ error: 'Failed to load site updates' });
  }
});

app.post('/api/admin/site-updates', requireSiteUpdateAdmin, async (req, res) => {
  let post;
  try {
    post = normalizeSiteUpdateInput(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const { data, error } = await supabase
      .from('site_updates')
      .insert({
        ...post,
        created_by: req.siteUpdateAdminId,
        published_at: post.is_published ? new Date().toISOString() : null,
      })
      .select(SITE_UPDATE_COLUMNS)
      .single();
    if (error) throw error;

    if (data.is_published) {
      void notifyIndexNow([`${APP_URL}/${data.post_type === 'blog' ? 'blog' : 'updates'}/${encodeURIComponent(data.slug)}`, `${APP_URL}/${data.post_type === 'blog' ? 'blog' : 'updates'}`, `${APP_URL}/sitemap.xml`]);
    }
    return res.status(201).json({ post: data });
  } catch (error) {
    console.error('[SiteUpdates] Create failed:', error);
    return res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'That slug is already in use for this post type' : 'Failed to create site update',
    });
  }
});

app.put('/api/admin/site-updates/:id', requireSiteUpdateAdmin, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  let post;
  try {
    post = normalizeSiteUpdateInput(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const { data, error } = await supabase
      .from('site_updates')
      .update({
        ...post,
        published_at: post.is_published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select(SITE_UPDATE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Site update not found' });

    if (data.is_published) {
      void notifyIndexNow([`${APP_URL}/${data.post_type === 'blog' ? 'blog' : 'updates'}/${encodeURIComponent(data.slug)}`, `${APP_URL}/${data.post_type === 'blog' ? 'blog' : 'updates'}`, `${APP_URL}/sitemap.xml`]);
    }
    return res.status(200).json({ post: data });
  } catch (error) {
    console.error('[SiteUpdates] Update failed:', error);
    return res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'That slug is already in use for this post type' : 'Failed to update site update',
    });
  }
});

app.delete('/api/admin/site-updates/:id', requireSiteUpdateAdmin, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  try {
    const { data, error } = await supabase
      .from('site_updates')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Site update not found' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[SiteUpdates] Delete failed:', error);
    return res.status(500).json({ error: 'Failed to delete site update' });
  }
});

// ============================================================================
// PROFILE SEO ENDPOINT
// Returns full HTML with OG/Twitter meta tags for social crawlers
// visiting profile URLs like /kain
// ============================================================================
const profileSEO = require('./api/profile-seo');

app.get('/api/social/profile/:username', async (req, res) => {
  await profileSEO.handleProfileSEO(req, res);
});

app.get(/^\/post\/([a-zA-Z0-9-]+)$/, async (req, res, next) => {
  const postId = req.params[0];
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit|linkedinbot|applebot|duckduckbot|baiduspider|yandexbot/i.test(userAgent);

  if (!isBot) return next();

  try {
    const { data: post, error } = await supabase
      .from('troll_wall_posts')
      .select('id, content, media_url, created_at, user_profiles(username, display_name, avatar_url)')
      .eq('id', postId)
      .maybeSingle();

    if (error) throw error;
    if (!post) {
      return res.status(404).send('Post not found');
    }

    return res.status(200).send(profileSEO.generateWallPostSEOHTML(post, APP_URL));
  } catch (error) {
    console.error('[WallPostSEO] Error:', error);
    return res.status(500).send('Error generating post preview');
  }
});

app.get('/wall/:postId', (req, res, _next) => {
  const postId = req.params.postId;
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit|linkedinbot|applebot|duckduckbot|baiduspider|yandexbot/i.test(userAgent);

  if (isBot) {
    return res.redirect(301, `/post/${encodeURIComponent(postId)}`);
  }

  return res.redirect(302, `/post/${encodeURIComponent(postId)}`);
});

// ============================================================================
// STREAM SEO ENDPOINT (username/slug format)
// Returns full HTML with OG/Twitter meta tags for stream URLs
// like /kain/live/smokeathon
// ============================================================================
app.get('/api/social/stream/:username/:slug', async (req, res) => {
  await profileSEO.handleStreamSEO(req, res);
});

// ============================================================================
// DYNAMIC SITEMAP
// ============================================================================
app.get('/sitemap-dynamic.xml', async (req, res) => {
  try {
    const sitemap = await generateSitemap(supabase);
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('[Sitemap] Error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Social Media Preview Endpoint - Returns HTML with Open Graph and Twitter Card meta tags
// Used by Facebook, X (Twitter), and other social media crawlers for link previews
app.get('/api/social/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Validate broadcastId is a UUID or username
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(broadcastId);
  
  let stream = null;
  let broadcaster = null;
  
  try {
    if (!supabase) {
      console.error('[SocialPreview] Supabase client not initialized');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    if (isUUID) {
      // Direct stream lookup by UUID
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('*, user_profiles!streams_broadcaster_id_fkey(username, avatar_url, thumbnail_url)')
        .eq('id', broadcastId)
        .maybeSingle();
      
      if (streamError) {
        console.error('[SocialPreview] Stream fetch error:', streamError);
      } else if (streamData) {
        stream = streamData;
        broadcaster = streamData.user_profiles;
      }
    } else {
      // Username lookup - find user first, then their active stream
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, thumbnail_url')
        .eq('username', broadcastId)
        .maybeSingle();
      
      if (userError) {
        console.error('[SocialPreview] User fetch error:', userError);
      } else if (userData) {
        // Look for active stream
        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select('*, user_profiles!streams_broadcaster_id_fkey(username, avatar_url, thumbnail_url)')
          .eq('user_id', userData.id)
          .eq('is_live', true)
          .eq('status', 'live')
          .maybeSingle();
        
        if (streamError) {
          console.error('[SocialPreview] Stream by user fetch error:', streamError);
        } else if (streamData) {
          stream = streamData;
          broadcaster = streamData.user_profiles;
        }
      }
    }
    
    // Handle stream not found or ended
    if (!stream) {
      const meta = generateSocialMetaHTML({
        title: 'Stream Not Found',
        description: 'This broadcast is not available.',
        image: FALLBACK_PREVIEW_IMAGE,
        url: `${APP_URL}/watch/${broadcastId}`,
        type: 'website',
        isLive: false
      });
      return res.status(404).send(meta);
    }

    const isLive = stream.status === 'live';
    const statusText = isLive ? 'LIVE' : 'Ended';
    const username = broadcaster?.username || null;

    const streamUrl = username
      ? `${APP_URL}/live/${encodeURIComponent(username)}`
      : `${APP_URL}/watch/${stream.id}`;

    const previewImage = stream.thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE;

    const ogImageUrl = username
      ? `${APP_URL}/api/og/profile?username=${encodeURIComponent(username)}`
      : null;

    const meta = generateSocialMetaHTML({
      title: `${username || 'Broadcaster'} is ${statusText} on MaiTroll`,
      description: stream.title || `Watch this live broadcast on MaiTroll`,
      image: previewImage,
      ogImageUrl,
      url: streamUrl,
      type: isLive ? 'video.other' : 'website',
      isLive,
      videoUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      videoWidth: 1280,
      videoHeight: 720,
      twitterCard: isLive ? 'player' : 'summary_large_image',
      twitterPlayerUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      twitterPlayerWidth: 1280,
      twitterPlayerHeight: 720
    });
    
    res.status(200).send(meta);
    
  } catch (error) {
    console.error('[SocialPreview] Error:', error);
    const meta = generateSocialMetaHTML({
      title: 'MaiTroll - Live Streaming',
      description: 'Join MaiTroll for live streaming and more.',
      image: FALLBACK_PREVIEW_IMAGE,
      url: `${APP_URL}/watch/${broadcastId}`,
      type: 'website',
      isLive: false
    });
    res.status(200).send(meta);
  }
});

// Watch page endpoint - Returns SEO-optimized HTML for /watch/:id routes
// This endpoint serves the HTML with meta tags directly for crawlers
app.get('/watch/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Redirect to the social preview API for crawler detection
  // Social media bots will follow the redirect but get meta tags in the API response
  // Regular users will be served the SPA via client-side routing
  
  // Check if this is a crawler request
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit/i.test(userAgent);
  
  if (isBot) {
    // Fetch and return meta directly
    return res.redirect(301, `/api/social/${broadcastId}`);
  }
  
  // For regular users, serve the index.html (client-side routing will handle it)
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Embed endpoint for video player
app.get('/embed/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Return embeddable HTML for Twitter/X player cards
  const embedHtml = generateEmbedHTML(broadcastId, APP_URL);
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(embedHtml);
});

// Helper: Generate Social Meta HTML with OG and Twitter Card tags
function generateSocialMetaHTML(data) {
  const {
    title = 'MaiTroll - Live Streaming',
    description = 'Watch live streams on MaiTroll',
    image = FALLBACK_PREVIEW_IMAGE,
    url = APP_URL,
    type = 'website',
    isLive = false,
    videoUrl = null,
    videoWidth = 1280,
    videoHeight = 720,
    twitterCard = 'summary_large_image',
    twitterPlayerUrl = null,
    twitterPlayerWidth = 1280,
    twitterPlayerHeight = 720,
    site = null,
    ogImageUrl = null
  } = data;

  const ogImage = ogImageUrl || image || FALLBACK_PREVIEW_IMAGE
  
  // Escape HTML entities to prevent XSS
  const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${esc(url)}">
  
  <!-- Open Graph / Facebook Meta Tags -->
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:site_name" content="MaiTroll">

  ${videoUrl ? `
  <meta property="og:video" content="${esc(videoUrl)}">
  <meta property="og:video:secure_url" content="${esc(videoUrl)}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="${videoWidth}">
  <meta property="og:video:height" content="${videoHeight}">
  ` : ''}
  
  <!-- Twitter / X Card Meta Tags -->
  <meta name="twitter:card" content="${esc(twitterCard)}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <meta name="twitter:image:alt" content="${esc(title)}">
  ${site ? `<meta name="twitter:site" content="${esc(site)}">` : ''}
  
  ${twitterPlayerUrl ? `
  <meta name="twitter:player" content="${esc(twitterPlayerUrl)}">
  <meta name="twitter:player:width" content="${twitterPlayerWidth}">
  <meta name="twitter:player:height" content="${twitterPlayerHeight}">
  ` : ''}
  
  <!-- Additional Meta Tags -->
  <meta property="al:ios:app_store_id" content="6471861674">
  <meta property="al:ios:app_name" content="MaiTroll">
  <meta property="al:android:package" content="app.maitroll.app">
  <meta property="al:android:app_name" content="MaiTroll">
  
  ${isLive ? `
  <meta property="og:live" content="true">
  <meta property="og:stream:status" content="live">
  ` : ''}
  
  <style>
    body { margin: 0; padding: 0; background: #000; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    .container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .live-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; }
    p { font-size: 16px; color: #9ca3af; margin: 0 0 24px 0; }
    .preview-image { max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
    .cta:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    ${isLive ? '<span class="live-badge">● LIVE</span>' : ''}
    <img class="preview-image" src="${esc(image)}" alt="${esc(title)}" onerror="this.style.display='none'">
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(url)}">Watch Now</a>
  </div>
</body>
</html>`;
  
  return html;
}

// Helper: Generate embeddable player HTML
function generateEmbedHTML(broadcastId, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watch Stream | MaiTroll</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; }
    .player-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div class="player-container">
    <iframe 
      src="${appUrl}/broadcast/${broadcastId}?embed=true" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
  </div>
</body>
</html>`;
}

// Broadcast API Routes - LiveKit Integration
const broadcastHandler = require('./api/broadcasts');
app.post('/api/broadcasts/start-streaming', async (req, res) => { await broadcastHandler.startStreaming(req, res); });
app.post('/api/broadcasts/stop-streaming', async (req, res) => { await broadcastHandler.stopStreaming(req, res); });
app.post('/api/broadcasts/save-video', async (req, res) => { await broadcastHandler.saveVideo(req, res); });

// Backward compatibility aliases (deprecated - remove after migration complete)
app.post('/api/broadcasts/start', async (req, res) => {
  console.warn('[Server] Deprecated endpoint /api/broadcasts/start called - use /api/broadcasts/start-streaming instead');
  await broadcastHandler.startStreaming(req, res);
  if (res.statusCode === 200 && req.body?.streamId) {
    void notifyPublicStream(req.body.streamId);
  }
});
app.post('/api/broadcasts/stop', async (req, res) => {
  console.warn('[Server] Deprecated endpoint /api/broadcasts/stop called - use /api/broadcasts/stop-streaming instead');
  await broadcastHandler.stopStreaming(req, res);
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  
  // Log to telemetry
  if (telemetryHandler.logEvent) {
    telemetryHandler.logEvent({
      event_type: 'server_error',
      message: err.message || 'Unknown Server Error',
      stack: err.stack,
      severity: 'error',
      fingerprint: `server-${err.message || 'unknown'}`,
      url: req.url,
      request_info: {
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      },
      env: process.env.NODE_ENV || 'development'
    }).catch(e => console.error('Failed to log server error to telemetry', e));
  }

  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// ============================================================================
// SERVER-SIDE SEO INJECTION FOR PROFILE & STREAM ROUTES
// When a bot/crawler visits /:username or /profile/:username or /:username/live/:slug,
// we detect it and return full HTML with meta tags directly.
// Regular users get the SPA (index.html) as usual.
// ============================================================================

const BOT_REGEX = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit|linkedinbot|applebot|duckduckbot|baiduspider|yandexbot|amazonbot|slurp|sogou|qwantify|perplexitybot|claudebot/i;

// Profile route: /profile/:username (for bots only — humans get SPA)
app.get(/^\/profile\/([a-zA-Z0-9_-]{2,30})$/, async (req, res, next) => {
  const username = req.params[0];
  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_REGEX.test(userAgent);

  if (!isBot) {
    return next();
  }

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, is_banned, account_state')
      .ilike('username', username)
      .maybeSingle();

    if (!profile) {
      return res.status(404).send('Profile not found');
    }

    if (profile.is_banned || profile.account_state === 'suspended' || profile.account_state === 'banned') {
      const noindexHtml = `<!DOCTYPE html>
<html><head><meta name="robots" content="noindex, nofollow">
<title>Profile Not Available</title></head>
<body><p>This profile is not available.</p></body></html>`;
      return res.status(200).send(noindexHtml);
    }

    const { data: liveStream } = await supabase
      .from('streams')
      .select('id, title, slug, thumbnail_url, status')
      .eq('user_id', profile.id)
      .eq('status', 'live')
      .eq('is_public', true)
      .maybeSingle();

    const seoHtml = profileSEO.generateProfileSEOHTML(profile, liveStream, APP_URL);
    return res.status(200).send(seoHtml);
  } catch (error) {
    console.error('[ProfileRouteSEO] Error:', error);
    return res.status(500).send('Server error');
  }
});

// Profile route: /:username (for bots only — humans get SPA)
app.get(/^\/([a-zA-Z0-9_-]{2,30})$/, async (req, res, next) => {
  const username = req.params[0];
  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_REGEX.test(userAgent);

  // Skip API routes, static files, and known non-profile paths
  const skipPaths = ['api/', 'assets/', 'images/', 'public/', 'favicon', 'robots', 'sitemap', 'embed/', 'watch/', 'health', 'static'];
  if (skipPaths.some(p => username.startsWith(p))) {
    return next();
  }

  if (!isBot) {
    return next();
  }

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, is_banned, account_state')
      .ilike('username', username)
      .maybeSingle();

    if (profile && !profile.is_banned && profile.account_state !== 'suspended' && profile.account_state !== 'banned') {
      const { data: liveStream } = await supabase
        .from('streams')
        .select('id, title, slug, thumbnail_url, status')
        .eq('user_id', profile.id)
        .eq('status', 'live')
        .eq('is_public', true)
        .maybeSingle();

      const seoHtml = profileSEO.generateProfileSEOHTML(profile, liveStream, APP_URL);
      return res.status(200).send(seoHtml);
    }

    if (!profile) {
      return res.status(404).send('Profile not found');
    }

    const noindexHtml = `<!DOCTYPE html>
<html><head><meta name="robots" content="noindex, nofollow">
<title>Profile Not Available</title></head>
<body><p>This profile is not available.</p></body></html>`;
    return res.status(200).send(noindexHtml);
  } catch (error) {
    console.error('[ProfileRouteSEO] Error:', error);
    return res.status(500).send('Server error');
  }
});

// Stream route: /:username/live/:slug (for bots only)
app.get(/^\/([a-zA-Z0-9_-]{2,30})\/live\/([a-zA-Z0-9_-]+)$/, async (req, res, next) => {
  const username = req.params[0];
  const slug = req.params[1];
  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_REGEX.test(userAgent);

  if (!isBot) {
    return next(); // Regular user gets SPA
  }

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, is_banned, account_state')
      .ilike('username', username)
      .maybeSingle();

    if (!profile || profile.is_banned || ['suspended', 'banned'].includes(profile.account_state)) {
      const noindexHtml = `<!DOCTYPE html>
<html><head><meta name="robots" content="noindex, nofollow">
<title>Stream Not Available</title></head>
<body><p>This stream is not available.</p></body></html>`;
      return res.status(200).send(noindexHtml);
    }

    const { data: stream } = await supabase
      .from('streams')
      .select('id, title, slug, thumbnail_url, status, is_public')
      .eq('user_id', profile.id)
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle();

    if (!stream) {
      return res.status(404).send('Stream not found');
    }

    const seoHtml = profileSEO.generateStreamSEOHTML(stream, profile, APP_URL);
    return res.status(200).send(seoHtml);
  } catch (error) {
    console.error('[StreamRouteSEO] Error:', error);
    return res.status(500).send('Error generating stream preview');
  }
});

const SEO_PAGE_METADATA = {
  '/terms': {
    title: 'Terms of Service | MaiTroll',
    description: 'Read the MaiTroll Terms of Service for accounts, community participation, broadcasting, virtual city features, content, and platform rules.',
    canonicalPath: '/terms',
  },
  '/terms-of-service': {
    title: 'Terms of Service | MaiTroll',
    description: 'Read the MaiTroll Terms of Service for accounts, community participation, broadcasting, virtual city features, content, and platform rules.',
    canonicalPath: '/terms',
  },
  '/legal/terms': {
    title: 'Terms of Service | MaiTroll',
    description: 'Read the MaiTroll Terms of Service for accounts, community participation, broadcasting, virtual city features, content, and platform rules.',
    canonicalPath: '/terms',
  },
  '/features/broadcasting-app': {
    title: 'Live Broadcasting App for Creators | MaiTroll',
    description: 'Explore MaiTroll, a live broadcasting app for creators to stream games, connect with viewers, and build an audience from supported phones, tablets, and computers.',
    body: [
      'MaiTroll is a live broadcasting app and social media platform designed to bring creators and audiences together. Start a broadcast from a supported device and invite viewers to participate through live chat and community features.',
      'Streaming quality and latency depend on your device, browser, network connection, and broadcast setup. MaiTroll supports browser-based access, with compatible mobile and desktop experiences so creators can choose a setup that works for them.',
      'Creators can explore audience engagement, broadcast careers, and platform monetization features. Availability and eligibility vary by feature and account status.',
    ],
  },
  '/features/social-media': {
    title: 'Social Media Platform and Virtual Community | MaiTroll',
    description: 'Discover MaiTroll’s social media platform, with creator profiles, live chat, short-form video, community spaces, and interactive virtual city features.',
    body: [
      'MaiTroll combines social media features with a persistent virtual community. Members can discover creators, watch live broadcasts, share short-form videos, and communicate through community and chat features.',
      'The virtual city includes civic-style systems such as city laws and an elected president, alongside events and community spaces. These digital experiences are designed to make participation more interactive than a conventional social feed.',
      'Explore public profiles and broadcasts, connect with other members, and learn about the features available in the MaiTroll community.',
    ],
  },
};

function makeSEOBody(title, paragraphs, links = []) {
  const text = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const linkMarkup = links.map(({ href, label }) =>
    `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`
  ).join('');
  return `<main><h1>${escapeHtml(title)}</h1>${text}${linkMarkup ? `<ul>${linkMarkup}</ul>` : ''}</main>`;
}

function replaceMetaTag(html, selector, tag) {
  return html.replace(selector, tag);
}

async function renderSeoIndex(req, res, next) {
  if (!process.argv.includes('--render')) return next();
  const pathname = req.path || '/';
  if (pathname.startsWith('/api/') || /\.[a-z0-9]{1,12}$/i.test(pathname)) return next();

  let title;
  let description;
  let canonicalPath = pathname;
  let bodyHtml;
  let statusCode = 200;

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  const pageMetadata = SEO_PAGE_METADATA[normalizedPath];
  if (pageMetadata) {
    ({ title, description, body: bodyHtml } = pageMetadata);
    canonicalPath = pageMetadata.canonicalPath || normalizedPath;
    if (!bodyHtml) {
      bodyHtml = makeSEOBody('Terms of Service', [
        'Review the MaiTroll Terms of Service for information about using the website, applications, community, broadcasts, and related platform features.',
        'For questions about these terms, contact the MaiTroll support team.',
      ]);
    }
  }

  const profileMatch = normalizedPath.match(/^\/profile\/([a-zA-Z0-9_-]{2,30})$/);
  const liveMatch = normalizedPath.match(/^\/live\/([a-zA-Z0-9_-]{2,30})$/);
  const reservedProfileNames = new Set(['id', 'settings', 'setup', 'delete', 'privacy-settings']);
  if (!title && profileMatch && !reservedProfileNames.has(profileMatch[1].toLowerCase())) {
    let username;
    try {
      username = decodeURIComponent(profileMatch[1]);
    } catch {
      username = profileMatch[1];
    }
    title = `${username} (@${username}) | MaiTroll`;
    description = `View ${username}'s profile on MaiTroll, connect with the creator, and discover their public posts and broadcasts.`;
    bodyHtml = makeSEOBody(title, [description], [{ href: '/explore', label: 'Explore MaiTroll' }]);
  } else if (!title && liveMatch && !['command-center', 'overlay'].includes(liveMatch[1].toLowerCase())) {
    const username = liveMatch[1];
    title = `${username} is Live | MaiTroll`;
    description = `Watch ${username} live on MaiTroll, join the conversation, and explore more creator broadcasts.`;
    bodyHtml = makeSEOBody(title, [description], [{ href: `/profile/${encodeURIComponent(username)}`, label: `View ${username}'s profile` }]);
  }

  const contentPathMatch = normalizedPath.match(/^\/(blog|updates)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i);
  const listPathMatch = normalizedPath.match(/^\/(blog|updates)$/);
  const postType = contentPathMatch ? (contentPathMatch[1] === 'blog' ? 'blog' : 'update') : null;
  const collectionType = listPathMatch ? (listPathMatch[1] === 'blog' ? 'blog' : 'update') : null;

  try {
    if (postType) {
      const post = await getSiteUpdateBySlug(contentPathMatch[2], postType);
      if (post) {
        title = `${post.title} | MaiTroll`;
        description = post.summary;
        const paragraphs = post.content.split(/\r?\n+/).filter(Boolean);
        if (postType === 'update') paragraphs.unshift('Posted by CEO of Mai Corp');
        bodyHtml = makeSEOBody(post.title, paragraphs, [
          { href: `/${postType === 'blog' ? 'blog' : 'updates'}`, label: `More ${postType === 'blog' ? 'articles' : 'updates'}` },
        ]);
      } else {
        title = 'Page Not Found | MaiTroll';
        description = 'This MaiTroll article or update could not be found.';
        bodyHtml = makeSEOBody('Page Not Found', [description], [{ href: postType === 'blog' ? '/blog' : '/updates', label: 'Browse recent posts' }]);
        statusCode = 404;
      }
    } else if (collectionType) {
      title = collectionType === 'blog' ? 'MaiTroll Blog | Creator Broadcasting and Community' : 'MaiTroll Updates | News and Feature Releases';
      description = collectionType === 'blog'
        ? 'Read MaiTroll articles about live broadcasting, creator tools, social media, and virtual communities.'
        : 'Read the latest public MaiTroll product updates, feature announcements, and platform news from the CEO of Mai Corp.';
      const { data: posts, error } = supabase
        ? await supabase.from('site_updates').select(SITE_UPDATE_COLUMNS).eq('is_published', true).eq('post_type', collectionType).order('published_at', { ascending: false }).limit(50)
        : { data: [], error: null };
      if (error) throw error;
      const postLinks = (posts || []).map((post) => ({
        href: `/${collectionType === 'blog' ? 'blog' : 'updates'}/${encodeURIComponent(post.slug)}`,
        label: post.title,
      }));
      bodyHtml = makeSEOBody(
        collectionType === 'blog' ? 'MaiTroll Blog' : 'MaiTroll Updates',
        [description],
        postLinks,
      );
    }
  } catch (error) {
    console.error('[SEOHTML] Failed to load published content:', error);
    return res.status(500).send('Unable to render this page right now');
  }

  const distDirectory = path.join(__dirname, '../dist');
  try {
    let html = await fs.readFile(path.join(distDirectory, 'index.html'), 'utf8');
    const pageUrl = new URL(canonicalPath, APP_URL).toString();
    if (!title) {
      title = 'MaiTroll | The Live Broadcasting App & Social Media Network';
      description = 'MaiTroll is a new live broadcasting app and social media platform built for creators. Stream games instantly, build a broadcast career with daily cashouts, and engage with an interactive virtual community.';
    }

    html = replaceMetaTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = replaceMetaTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = replaceMetaTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = replaceMetaTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = replaceMetaTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    const noindexPathPrefixes = ['/admin', '/account', '/settings', '/wallet', '/profile/settings', '/profile/setup', '/profile/delete'];
    if (noindexPathPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
      html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow" />\n  </head>');
    }
    if (bodyHtml) html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
    return res.status(statusCode).type('html').send(html);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(503).send('The production site has not been built yet. Run npm run build before starting the render server.');
    }
    console.error('[SEOHTML] Failed to render SPA entry:', error);
    return next(error);
  }
}

if (process.argv.includes('--render')) {
  app.use(express.static(path.join(__dirname, '../dist'), { index: false, maxAge: '1h' }));
  app.get(/^\/([A-Za-z0-9_-]+)\.txt$/, (req, res, next) => {
    if (process.env.INDEXNOW_KEY && req.params[0] === process.env.INDEXNOW_KEY) {
      return res.type('text/plain').send(process.env.INDEXNOW_KEY);
    }
    return next();
  });
  app.get('*', renderSeoIndex);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: GET http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  process.exit(1);
});
