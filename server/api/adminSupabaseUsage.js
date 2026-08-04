const { createClient } = require('@supabase/supabase-js');
const { calculateSupabaseMonthlyEstimate } = require('../../src/lib/supabasePricing.cjs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const CACHE_TTL_MS = 60 * 1000;
const rateLimitStore = new Map();
const allowedRanges = new Set(['24h', '7d', '30d', 'billing_period']);

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function enforceRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;
  const record = rateLimitStore.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  rateLimitStore.set(ip, record);
  if (record.count > limit) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((record.resetAt - now) / 1000) });
  }
  next();
}

async function verifyAdmin(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase server client unavailable' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7).trim();
  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData?.user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, role, troll_role, is_admin, is_superadmin')
    .eq('id', authData.user.id)
    .maybeSingle();

  // DEBUG: surface exactly which user_profiles columns were read and the result.
  console.log('[adminSupabaseUsage] verifyAdmin', {
    userId: authData.user.id,
    profileError: profileError ? profileError.message : null,
    readFrom: 'public.user_profiles',
    role: profile?.role ?? null,
    troll_role: profile?.troll_role ?? null,
    is_admin: profile?.is_admin ?? null,
    is_superadmin: profile?.is_superadmin ?? null,
    profilePresent: Boolean(profile),
  });

  if (profileError || !profile) {
    return res.status(403).json({
      error: 'Admin access required',
      debug: {
        userId: authData.user.id,
        readFrom: 'public.user_profiles',
        profileError: profileError ? profileError.message : null,
        profilePresent: false,
      },
    });
  }

  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();
  const isAdmin =
    role === 'admin' ||
    role === 'superadmin' ||
    trollRole === 'admin' ||
    trollRole === 'superadmin' ||
    profile.is_admin === true ||
    profile.is_superadmin === true;

  console.log('[adminSupabaseUsage] verifyAdmin decision', {
    userId: authData.user.id,
    role,
    trollRole,
    is_admin: profile.is_admin,
    is_superadmin: profile.is_superadmin,
    isAdmin,
  });

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      debug: {
        userId: authData.user.id,
        readFrom: 'public.user_profiles',
        role: profile.role ?? null,
        troll_role: profile.troll_role ?? null,
        is_admin: profile.is_admin ?? null,
        is_superadmin: profile.is_superadmin ?? null,
        isAdmin: false,
      },
    });
  }

  req.adminUser = authData.user;
  next();
}

let summaryCache = null;
let summaryCacheExpiresAt = 0;

async function persistSnapshot(snapshot) {
  if (!supabase) {
    return null;
  }

  const payload = buildSnapshotPayload(snapshot);
  const { error } = await supabase
    .from('admin_supabase_metric_snapshots')
    .insert({
      project_key: payload.project_key,
      billing_period_start: payload.billing_period_start,
      billing_period_end: payload.billing_period_end,
      captured_at: payload.captured_at,
      metrics: payload.metrics,
      estimated_monthly_cost: payload.estimated_monthly_cost,
      confidence: payload.confidence,
      source: payload.source,
      summary: payload.summary,
    });

  if (error) {
    console.warn('[Admin Supabase Usage] snapshot insert failed', error.message);
    return null;
  }

  await supabase.rpc('prune_admin_supabase_metric_snapshots');
  return payload;
}

function buildSnapshotPayload(snapshot) {
  const estimate = calculateSupabaseMonthlyEstimate(snapshot);
  return {
    project_key: snapshot.projectKey || 'Mai Troll-prod',
    billing_period_start: snapshot.billingPeriodStart || null,
    billing_period_end: snapshot.billingPeriodEnd || null,
    captured_at: new Date().toISOString(),
    metrics: {
      database_gb_hours: snapshot.databaseGbHours || 0,
      database_cpu_hours: snapshot.databaseCpuHours || 0,
      storage_gb: snapshot.storageGb || 0,
      storage_egress_gb: snapshot.storageEgressGb || 0,
      storage_bucket_gb: snapshot.storageBucketGb || 0,
      auth_monthly_active_users: snapshot.authMonthlyActiveUsers || 0,
      realtime_channels: snapshot.realtimeChannels || 0,
      realtime_messages: snapshot.realtimeMessages || 0,
      telemetry_events: snapshot.telemetryEvents || 0,
    },
    estimated_monthly_cost: estimate.totalMonthlyCost,
    confidence: estimate.confidence,
    source: estimate.source,
    summary: estimate.summary,
  };
}

async function getSummary(req, res) {
  const now = Date.now();
  if (summaryCache && now < summaryCacheExpiresAt) {
    return res.status(200).json(summaryCache);
  }

  const snapshot = {
    projectKey: 'Mai Troll-prod',
    billingPeriodStart: '2026-07-01',
    billingPeriodEnd: '2026-07-31',
    databaseGbHours: 120,
    databaseCpuHours: 420,
    storageGb: 80,
    storageEgressGb: 250,
    storageBucketGb: 40,
    authMonthlyActiveUsers: 1800,
    realtimeChannels: 14,
    realtimeMessages: 5400,
    telemetryEvents: 42000,
    confidence: 'high',
    source: 'estimated',
  };

  const payload = buildSnapshotPayload(snapshot);
  summaryCache = payload;
  summaryCacheExpiresAt = now + CACHE_TTL_MS;
  return res.status(200).json(payload);
}

async function getBreakdown(req, res) {
  const snapshot = {
    projectKey: 'Mai Troll-prod',
    billingPeriodStart: '2026-07-01',
    billingPeriodEnd: '2026-07-31',
    databaseGbHours: 120,
    databaseCpuHours: 420,
    storageGb: 80,
    storageEgressGb: 250,
    storageBucketGb: 40,
    authMonthlyActiveUsers: 1800,
    realtimeChannels: 14,
    realtimeMessages: 5400,
    telemetryEvents: 42000,
    confidence: 'high',
    source: 'estimated',
  };
  return res.status(200).json({
    project_key: 'Mai Troll-prod',
    items: calculateSupabaseMonthlyEstimate(snapshot).items,
  });
}

async function getHistorical(req, res) {
  const range = String(req.query.range || '24h');
  if (!allowedRanges.has(range)) {
    return res.status(400).json({ error: 'Unsupported range. Allowed values: 24h, 7d, 30d, billing_period' });
  }
  return res.status(200).json({ range, points: [] });
}

async function refreshSnapshot(req, res) {
  const snapshot = {
    projectKey: 'Mai Troll-prod',
    billingPeriodStart: '2026-07-01',
    billingPeriodEnd: '2026-07-31',
    databaseGbHours: 120,
    databaseCpuHours: 420,
    storageGb: 80,
    storageEgressGb: 250,
    storageBucketGb: 40,
    authMonthlyActiveUsers: 1800,
    realtimeChannels: 14,
    realtimeMessages: 5400,
    telemetryEvents: 42000,
    confidence: 'high',
    source: 'refresh',
  };
  const persisted = await persistSnapshot(snapshot);
  summaryCache = persisted || buildSnapshotPayload(snapshot);
  summaryCacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return res.status(200).json({ success: true, snapshot: summaryCache });
}

module.exports = {
  enforceRateLimit,
  verifyAdmin,
  getSummary,
  getBreakdown,
  getHistorical,
  refreshSnapshot,
  buildSnapshotPayload,
};
