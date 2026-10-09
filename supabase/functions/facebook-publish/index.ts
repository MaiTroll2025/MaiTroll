import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  requireMarketingPagePublisher,
  requirePublisher,
  recordFacebookAudit,
} from '../_shared/facebook/auth.ts';
import {
  DEFAULT_HASHTAGS,
  graphBaseUrl,
  resolveGraphApiVersion,
  siteUrl,
} from '../_shared/facebook/config.ts';
import {
  categoryNeedsReauthorization,
  classifyException,
  classifyMetaResponse,
  failure,
  type FacebookFailure,
} from '../_shared/facebook/errors.ts';

type SourceType =
  | 'wall_post'
  | 'troll_post'
  | 'stream'
  | 'gaming_stream'
  | 'podcast'
  | 'court_session'
  | 'treelz_post';

interface SourceContent {
  id: string;
  title: string;
  message: string;
  url: string;
  imageUrl?: string;
  public: boolean;
  imageSkippedReason?: string;
}

interface FacebookPublishRequest {
  sourceType?: SourceType | 'announcement';
  sourceId?: string;
  message?: string;
  retryPublicationId?: string;
}

interface MetaPublishResponse {
  id?: string;
  post_id?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSafePublicImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ![...url.searchParams.keys()].some((key) =>
        /^(token|signature|x-amz-signature|x-goog-signature)$/i.test(key)
      ) &&
      !url.pathname.includes('/object/sign/') &&
      !url.pathname.includes('/storage/v1/object/sign/')
    );
  } catch {
    return false;
  }
}

function formatMessage(title: string, message: string, url: string): string {
  const base = [title ? `🚨 ${title}` : '', message.trim(), `🌐 Visit Mai Troll:\n${url}`]
    .filter(Boolean)
    .join('\n\n');
  return /#[\p{L}\p{N}_]+/u.test(base)
    ? base
    : `${base}\n\n${DEFAULT_HASHTAGS.join(' ')}`;
}

