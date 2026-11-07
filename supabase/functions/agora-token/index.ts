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

async function getAuthorizedUid(userId: string, channelName: string, clientUid: string): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(supabaseServiceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${userId}:${channelName}:${clientUid}`),
  );
  const hash = new DataView(signature).getUint32(0, false);
  return (hash % 4294967294) + 1;
}

function getAgoraUidHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 4294967295;
}

function getAnonymousUid(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % 4294967294) + 1;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const body = await req.json();

    const channelValue = body.channelName || body.channel || 'staff_meeting';
    if (typeof channelValue !== 'string' || channelValue.length > 128) {
      return withCors({ error: 'Invalid Agora channel' }, 400, req);
    }
    const channelName = channelValue;
    const userIdStr = String(body.userId || body.user_id || body.uid || '0');
    let uid: string | number = userIdStr;
    let role: 'publisher' | 'subscriber' | 'audience' =
      body.role === 'publisher' ? 'publisher' : 'subscriber';
    let publisherUids: { screen: number; camera: number } | null = null;
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
      uid = getAnonymousUid();
    } else if (publicPodcastId) {
      const { data: podcast, error: podcastError } = await authSupabase
        .from('podcasts')
        .select('id, agora_channel_name, status, is_live, is_published, visibility, metadata')
        .eq('id', publicPodcastId)
        .maybeSingle();

      if (podcastError) {
        console.error('[agora-token] Public podcast lookup failed:', podcastError);
        return withCors({ error: 'Unable to verify public podcast' }, 500, req);
      }
      const metadata = podcast?.metadata && typeof podcast.metadata === 'object'
        ? podcast.metadata as Record<string, unknown>
        : {};
      const podcastChannel = podcast?.agora_channel_name ?? metadata.agora_channel_name ?? metadata.channelName;
      if (
        !podcast ||
        !(podcast.is_live === true || ['live', 'active'].includes(String(podcast.status).toLowerCase())) ||
        !(podcast.is_published === true || podcast.visibility === 'public') ||
        typeof podcastChannel !== 'string' ||
        channelName !== podcastChannel
      ) {
        return withCors({ error: 'Podcast is not publicly available' }, 403, req);
      }
      uid = getAnonymousUid();
    } else if (publicGamingStreamId) {
      const { data: stream, error: streamError } = await authSupabase
        .from('streams')
        .select('id, category, status, is_live, audience_type, is_private, is_paid, pricing_type, agora_channel, stream_channel, owner_id, user_id, broadcaster_id, streamer_id, host_id')
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
        channelName !== (stream.agora_channel || stream.stream_channel || stream.id)
      ) {
        return withCors({ error: 'Gaming stream is not publicly available' }, 403, req);
      }
      uid = getAnonymousUid();
      const publisherId = [stream.owner_id, stream.user_id, stream.broadcaster_id, stream.streamer_id, stream.host_id]
        .find((ownerId): ownerId is string => typeof ownerId === 'string');
      if (publisherId) {
        const screenHash = String(getAgoraUidHash(channelName));
        const cameraHash = String(getAgoraUidHash(`${channelName}-camera`));
        publisherUids = {
          screen: await getAuthorizedUid(publisherId, channelName, screenHash),
          camera: await getAuthorizedUid(publisherId, channelName, cameraHash),
        };
      }
    } else {
      const { user, error: authError } = await requireAuth(req);
      if (authError || !user) return authError || withCors({ error: 'Unauthorized' }, 401, req);

      if (body.roomType === 'gaming' && typeof body.streamId === 'string') {
        const { data: stream, error: streamError } = await authSupabase
          .from('streams')
          .select('id, category, status, is_live, agora_channel, stream_channel, owner_id, user_id, broadcaster_id, streamer_id, host_id')
          .eq('id', body.streamId)
          .maybeSingle();
        if (streamError) {
          console.error('[agora-token] Gaming broadcaster lookup failed:', streamError);
          return withCors({ error: 'Unable to verify gaming broadcaster' }, 500, req);
        }

        const expectedChannel = stream?.agora_channel || stream?.stream_channel || stream?.id;
        const isOwner = stream && [stream.owner_id, stream.user_id, stream.broadcaster_id, stream.streamer_id, stream.host_id]
          .some((ownerId) => ownerId === user.id);
        if (
          !stream ||
          String(stream.category || '').toLowerCase() !== 'gaming' ||
          !(stream.is_live === true || String(stream.status || '').toLowerCase() === 'live') ||
          channelName !== expectedChannel ||
          !isOwner ||
          body.role !== 'publisher'
        ) {
          return withCors({ error: 'Gaming stream publisher is not authorized' }, 403, req);
        }
        role = 'publisher';
      } else if (body.roomType === 'auction' && typeof body.auctionId === 'string') {
        const { data: auction, error: auctionError } = await authSupabase
          .from('auction_shows')
          .select('id, status, is_live, auctioneer_id, metadata')
          .eq('id', body.auctionId)
          .maybeSingle();
        if (auctionError) {
          console.error('[agora-token] Auction lookup failed:', auctionError);
          return withCors({ error: 'Unable to verify auction room' }, 500, req);
        }

        const metadata = auction?.metadata && typeof auction.metadata === 'object'
          ? auction.metadata as Record<string, unknown>
          : {};
        const validChannels = [
          `auction-${auction?.id ?? ''}`,
          metadata.agora_channel,
          metadata.livekit_room_name,
        ].filter((value): value is string => typeof value === 'string');
        if (
          !auction ||
          !(auction.is_live === true || String(auction.status || '').toLowerCase() === 'live') ||
          !validChannels.includes(channelName)
        ) {
          return withCors({ error: 'Auction is not live or channel is invalid' }, 403, req);
        }

        const { data: auctioneer, error: auctioneerError } = await authSupabase
          .from('auctioneer_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (auctioneerError) {
          console.error('[agora-token] Auctioneer lookup failed:', auctioneerError);
          return withCors({ error: 'Unable to verify auction host' }, 500, req);
        }
        const { data: profile, error: profileError } = await authSupabase
          .from('user_profiles')
          .select('role, is_admin, is_superadmin')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) {
          console.error('[agora-token] Auction viewer profile lookup failed:', profileError);
          return withCors({ error: 'Unable to verify auction access' }, 500, req);
        }

        const canPublish = Boolean(
          profile?.role === 'admin' ||
          profile?.is_admin === true ||
          profile?.is_superadmin === true ||
          (auctioneer?.id && auctioneer.id === auction.auctioneer_id)
        );
        if (body.role === 'publisher' && !canPublish) {
          return withCors({ error: 'Only the assigned auctioneer may publish' }, 403, req);
        }
        role = body.role === 'publisher' ? 'publisher' : 'subscriber';
      } else if (body.roomType === 'podcast' && typeof body.podcastId === 'string') {
        const { data: podcast, error: podcastError } = await authSupabase
          .from('podcasts')
          .select('id, agora_channel_name, owner_id, host_user_id, user_id, status, is_live, is_published, visibility, metadata')
          .eq('id', body.podcastId)
          .maybeSingle();
        if (podcastError) {
          console.error('[agora-token] Podcast lookup failed:', podcastError);
          return withCors({ error: 'Unable to verify podcast access' }, 500, req);
        }

        const metadata = podcast?.metadata && typeof podcast.metadata === 'object'
          ? podcast.metadata as Record<string, unknown>
          : {};
        const podcastChannel = podcast?.agora_channel_name ?? metadata.agora_channel_name ?? metadata.channelName;
        const isHost = podcast && [podcast.owner_id, podcast.host_user_id, podcast.user_id]
          .some((ownerId) => ownerId === user.id);
        const isLive = Boolean(podcast && (
          podcast.is_live === true ||
          ['live', 'active'].includes(String(podcast.status).toLowerCase())
        ));
        if (!podcast || !isLive || typeof podcastChannel !== 'string' || channelName !== podcastChannel) {
          return withCors({ error: 'Podcast is not live or channel is invalid' }, 403, req);
        }
        if (body.role === 'publisher' && !isHost) {
          return withCors({ error: 'Only the podcast host may publish' }, 403, req);
        }
        if (body.role !== 'publisher' && !(podcast.is_published === true || podcast.visibility === 'public')) {
          return withCors({ error: 'Podcast is not publicly available' }, 403, req);
        }
        role = body.role === 'publisher' ? 'publisher' : 'subscriber';
      } else if (body.roomType === 'staff_meeting' && typeof body.meetingId === 'string') {
        const { data: meeting, error: meetingError } = await authSupabase
          .from('staff_meetings')
          .select('id, room_name, status, created_by')
          .eq('id', body.meetingId)
          .maybeSingle();
        if (meetingError) {
          console.error('[agora-token] Staff meeting lookup failed:', meetingError);
          return withCors({ error: 'Unable to verify staff meeting access' }, 503, req);
        }
        if (
          !meeting ||
          meeting.room_name !== channelName ||
          ['ended', 'cancelled'].includes(String(meeting.status).toLowerCase())
        ) {
          return withCors({ error: 'Staff meeting is not available' }, 403, req);
        }

        const { data: participant, error: participantError } = await authSupabase
          .from('staff_meeting_participants')
          .select('status, is_active')
          .eq('meeting_id', meeting.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (participantError) {
          console.error('[agora-token] Staff meeting participant lookup failed:', participantError);
          return withCors({ error: 'Unable to verify staff meeting participant' }, 503, req);
        }
        if (
          meeting.created_by !== user.id &&
          !(participant?.status === 'joined' && participant.is_active === true)
        ) {
          return withCors({ error: 'Staff meeting participation is required' }, 403, req);
        }
        role = 'publisher';
      } else {
        return withCors({ error: 'Agora channel is not authorized' }, 403, req);
      }
      uid = await getAuthorizedUid(user.id, channelName, userIdStr);
    }

    // Accept 'audience' (auction viewer) and map it to subscriber.
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
      podcastId,
      ...(publisherUids ? {
        publisherScreenUid: publisherUids.screen,
        publisherCameraUid: publisherUids.camera,
      } : {}),
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
