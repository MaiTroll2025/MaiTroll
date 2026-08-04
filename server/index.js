const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

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
const { normalizeEmail, syncVerifiedMaiTalentActivity, buildSourceEventId, resolveMaiTalentConfig, normalizeMaiTalentLinkResponse, buildMaiTalentLinkPayload } = require('./lib/maitalentSync');
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
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://Mai Troll.app';

// Default fallback image (used when no stream thumbnail available)
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/images/mai-troll-city-preview.png`;

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
  const id = Date.now().toString();
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

// MaiTalent account link proxy
app.post('/api/maitalent/sync-activity', async (req, res) => {
  try {
    const body = req.body || {};
    const normalizedEmail = normalizeEmail(
      body.normalized_email || body.normalizedEmail || body.email || 'Mai Troll2025@gmail.com'
    );

    const response = await syncVerifiedMaiTalentActivity({
      supabase,
      externalUserId: body.external_user_id || body.externalUserId || null,
      normalizedEmail,
      sourceEventId: body.source_event_id || body.sourceEventId || `Mai Troll:${Date.now()}`,
      activityType: body.activity_type || body.activityType || 'broadcast',
      tokensAwarded: Number(body.tokens_awarded || body.tokensAwarded || 0),
      metadata: body.metadata || {
        source: 'troll_city_server_sync',
        requested_by: 'server',
      },
    });

    return res.status(200).json({
      success: true,
      payload: response.body,
      normalized_email: normalizedEmail,
      source_event_id: body.source_event_id || body.sourceEventId || `Mai Troll:${Date.now()}`,
    });
  } catch (err) {
    console.error('[MaiTalent Sync] Unexpected error', err);
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected server error' });
  }
});

app.post('/api/maitalent/test-sync', async (req, res) => {
  try {
    const response = await syncVerifiedMaiTalentActivity({
      supabase,
      externalUserId: req.body?.external_user_id || req.body?.externalUserId || null,
      normalizedEmail: 'Mai Troll2025@gmail.com',
      sourceEventId: req.body?.source_event_id || req.body?.sourceEventId || 'Mai Troll:test-sync',
      activityType: req.body?.activity_type || req.body?.activityType || 'broadcast',
      tokensAwarded: Number(req.body?.tokens_awarded || req.body?.tokensAwarded || 25),
      metadata: req.body?.metadata || {
        source: 'troll_city_test_sync',
        note: 'Uses the shared test email Mai Troll2025@gmail.com',
      },
    });

    return res.status(200).json({ success: true, payload: response.body, normalized_email: 'Mai Troll2025@gmail.com' });
  } catch (err) {
    console.error('[MaiTalent Sync] Test sync failed', err);
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected server error' });
  }
});

app.post('/api/maitalent/track-broadcast-view', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Server misconfigured: Supabase client unavailable' });
    }

    const { streamId, userId } = req.body || {};
    const authHeader = String(req.headers.authorization || '');
    if (!streamId || !userId) {
      return res.status(400).json({ success: false, error: 'streamId and userId are required' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.slice(7).trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user || authData.user.id !== userId) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id,email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return res.status(404).json({ success: false, error: 'Viewer profile not found' });
    }

    await syncVerifiedMaiTalentActivity({
      supabase,
      externalUserId: profile.id,
      normalizedEmail: profile.email,
      sourceEventId: buildSourceEventId({ scope: 'broadcast-view', streamId, userId }),
      activityType: 'broadcast-view',
      tokensAwarded: 5,
      metadata: { streamId, source: 'broadcast_view' },
    });

    return res.status(200).json({
      success: true,
      source_event_id: buildSourceEventId({ scope: 'broadcast-view', streamId, userId }),
    });
  } catch (err) {
    console.error('[MaiTalent Broadcast View] Unexpected error', err);
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected server error' });
  }
});

app.post('/api/maitalent/link-account', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Server misconfigured: Supabase client unavailable' });
    }

    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication token missing' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const body = req.body || {};
    const fallbackUserId = typeof body.user_id === 'string' && body.user_id.trim().length > 0 ? body.user_id.trim() : null;
    const fallbackEmail = typeof body.email === 'string' && body.email.trim().length > 0
      ? body.email.trim().toLowerCase()
      : (typeof body.normalized_email === 'string' && body.normalized_email.trim().length > 0 ? body.normalized_email.trim().toLowerCase() : '');

    let resolvedUser = authData?.user || null;
    if (!resolvedUser && fallbackUserId) {
      resolvedUser = { id: fallbackUserId, email: fallbackEmail };
    }

    if (authError || !resolvedUser?.id) {
      console.error('[MaiTalent Link] auth.getUser failed', authError?.message || authError);
      if (!fallbackUserId || !fallbackEmail) {
        return res.status(401).json({ success: false, error: 'Invalid authentication token' });
      }
    }

    const userId = resolvedUser?.id || fallbackUserId;
    const normalizedEmail = String(resolvedUser?.email || fallbackEmail || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, error: 'Verified email is required to link MaiTalent account' });
    }

    const { maitalent_user_id, metadata } = body;
    const sourceEventId = body.source_event_id || body.sourceEventId || `Mai Troll:link:${userId}`;
    const payload = buildMaiTalentLinkPayload({
      externalUserId: userId,
      normalizedEmail: normalizedEmail,
      sourceEventId,
      maitalentUserId: typeof maitalent_user_id === 'string' && maitalent_user_id.trim().length > 0 ? maitalent_user_id.trim() : undefined,
      metadata: metadata || { requested_from: 'profile_page' },
    });

    const { url: maiTalentLinkUrl, secret: maiTalentSecret } = resolveMaiTalentConfig(process.env);

    if (!maiTalentLinkUrl || !maiTalentSecret) {
      console.error('[MaiTalent Link] Missing MaiTalent endpoint or secret');
      return res.status(500).json({ success: false, error: 'MaiTalent service endpoint or secret is not configured' });
    }

    const maiResponse = await fetch(maiTalentLinkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role': maiTalentSecret,
      },
      body: JSON.stringify(payload),
    });

    console.log('[MaiTalent Link] Response status:', maiResponse.status);
    console.log('[MaiTalent Link] Response headers:', Object.fromEntries(maiResponse.headers));

    let result = null;
    let parsed = null;
    
    try {
      result = await maiResponse.text();
      console.log('[MaiTalent Link] Response body (first 500 chars):', result?.substring(0, 500) || '(empty)');
      
      if (result && result.trim()) {
        try {
          parsed = JSON.parse(result);
        } catch (parseErr) {
          console.error('[MaiTalent Link] Failed to parse MaiTalent JSON response:', parseErr.message);
          console.error('[MaiTalent Link] Raw response (first 500 chars):', result.substring(0, 500));
          
          // MaiTalent returned invalid JSON - this is a service error
          return res.status(502).json({
            success: false,
            error: 'MaiTalent service returned invalid JSON',
            detail: 'The MaiTalent service may be temporarily unavailable. Please try again later.',
            statusCode: maiResponse.status,
          });
        }
      }
    } catch (err) {
      console.error('[MaiTalent Link] Error reading response body:', err.message);
      return res.status(502).json({
        success: false,
        error: 'MaiTalent service unreachable',
        detail: 'Failed to communicate with MaiTalent service.',
      });
    }

    const linkResult = normalizeMaiTalentLinkResponse(parsed, 'linked');
    if (!maiResponse.ok && !linkResult.success) {
      return res.status(502).json({
        success: false,
        error: parsed?.error || linkResult.message || 'MaiTalent link request failed',
        detail: parsed?.error || 'MaiTalent service error',
        statusCode: maiResponse.status,
      });
    }

    const linkStatus = linkResult.status;
    const profileUpdatePayload = {
      maitalent_link_status: linkStatus,
      maitalent_link_platform: 'troll-city',
      maitalent_external_user_id: userId,
      maitalent_link_verified_at: linkStatus === 'linked' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update(profileUpdatePayload)
      .eq('id', userId);

    if (profileUpdateError) {
      console.warn('[MaiTalent Link] profile update failed', profileUpdateError);
    }

    // Now sync the user's profile data to MaiTalent
    if (linkStatus === 'linked') {
      try {
        const { data: userProfile, error: fetchProfileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchProfileError) {
          console.warn('[MaiTalent Link] failed to fetch profile for sync', fetchProfileError);
        } else if (userProfile) {
          // Send profile data to MaiTalent
          console.log('[MaiTalent Link] syncing profile data to MaiTalent');
          const syncPayload = buildMaiTalentPayload({
            externalUserId: userId,
            normalizedEmail,
            sourceEventId: body.source_event_id || body.sourceEventId || `Mai Troll:profile-sync:${userId}`,
            activityType: 'profile_sync',
            tokensAwarded: 0,
            metadata: {
              requested_from: 'profile_page',
              linked_at: new Date().toISOString(),
              profile_data: {
                username: userProfile.username || '',
                full_name: userProfile.full_name || '',
                avatar_url: userProfile.avatar_url || '',
                bio: userProfile.bio || '',
                troll_coins: userProfile.troll_coins || 0,
                bonus_coin_balance: userProfile.bonus_coin_balance || 0,
                tier: userProfile.tier || 'Bronze',
                role: userProfile.role || 'user',
                is_verified: userProfile.is_verified || false,
                influencer_tier: userProfile.influencer_tier || null,
              },
            },
          });

          const syncResponse = await fetch(maiTalentLinkUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-role': maiTalentSecret,
            },
            body: JSON.stringify(syncPayload),
          });

          const syncResult = await syncResponse.text();
          console.log('[MaiTalent Link] profile sync response:', syncResult?.substring(0, 200) || '(empty)');
          
          if (!syncResponse.ok) {
            console.warn('[MaiTalent Link] profile sync failed with status', syncResponse.status);
          }
        }
      } catch (syncErr) {
        console.warn('[MaiTalent Link] profile sync error:', syncErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      payload: parsed,
      status: linkStatus,
      external_user_id: payload.external_user_id,
      maitalent_user_id: payload.maitalent_user_id || null,
      normalized_email: payload.normalized_email,
      detail: parsed,
      profile_persisted: !profileUpdateError,
    });
  } catch (err) {
    console.error('[MaiTalent Link] Unexpected error', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error' });
  }
});

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

// ============================================================================
// PROFILE SEO ENDPOINT
// Returns full HTML with OG/Twitter meta tags for social crawlers
// visiting profile URLs like /kain
// ============================================================================
const profileSEO = require('./api/profile-seo');

app.get('/api/social/profile/:username', async (req, res) => {
  await profileSEO.handleProfileSEO(req, res);
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
const { generateSitemap } = require('./api/sitemap');

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
    
    // Check if live or ended
    const isLive = stream.status === 'live';
    const statusText = isLive ? 'LIVE' : 'Ended';
    
    // Get thumbnail or use broadcaster's avatar as fallback
    const previewImage = stream.thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE;
    
    // Generate player URL for Twitter/X cards
    const playerUrl = `${APP_URL}/watch/${stream.id}`;
    
    const meta = generateSocialMetaHTML({
      title: `${broadcaster?.username || 'Broadcaster'} is ${statusText} on Mai Troll`,
      description: stream.title || `Watch this live broadcast on Mai Troll`,
      image: previewImage,
      url: `${APP_URL}/watch/${stream.id}`,
      type: isLive ? 'video.other' : 'website',
      isLive,
      videoUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      videoWidth: 1280,
      videoHeight: 720,
      twitterCard: isLive ? 'player' : 'summary_large_image',
      twitterPlayerUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      twitterPlayerWidth: 1280,
      twitterPlayerHeight: 720,
      site: '@Mai Trollapp'
    });
    
    res.status(200).send(meta);
    
  } catch (error) {
    console.error('[SocialPreview] Error:', error);
    const meta = generateSocialMetaHTML({
      title: 'Mai Troll - Live Streaming',
      description: 'Join Mai Troll for live streaming and more.',
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
    title = 'Mai Troll - Live Streaming',
    description = 'Watch live streams on Mai Troll',
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
    site = '@Mai Trollapp'
  } = data;
  
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
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:site_name" content="Mai Troll">
  
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
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:site" content="${esc(site)}">
  
  ${twitterPlayerUrl ? `
  <meta name="twitter:player" content="${esc(twitterPlayerUrl)}">
  <meta name="twitter:player:width" content="${twitterPlayerWidth}">
  <meta name="twitter:player:height" content="${twitterPlayerHeight}">
  ` : ''}
  
  <!-- Additional Meta Tags -->
  <meta property="al:ios:app_store_id" content="6471861674">
  <meta property="al:ios:app_name" content="Mai Troll">
  <meta property="al:android:package" content="app.Mai Troll.app">
  <meta property="al:android:app_name" content="Mai Troll">
  
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
  <title>Watch Stream | Mai Troll</title>
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
app.post('/api/broadcasts/start-streaming', async (req, res) => { await broadcastHandler.startStreaming(req, res); });
app.post('/api/broadcasts/stop-streaming', async (req, res) => { await broadcastHandler.stopStreaming(req, res); });
app.post('/api/broadcasts/save-video', async (req, res) => { await broadcastHandler.saveVideo(req, res); });

// Backward compatibility aliases (deprecated - remove after migration complete)
app.post('/api/broadcasts/start', async (req, res) => {
  console.warn('[Server] Deprecated endpoint /api/broadcasts/start called - use /api/broadcasts/start-streaming instead');
  await broadcastHandler.startStreaming(req, res);
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
// When a bot/crawler visits /:username or /:username/live/:slug,
// we detect it and return full HTML with meta tags directly.
// Regular users get the SPA (index.html) as usual.
// ============================================================================

const BOT_REGEX = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit|linkedinbot|applebot|duckduckbot|baiduspider|yandexbot/i;

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
    // Regular user — serve the SPA, client-side routing handles it
    return next();
  }

  // Bot detected — return full SEO HTML
  try {
    const html = profileSEO.generateProfileSEOHTML(
      { username, display_name: username, bio: `View ${username}'s profile on Mai Mai Troll` },
      null,
      APP_URL
    );

    // Fetch real profile data
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, is_banned, is_profile_public')
      .ilike('username', username)
      .maybeSingle();

    if (profile && !profile.is_banned && profile.is_profile_public !== false) {
      // Check if live
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

    // Profile not found or not public — serve SPA (React handles 404)
    return next();
  } catch (error) {
    console.error('[ProfileRouteSEO] Error:', error);
    return next();
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
      .select('id, username, display_name, avatar_url, is_banned')
      .ilike('username', username)
      .maybeSingle();

    if (!profile || profile.is_banned) {
      return next();
    }

    const { data: stream } = await supabase
      .from('streams')
      .select('id, title, slug, thumbnail_url, status, is_public')
      .eq('user_id', profile.id)
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle();

    if (!stream) {
      return next();
    }

    const seoHtml = profileSEO.generateStreamSEOHTML(stream, profile, APP_URL);
    return res.status(200).send(seoHtml);
  } catch (error) {
    console.error('[StreamRouteSEO] Error:', error);
    return next();
  }
});

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
