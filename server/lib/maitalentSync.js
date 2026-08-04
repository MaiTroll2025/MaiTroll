const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function buildSourceEventId({ scope, streamId, userId }) {
  const normalizedScope = typeof scope === 'string' && scope.trim() ? scope.trim() : 'broadcast';
  const normalizedStreamId = typeof streamId === 'string' && streamId.trim() ? streamId.trim() : 'unknown';
  const normalizedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'unknown';
  return `Mai Troll:${normalizedScope}:${normalizedStreamId}:${normalizedUserId}`;
}

function resolveMaiTalentConfig(env = process.env) {
  return {
    url: env.MAITALENT_LINK_URL || env.MAITALENT_SYNC_URL || env.MAITALENT_SYNC_ENDPOINT || env.MAITALENT_LINK_ENDPOINT || '',
    secret: env.MAITALENT_LINK_SECRET || env.MAITALENT_SYNC_SECRET || env.MAITALENT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function buildMaiTalentPayload({
  externalUserId,
  normalizedEmail,
  sourceEventId,
  activityType,
  tokensAwarded,
  metadata,
}) {
  const email = normalizeEmail(normalizedEmail);

  return {
    action: 'sync',
    external_platform: 'troll-city',
    external_user_id: externalUserId,
    source_event_id: sourceEventId,
    activity_type: activityType,
    tokens_awarded: tokensAwarded,
    normalized_email: email,
    metadata: metadata || {},
  };
}

function buildMaiTalentLinkPayload({
  externalUserId,
  normalizedEmail,
  sourceEventId,
  maitalentUserId,
  metadata,
}) {
  const email = normalizeEmail(normalizedEmail);

  return {
    action: 'link',
    external_platform: 'troll-city',
    external_user_id: externalUserId,
    normalized_email: email,
    source_event_id: sourceEventId,
    maitalent_user_id: maitalentUserId,
    metadata: metadata || {},
  };
}

function normalizeMaiTalentLinkResponse(responseBody, fallbackStatus = 'linked') {
  if (responseBody === null || responseBody === undefined) {
    return { success: true, status: fallbackStatus, detail: null, message: '' };
  }

  if (typeof responseBody === 'string') {
    const trimmed = responseBody.trim();
    if (!trimmed) {
      return { success: true, status: fallbackStatus, detail: responseBody, message: '' };
    }

    return {
      success: ['linked', 'review', 'flagged', 'pending', 'success'].includes(trimmed.toLowerCase()),
      status: trimmed.toLowerCase(),
      detail: responseBody,
      message: trimmed,
    };
  }

  const payload = responseBody && typeof responseBody === 'object' ? responseBody : {};
  const statusValue = typeof payload.status === 'string' && payload.status.trim()
    ? payload.status.trim().toLowerCase()
    : (payload.linked === true ? 'linked' : fallbackStatus);

  const success = Boolean(
    payload.success === true ||
    payload.linked === true ||
    ['linked', 'review', 'flagged', 'pending', 'success'].includes(statusValue)
  );

  return {
    success,
    status: statusValue,
    detail: payload,
    message: typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : '',
  };
}

function postJson({ url, headers, body }) {
  const payload = JSON.stringify(body);
  const parsedUrl = new URL(url);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsedBody = null;
          try {
            parsedBody = data ? JSON.parse(data) : null;
          } catch (error) {
            parsedBody = data;
          }

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body: parsedBody });
            return;
          }

          reject(new Error(`MaiTalent sync failed with ${res.statusCode}: ${data}`));
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function resolveMai TrollUser({ supabase, externalUserId, normalizedEmail }) {
  if (externalUserId) {
    return externalUserId;
  }

  const email = normalizeEmail(normalizedEmail);
  if (!supabase || !email) {
    throw new Error('A Supabase client and a normalized email are required to resolve the Mai Troll user');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    return data.id;
  }

  try {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      throw usersError;
    }

    const matchedUser = usersData?.users?.find((user) => normalizeEmail(user.email) === email);
    if (matchedUser?.id) {
      return matchedUser.id;
    }
  } catch (lookupError) {
    console.warn('[MaiTalent Sync] Fallback user lookup failed', lookupError);
  }

  throw new Error(`Mai Troll user not found for ${email}`);
}

async function syncVerifiedMaiTalentActivity({
  supabase,
  externalUserId,
  normalizedEmail,
  sourceEventId,
  activityType,
  tokensAwarded,
  metadata,
  maitalentSyncUrl,
  maitalentServiceRoleKey,
  logger = console,
}) {
  const resolvedSupabase = supabase || createClient(
    process.env.Mai Troll_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.Mai Troll_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const email = normalizeEmail(normalizedEmail || 'Mai Troll2025@gmail.com');
  const resolvedExternalUserId = await resolveMai TrollUser({
    supabase: resolvedSupabase,
    externalUserId,
    normalizedEmail: email,
  });

  if (!sourceEventId || !activityType || !email) {
    throw new Error('Missing required sync fields');
  }

  const payload = buildMaiTalentPayload({
    externalUserId: resolvedExternalUserId,
    normalizedEmail: email,
    sourceEventId,
    activityType,
    tokensAwarded,
    metadata,
  });

  const config = resolveMaiTalentConfig(process.env);
  const resolvedSyncUrl = maitalentSyncUrl || config.url;
  const resolvedSecret = maitalentServiceRoleKey || config.secret;

  if (!resolvedSyncUrl || !resolvedSecret) {
    throw new Error('MaiTalent sync environment is not configured');
  }

  const response = await postJson({
    url: resolvedSyncUrl,
headers: {
      'Authorization': `Bearer ${resolvedSecret}`,
    },
    body: payload,
  });

  logger.info?.('[MaiTalent Sync] Verified activity forwarded', {
    sourceEventId,
    activityType,
    externalUserId: resolvedExternalUserId,
    normalizedEmail: email,
    tokensAwarded,
  });

  return response;
}

module.exports = {
  normalizeEmail,
  buildSourceEventId,
  resolveMaiTalentConfig,
  buildMaiTalentPayload,
  buildMaiTalentLinkPayload,
  normalizeMaiTalentLinkResponse,
  syncVerifiedMaiTalentActivity,
};