async function loadSource(
  db: NonNullable<Awaited<ReturnType<typeof requirePublisher>>['db']>,
  sourceType: SourceType,
  sourceId: string,
): Promise<SourceContent> {
  if (sourceType === 'wall_post') {
    const { data, error } = await db
      .from('troll_wall_posts')
      .select('*')
      .eq('id', sourceId)
      .is('reply_to_post_id', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw { category: 'ineligible_content', message: 'This Troll Wall post is no longer available.', retryable: false };

    const row = data as Record<string, unknown>;
    if (
      row.deleted_at ||
      row.is_system_generated === true ||
      row.is_facebook_featured !== true ||
      (row.moderation_status && row.moderation_status !== 'approved') ||
      !String(row.content || '').trim()
    ) {
      throw { category: 'ineligible_content', message: 'This Troll Wall post is not eligible for Facebook publishing.', retryable: false };
    }
    const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
    const image = metadata.image_url;
    const content = String(row.content || '').trim();
    if (content.length > 5000) throw failure('invalid_content');
    return {
      id: String(row.id),
      title: '',
      message: content,
      url: `${siteUrl()}/wall/${encodeURIComponent(String(row.id))}`,
      imageUrl: isSafePublicImage(image) ? image : undefined,
      imageSkippedReason: image && !isSafePublicImage(image) ? 'The attachment is not a public HTTPS image; text only was published.' : undefined,
      public: true,
    };
  }

  if (sourceType === 'troll_post') {
    const { data, error } = await db
      .from('troll_posts')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw { category: 'ineligible_content', message: 'This user post is no longer available.', retryable: false };

    const row = data as Record<string, unknown>;
    const visibility = String(row.visibility || '').toLowerCase();
    if (
      row.deleted_at ||
      (row.moderation_status && row.moderation_status !== 'approved') ||
      row.is_public === false ||
      (visibility && !['public', 'everyone'].includes(visibility)) ||
      !String(row.content || '').trim()
    ) {
      throw { category: 'ineligible_content', message: 'This user post is not eligible for Facebook publishing.', retryable: false };
    }
    const content = String(row.content).trim();
    if (content.length > 5000) throw failure('invalid_content');

    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('username')
      .eq('id', row.user_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.username) throw { category: 'ineligible_content', message: 'The post author is no longer available.', retryable: false };

    const postUrl = `${siteUrl()}/profile/${encodeURIComponent(profile.username)}?tab=social`;
    const image = row.image_url;
    return {
      id: String(row.id),
      title: '',
      message: content,
      url: postUrl,
      imageUrl: isSafePublicImage(image) ? image : undefined,
      imageSkippedReason: image && !isSafePublicImage(image) ? 'The attachment is not a public HTTPS image; text only was published.' : undefined,
      public: true,
    };
  }

  if (sourceType === 'podcast') {
    const { data, error } = await db
      .from('podcasts')
      .select('id, host_user_id, title, description, status')
      .eq('id', sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!data || !['live', 'active'].includes(String(data.status || '').toLowerCase())) {
      throw { category: 'ineligible_content', message: 'This podcast is not currently live.', retryable: false };
    }

    return {
      id: String(data.id),
      title: String(data.title || 'Mai Troll Podcast'),
      message: String(data.description || 'is live now on Mai Troll.').trim(),
      url: `${siteUrl()}/podcast/${encodeURIComponent(String(data.id))}`,
      public: true,
    };
  }

  if (sourceType === 'court_session') {
    const { data, error } = await db
      .from('court_sessions')
      .select('id, title, status, is_public')
      .eq('id', sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.is_public !== true || !['active', 'live'].includes(String(data.status || '').toLowerCase())) {
      throw { category: 'ineligible_content', message: 'This Troll Court session is not currently live.', retryable: false };
    }

    return {
      id: String(data.id),
      title: String(data.title || 'Troll Court Live'),
      message: 'A Troll Court session is live now on Mai Troll.',
      url: `${siteUrl()}/troll-court/watch/${encodeURIComponent(String(data.id))}`,
      public: true,
    };
  }

  if (sourceType === 'treelz_post') {
    const { data, error } = await db
      .from('treelz_posts')
      .select('id, user_id, caption, thumbnail_url, status')
      .eq('id', sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.status !== 'active') {
      throw { category: 'ineligible_content', message: 'This Treelz post is not publicly available.', retryable: false };
    }

    const caption = String(data.caption || '').trim();
    if (caption.length > 5000) throw failure('invalid_content');
    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('username')
      .eq('id', data.user_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.username) throw { category: 'ineligible_content', message: 'The Treelz creator is no longer available.', retryable: false };
    const image = data.thumbnail_url;

    return {
      id: String(data.id),
      title: `Treelz by @${profile.username}`,
      message: caption || 'Watch this Treelz video on Mai Troll.',
      url: `${siteUrl()}/treelz`,
      imageUrl: isSafePublicImage(image) ? image : undefined,
      imageSkippedReason: image && !isSafePublicImage(image) ? 'The thumbnail is not a public HTTPS image; text only was published.' : undefined,
      public: true,
    };
  }

  const { data, error } = await db
    .from('streams')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw { category: 'ineligible_content', message: 'This broadcast is no longer available.', retryable: false };

  const row = data as Record<string, unknown>;
  const isLive = row.is_live === true || row.status === 'live';
  const isCompletedReplay = row.status === 'ended' &&
    Boolean(row.ended_at || row.end_time) &&
    Boolean(row.recording_url);
  const visibility = String(row.visibility || '').toLowerCase();
  if (
    (!isLive && !isCompletedReplay) ||
    (sourceType === 'gaming_stream' && String(row.category || '').toLowerCase() !== 'gaming') ||
    row.deleted_at ||
    row.is_public === false ||
    row.is_paid === true ||
    row.pricing_type === 'paid' ||
    visibility === 'private' ||
    visibility === 'invite_only' ||
    (row.moderation_status && row.moderation_status !== 'approved')
  ) {
    throw { category: 'ineligible_content', message: 'This broadcast is not public or is no longer available.', retryable: false };
  }

  const broadcasterId = String(row.broadcaster_id || row.user_id || '');
  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('username, ghost_mode_until')
    .eq('id', broadcasterId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.username) throw { category: 'ineligible_content', message: 'The broadcaster is no longer available.', retryable: false };
  if (profile.ghost_mode_until && new Date(profile.ghost_mode_until).getTime() > Date.now()) {
    throw { category: 'ineligible_content', message: 'This broadcast is not publicly discoverable.', retryable: false };
  }

  return {
    id: String(row.id),
    title: String(row.title || 'Mai Troll Live'),
    message: `${isLive ? 'is live now' : 'shared a broadcast replay'} on Mai Troll.`,
    url: sourceType === 'gaming_stream'
      ? `${siteUrl()}/gaming/watch/${encodeURIComponent(String(row.id))}`
      : `${siteUrl()}/live/${encodeURIComponent(profile.username)}`,
    imageUrl: isSafePublicImage(row.thumbnail_url) ? String(row.thumbnail_url) : undefined,
    imageSkippedReason: row.thumbnail_url && !isSafePublicImage(row.thumbnail_url)
      ? 'The thumbnail is not a public HTTPS image; text only was published.'
      : undefined,
    public: true,
  };
}

async function loadRequestedSource(
  db: NonNullable<Awaited<ReturnType<typeof requirePublisher>>['db']>,
  sourceType: SourceType | 'announcement',
  sourceId: string,
  message?: string,
): Promise<SourceContent> {
  if (sourceType === 'announcement') {
    if (!message?.trim()) {
      throw failure('invalid_content');
    }
    return {
      id: sourceId,
      title: 'Mai Troll Update',
      message: message.trim(),
      url: siteUrl(),
      public: true,
    };
  }
  return loadSource(db, sourceType, sourceId);
}

async function publishToMeta(
  pageId: string,
  token: string,
  content: SourceContent,
): Promise<{ response: MetaPublishResponse; imageAttached: boolean; imageSkippedReason?: string }> {
  const version = resolveGraphApiVersion();
  const message = formatMessage(content.title, content.message, content.url);
  const graphRoot = graphBaseUrl(version);

  if (content.imageUrl) {
    const photoUrl = new URL(`${graphRoot}/${encodeURIComponent(pageId)}/photos`);
    const photoBody = new URLSearchParams({ url: content.imageUrl, caption: message });
    const photoResponse = await fetch(photoUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: photoBody,
      signal: AbortSignal.timeout(20000),
    });
    const photoData: unknown = await photoResponse.json().catch(() => ({}));
    if (photoResponse.ok) {
      return { response: photoData as MetaPublishResponse, imageAttached: true };
    }
    const mediaFailure = classifyMetaResponse({ status: photoResponse.status, body: photoData });
    if (!['invalid_media', 'invalid_content'].includes(mediaFailure.category)) throw mediaFailure;
    content.imageSkippedReason = failure('invalid_media').message;
  }

  const feedUrl = new URL(`${graphRoot}/${encodeURIComponent(pageId)}/feed`);
  const feedBody = new URLSearchParams({ message, link: content.url });
  const feedResponse = await fetch(feedUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: feedBody,
    signal: AbortSignal.timeout(20000),
  });
  const feedData: unknown = await feedResponse.json().catch(() => ({}));
  if (!feedResponse.ok) throw classifyMetaResponse({ status: feedResponse.status, body: feedData });
  return { response: feedData as MetaPublishResponse, imageAttached: false, imageSkippedReason: content.imageSkippedReason };
}

