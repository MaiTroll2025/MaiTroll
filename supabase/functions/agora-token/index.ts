import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@^2.0.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const authSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Reject unauthenticated callers. Returns the authenticated user or a 401 Response. */
async function requireAuth(req: Request): Promise<{ user: { id: string } | null; error: Response | null }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { user: null, error: withCors({ error: "Missing authorization token" }, 401, req) };
  }
  const { data: { user }, error: authError } = await authSupabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, error: withCors({ error: "Unauthorized" }, 401, req) };
  }
  return { user: { id: user.id }, error: null };
}

/**
 * Agora Token Generator
 * Generates RTC tokens for Agora video meetings using official Agora token builder
 */

function generateAgoraToken(params: {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: string | number;
  role?: 'publisher' | 'subscriber' | 'audience';
  expiration?: number;
}): { token: string; uid: string | number } {
  const {
    appId,
    appCertificate,
    channelName,
    uid,
    role = 'subscriber',
    expiration = 3600
  } = params;

  // CRITICAL: Agora requires the token UID to match the type used when joining
  // the channel. The auction clients join with a NUMERIC uid (makeAgoraUid),
  // so we must build the token with a numeric uid. Mismatched uid types cause
  // "CAN_NOT_GET_GATEWAY_SERVER" / permanent "Waiting for Agora".
  // If no valid numeric uid is provided, use the 0 (UINT) special value which
  // Agora treats as "any uid" for token generation.
  let numericUid: number
  if (typeof uid === 'number' && Number.isFinite(uid)) {
    numericUid = Math.max(0, Math.min(Math.floor(uid), 4294967294))
  } else {
    const parsed = Number(uid)
    numericUid = Number.isFinite(parsed) && String(uid).trim() !== '' ? Math.max(0, Math.min(Math.floor(parsed), 4294967294)) : 0
  }

  // Map the client-facing role onto an Agora RtcRole. Both 'subscriber' and
  // 'audience' mean a viewer that may only receive media.
  const agoraRole =
    role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      agoraRole,
      expiration
    );

    return { token, uid: numericUid }
  } catch (error) {
    console.error('[agora-token] Error generating token:', error);
    throw error;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const body = await req.json();

    const channelName = body.channelName || body.channel || 'staff_meeting';
    const userIdStr = String(body.userId || body.user_id || body.uid || '0');
    const uid = userIdStr;
    const publicCourtSessionId = body.roomType === 'court' &&
      body.role === 'audience' &&
      typeof body.courtSessionId === 'string'
      ? body.courtSessionId
      : null;
    const publicPodcastId = body.roomType === 'podcast' &&
      body.role === 'subscriber' &&
      typeof body.podcastId === 'string'
      ? body.podcastId
      : null;
    const publicGamingStreamId = body.roomType === 'gaming' &&
      body.role === 'subscriber' &&
      typeof body.streamId === 'string'
      ? body.streamId
      : null;

    if (publicCourtSessionId) {
      const { data: session, error: sessionError } = await authSupabase
        .from('court_sessions')
        .select('id, status, is_public')
        .eq('id', publicCourtSessionId)
        .maybeSingle();

      if (sessionError) {
        console.error('[agora-token] Public court session lookup failed:', sessionError);
        return withCors({ error: 'Unable to verify public court session' }, 500, req);
      }
      if (
        !session ||
        session.is_public !== true ||
        !['active', 'live'].includes(String(session.status).toLowerCase()) ||
        channelName !== `troll-court-${session.id}`
      ) {
        return withCors({ error: 'Court session is not publicly available' }, 403, req);
      }
    } else if (publicPodcastId) {
      const { data: podcast, error: podcastError } = await authSupabase
        .from('podcasts')
        .select('id, status, agora_channel_name')
        .eq('id', publicPodcastId)
        .maybeSingle();

      if (podcastError) {
        console.error('[agora-token] Public podcast lookup failed:', podcastError);
        return withCors({ error: 'Unable to verify public podcast' }, 500, req);
      }
      if (
        !podcast ||
        !['live', 'active'].includes(String(podcast.status).toLowerCase()) ||
        channelName !== podcast.agora_channel_name
      ) {
        return withCors({ error: 'Podcast is not publicly available' }, 403, req);
      }
    } else if (publicGamingStreamId) {
      const { data: stream, error: streamError } = await authSupabase
        .from('streams')
        .select('id, category, status, is_live, audience_type, is_private, is_paid, pricing_type, agora_channel')
        .eq('id', publicGamingStreamId)
        .maybeSingle();

      if (streamError) {
        console.error('[agora-token] Public gaming stream lookup failed:', streamError);
        return withCors({ error: 'Unable to verify public gaming stream' }, 500, req);
      }
      if (
        !stream ||
        String(stream.category || '').toLowerCase() !== 'gaming' ||
        !(stream.is_live === true || String(stream.status || '').toLowerCase() === 'live') ||
        String(stream.audience_type || '').toLowerCase() !== 'public' ||
        stream.is_private === true ||
        stream.is_paid === true ||
        String(stream.pricing_type || '').toLowerCase() === 'paid' ||
        channelName !== (stream.agora_channel || stream.id)
      ) {
        return withCors({ error: 'Gaming stream is not publicly available' }, 403, req);
      }
    } else {
      const { error: authError } = await requireAuth(req);
      if (authError) return authError;
    }

    // Accept 'audience' (auction viewer) and map it to subscriber.
    const role: 'publisher' | 'subscriber' | 'audience' =
      body.role === 'publisher' ? 'publisher' : 'subscriber';
    const podcastId = body.podcastId || null;

    const appId = Deno.env.get('VITE_AGORA_APP_ID') || Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('VITE_AGORA_APP_CERTIFICATE') || Deno.env.get('AGORA_APP_CERTIFICATE');

    // Guard: Check for missing environment variables
    if (!appId || !appCertificate) {
      console.error('[agora-token] Agora credentials NOT configured:', {
        hasAppId: !!appId,
        hasCertificate: !!appCertificate
      });

      return withCors({
        error: 'Agora credentials not configured',
        hint: 'Set VITE_AGORA_APP_ID and VITE_AGORA_APP_CERTIFICATE in Supabase environment',
        appId: appId ? 'set' : 'missing',
        certificate: appCertificate ? 'set' : 'missing'
      }, 500, req);
    }

    console.log('[agora-token] Generating token:', {
      channel: channelName,
      uid: uid,
      appId: appId.substring(0, 8) + '...',
      role: role,
      podcastId: podcastId ? podcastId.substring(0, 8) + '...' : null
    });

    const { token, uid: resolvedUid } = generateAgoraToken({
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      expiration: 3600
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    console.log('[agora-token] ✅ Token generated successfully');

    return withCors({
      token,
      appId,
      channelName,
      uid: resolvedUid,
      expiresAt,
      podcastId
    }, 200, req);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[agora-token] ❌ Error:', message);
    // Surface a clear, actionable error instead of an opaque failure that leaves
    // viewers stuck on "Waiting for Agora".
    const isConfig = /app id|app certificate|certificate|invalid signing|token/i.test(message);
    return withCors({
      error: isConfig ? 'Agora token service misconfigured' : 'Failed to generate Agora token',
      details: message
    }, 500, req);
  }
});
