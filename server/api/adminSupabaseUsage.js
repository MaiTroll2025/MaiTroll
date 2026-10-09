const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const rateLimitStore = new Map();

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

function unavailable(res) {
  return res.status(503).json({
    code: 'USAGE_SOURCE_UNAVAILABLE',
    error: 'Live Supabase usage metrics are not configured for this deployment. No usage figures or historical snapshots are being fabricated.',
  });
}

async function getSummary(_req, res) {
  return unavailable(res);
}

async function getBreakdown(_req, res) {
  return unavailable(res);
}

async function getHistorical(_req, res) {
  return unavailable(res);
}

async function refreshSnapshot(_req, res) {
  return unavailable(res);
}

module.exports = {
  enforceRateLimit,
  verifyAdmin,
  getSummary,
  getBreakdown,
  getHistorical,
  refreshSnapshot,
};