function asFailure(error: unknown): FacebookFailure {
  if (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    'message' in error &&
    typeof (error as { category: unknown }).category === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return error as FacebookFailure;
  }
  return classifyException(error);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: FacebookPublishRequest;
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json({ error: 'Invalid request body' }, 400);
    }
    body = parsed as FacebookPublishRequest;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const auth = body.sourceType === 'announcement'
    ? await requireMarketingPagePublisher(req)
    : await requirePublisher(req);
  if (!auth.ok || !auth.db || !auth.admin) {
    return json({ error: auth.error, code: auth.code }, auth.status);
  }

  const sourceTypes: SourceType[] = ['wall_post', 'troll_post', 'stream', 'gaming_stream', 'podcast', 'court_session', 'treelz_post'];
  if (!body.sourceId || !/^[0-9a-f-]{36}$/i.test(body.sourceId)) {
    return json({ error: 'A valid sourceId is required' }, 400);
  }
  if (
    !body.sourceType ||
    (body.sourceType !== 'announcement' && !sourceTypes.includes(body.sourceType))
  ) {
    return json({ error: 'Unsupported Facebook publishing source' }, 400);
  }
  if (
    body.sourceType === 'announcement' &&
    !body.retryPublicationId &&
    (!body.message?.trim() || body.message.trim().length > 5000)
  ) {
    return json({ error: 'Announcement text must contain 1 to 5000 characters' }, 400);
  }

  const { data: connection, error: connectionError } = await auth.db
    .from('facebook_page_connections')
    .select('id, page_id, page_name, connection_status')
    .eq('connection_status', 'connected')
    .maybeSingle();
  if (connectionError) {
    console.error('[facebook-publish] Connection lookup failed', { message: connectionError.message });
    return json({ error: 'Unable to load Facebook connection status' }, 500);
  }
  if (!connection) {
    return json({ error: 'No Mai Troll Facebook Page is connected.', code: 'not_connected' }, 409);
  }

  const { data: credential, error: credentialError } = await auth.db
    .from('facebook_page_credentials')
    .select('access_token')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (credentialError || !credential?.access_token) {
    return json({ error: 'Facebook publishing is unavailable because the Page connection needs reauthorization.', code: 'connection_needs_attention' }, 409);
  }

  let publicationId: string;
  let attemptCount: number;
  let sourceContent: SourceContent | undefined;

  if (body.retryPublicationId) {
    const { data: prior, error } = await auth.db
      .from('facebook_publications')
      .select('id, source_type, source_id, facebook_page_id, status, attempt_count, max_attempts, error_category, next_retry_at, payload')
      .eq('id', body.retryPublicationId)
      .eq('facebook_page_id', connection.page_id)
      .maybeSingle();
    if (error) {
      console.error('[facebook-publish] Retry lookup failed', { message: error.message });
      return json({ error: 'Unable to check the previous publication' }, 500);
    }
    if (!prior || prior.source_id !== body.sourceId || prior.source_type !== body.sourceType) {
      return json({ error: 'The selected publication does not match this content.', code: 'ineligible_content' }, 400);
    }
    if (prior.status === 'published') {
      return json({ success: true, alreadyPublished: true, message: 'This content was already published.' });
    }
    if (
      prior.status !== 'failed' ||
      prior.error_category !== 'rate_limit' ||
      prior.attempt_count >= prior.max_attempts ||
      (prior.next_retry_at && new Date(prior.next_retry_at).getTime() > Date.now())
    ) {
      return json({ error: 'This publication cannot be safely retried yet.', code: 'retry_not_available' }, 409);
    }
    if (body.sourceType === 'announcement') {
      const payload = prior.payload as Record<string, unknown>;
      if (typeof payload.message !== 'string' || typeof payload.url !== 'string') {
        return json({ error: 'The original announcement is unavailable for a safe retry.', code: 'retry_not_available' }, 409);
      }
      sourceContent = {
        id: body.sourceId,
        title: typeof payload.title === 'string' ? payload.title : 'Mai Troll Update',
        message: payload.message,
        url: payload.url,
        public: true,
      };
    }
    publicationId = prior.id;
    attemptCount = prior.attempt_count + 1;
    const { data: reserved, error: updateError } = await auth.db
      .from('facebook_publications')
      .update({
        status: 'retrying',
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
        error_category: null,
        error_message: null,
      })
      .eq('id', publicationId)
      .eq('status', 'failed')
      .select('id')
      .maybeSingle();
    if (updateError || !reserved) {
      console.error('[facebook-publish] Retry reservation failed', { message: updateError?.message || 'Publication was already reserved' });
      return json({ error: 'Unable to reserve the retry attempt' }, 409);
    }
  } else {
    const { data: prior, error } = await auth.db
      .from('facebook_publications')
      .select('id, status, facebook_post_id, facebook_post_url')
      .eq('source_type', body.sourceType)
      .eq('source_id', body.sourceId)
      .eq('facebook_page_id', connection.page_id)
      .maybeSingle();
    if (error) {
      console.error('[facebook-publish] Duplicate check failed', { message: error.message });
      return json({ error: 'Unable to check publication history' }, 500);
    }
    if (prior) {
      return prior.status === 'published'
        ? json({ success: true, alreadyPublished: true, postUrl: prior.facebook_post_url, message: 'This content was already published.' })
        : json({ error: 'A publication attempt already exists. Check the publishing history before trying again.', code: 'publication_exists' }, 409);
    }

    try {
      sourceContent = await loadRequestedSource(auth.db, body.sourceType, body.sourceId, body.message);
    } catch (error) {
      const failure = asFailure(error);
      return json({ error: failure.message, code: failure.category }, 422);
    }

    const { data: publication, error: insertError } = await auth.db
      .from('facebook_publications')
      .insert({
        source_type: body.sourceType,
        source_id: body.sourceId,
        source_title: sourceContent.title || sourceContent.message.slice(0, 120),
        facebook_page_id: connection.page_id,
        status: 'pending',
        attempt_count: 1,
        max_attempts: 3,
        last_attempt_at: new Date().toISOString(),
        created_by: auth.admin.userId,
        payload: {
          message: sourceContent.message,
          title: sourceContent.title,
          url: sourceContent.url,
        },
      })
      .select('id')
      .single();
    if (insertError || !publication) {
      if (insertError?.code === '23505') {
        return json({ error: 'A publication attempt already exists. Check the publishing history before trying again.', code: 'publication_exists' }, 409);
      }
      console.error('[facebook-publish] Could not create publication ledger row', { message: insertError?.message });
      return json({ error: 'Unable to reserve this Facebook publication' }, 500);
    }
    publicationId = publication.id;
    attemptCount = 1;
  }

  try {
    const content = sourceContent || await loadRequestedSource(auth.db, body.sourceType, body.sourceId, body.message);
    if (!content.public) {
      const error: FacebookFailure = { category: 'ineligible_content', message: 'This content is not public and cannot be published.', retryable: false };
      throw error;
    }

    const published = await publishToMeta(connection.page_id, credential.access_token, content);
    const facebookPostId = published.response.id || published.response.post_id;
    if (!facebookPostId) {
      throw { category: 'unknown', message: 'Facebook did not return a post identifier.', retryable: false };
    }
    const facebookPostUrl = `https://www.facebook.com/${encodeURIComponent(facebookPostId)}`;
    const formattedMessage = formatMessage(content.title, content.message, content.url);

    const { error: updateError } = await auth.db
      .from('facebook_publications')
      .update({
        source_title: content.title || content.message.slice(0, 120),
        facebook_post_id: facebookPostId,
        facebook_post_url: facebookPostUrl,
        status: 'published',
        published_at: new Date().toISOString(),
        payload: {
          message: content.message,
          title: content.title,
          url: content.url,
          formatted_message: formattedMessage,
        },
        image_attached: published.imageAttached,
        image_skipped_reason: published.imageSkippedReason || null,
        error_category: null,
        error_message: null,
        next_retry_at: null,
      })
      .eq('id', publicationId);
    if (updateError) {
      console.error('[facebook-publish] Facebook post succeeded but ledger update failed', {
        publicationId,
        message: updateError.message,
      });
      return json({
        success: false,
        publicationId,
        error: 'Facebook accepted the post, but Mai Troll could not record the result. Do not retry this item until the publishing history has been checked.',
        code: 'recording_failed',
      }, 502);
    }

    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_content_published',
      targetType: body.sourceType,
      targetId: body.sourceId,
      targetName: content.title || content.message.slice(0, 120),
      details: { publication_id: publicationId, facebook_post_id: facebookPostId },
    });

    return json({
      success: true,
      publicationId,
      facebookPostId,
      facebookPostUrl,
      imageAttached: published.imageAttached,
      imageSkippedReason: published.imageSkippedReason,
    });
  } catch (error) {
    const failure = asFailure(error);
    const nextRetryAt = failure.category === 'rate_limit' && attemptCount < 3
      ? new Date(Date.now() + 2 * 60 * 1000).toISOString()
      : null;
    const { error: updateError } = await auth.db
      .from('facebook_publications')
      .update({
        status: 'failed',
        error_category: failure.category,
        error_message: failure.message,
        next_retry_at: nextRetryAt,
      })
      .eq('id', publicationId);
    if (updateError) {
      console.error('[facebook-publish] Failed to record safe failure', {
        publicationId,
        message: updateError.message,
      });
    }

    if (categoryNeedsReauthorization(failure.category)) {
      await auth.db
        .from('facebook_page_connections')
        .update({
          connection_status: 'needs_attention',
          last_error_category: failure.category,
          last_error_message: failure.message,
        })
        .eq('id', connection.id);
    }

    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_content_publish_failed',
      targetType: body.sourceType,
      targetId: body.sourceId,
      result: 'error',
      errorMessage: failure.category,
      details: { publication_id: publicationId },
    });

    return json({
      success: false,
      publicationId,
      error: failure.message,
      code: failure.category,
      retryAt: nextRetryAt,
    }, 502);
  }
});
