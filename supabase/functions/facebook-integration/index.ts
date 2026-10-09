import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  requireAdmin,
  requirePublisher,
  recordFacebookAudit,
} from '../_shared/facebook/auth.ts';
import { graphBaseUrl, resolveGraphApiVersion } from '../_shared/facebook/config.ts';
import {
  classifyException,
  classifyMetaResponse,
  categoryNeedsReauthorization,
  failure,
} from '../_shared/facebook/errors.ts';

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

async function readMetaPage(pageId: string, token: string): Promise<{ id: string; name: string }> {
  const url = new URL(`${graphBaseUrl(resolveGraphApiVersion())}/${encodeURIComponent(pageId)}`);
  url.searchParams.set('fields', 'id,name');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw classifyMetaResponse({ status: response.status, body });
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('name' in body) ||
    typeof body.id !== 'string' ||
    typeof body.name !== 'string'
  ) {
    throw failure('unknown');
  }
  return { id: body.id, name: body.name };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { action?: string; automaticPublishing?: boolean };
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json({ error: 'Invalid request body' }, 400);
    }
    body = parsed as { action?: string; automaticPublishing?: boolean };
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (body.action === 'status' || body.action === 'history') {
    const auth = await requirePublisher(req);
    if (!auth.ok || !auth.db) return json({ error: auth.error, code: auth.code }, auth.status);
    const { data: connectionRows, error } = await auth.db
      .from('facebook_page_connections')
      .select('id, page_id, page_name, connection_status, automatic_publishing, publish_announcements, publish_featured_wall_posts, auto_publish_general_wall_posts, graph_api_version, token_last4, last_verified_at, last_error_category, last_error_message, updated_at')
      .in('connection_status', ['connected', 'needs_attention'])
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[facebook-integration] Connection lookup failed', { message: error.message });
      return json({ error: 'Unable to load Facebook connection status' }, 500);
    }
    const connection = connectionRows?.find((row) => row.connection_status === 'connected') ||
      connectionRows?.[0] ||
      null;

    const { data: recent, error: historyError } = await auth.db
      .from('facebook_publications')
      .select('id, source_type, source_id, source_title, facebook_page_id, facebook_post_id, facebook_post_url, status, attempt_count, max_attempts, error_category, error_message, image_attached, image_skipped_reason, last_attempt_at, next_retry_at, published_at, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(50);
    if (historyError) {
      console.error('[facebook-integration] History lookup failed', { message: historyError.message });
      return json({ error: 'Unable to load Facebook publishing history' }, 500);
    }

    return json({
      connection: connection
        ? { ...connection, page_id: `${connection.page_id.slice(0, 4)}...${connection.page_id.slice(-4)}` }
        : null,
      publications: recent || [],
    });
  }

  if (body.action !== 'test' && body.action !== 'disconnect' && body.action !== 'set_automatic') {
    return json({ error: 'Unsupported Facebook integration action' }, 400);
  }

  const auth = await requireAdmin(req);
  if (!auth.ok || !auth.db || !auth.admin) {
    return json({ error: auth.error, code: auth.code }, auth.status);
  }

  const { data: connection, error: connectionError } = await auth.db
    .from('facebook_page_connections')
    .select('id, page_id, page_name, connection_status')
    .eq('connection_status', 'connected')
    .maybeSingle();
  if (connectionError) {
    console.error('[facebook-integration] Connection lookup failed', { message: connectionError.message });
    return json({ error: 'Unable to load Facebook connection status' }, 500);
  }
  if (!connection) return json({ error: 'No Facebook Page is connected', code: 'not_connected' }, 409);

  if (body.action === 'set_automatic') {
    if (typeof body.automaticPublishing !== 'boolean') {
      return json({ error: 'automaticPublishing must be a boolean' }, 400);
    }
    const { error } = await auth.db
      .from('facebook_page_connections')
      .update({ automatic_publishing: body.automaticPublishing })
      .eq('id', connection.id);
    if (error) {
      console.error('[facebook-integration] Could not update auto-publishing setting', { message: error.message });
      return json({ error: 'Unable to update Facebook publishing settings' }, 500);
    }
    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_auto_publishing_updated',
      targetType: 'facebook_page',
      targetId: connection.page_id,
      targetName: connection.page_name,
      details: { enabled: body.automaticPublishing },
    });
    return json({ success: true, automaticPublishing: body.automaticPublishing });
  }

  if (body.action === 'disconnect') {
    const { error } = await auth.db
      .from('facebook_page_connections')
      .update({
        connection_status: 'disconnected',
        automatic_publishing: false,
        disconnected_by: auth.admin.userId,
        disconnected_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    if (error) {
      console.error('[facebook-integration] Could not mark Page disconnected', { message: error.message });
      return json({ error: 'Unable to disconnect Facebook Page' }, 500);
    }
    const { error: credentialError } = await auth.db
      .from('facebook_page_credentials')
      .delete()
      .eq('connection_id', connection.id);
    if (credentialError) {
      console.error('[facebook-integration] Could not delete Page credential', { message: credentialError.message });
      return json({ error: 'Facebook Page was disconnected, but its stored credential could not be removed.' }, 500);
    }
    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_page_disconnected',
      targetType: 'facebook_page',
      targetId: connection.page_id,
      targetName: connection.page_name,
    });
    return json({ success: true });
  }

  const { data: credential, error: credentialError } = await auth.db
    .from('facebook_page_credentials')
    .select('access_token')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (credentialError || !credential?.access_token) {
    return json({ error: 'Facebook connection needs to be reauthorized', code: 'connection_needs_attention' }, 409);
  }

  try {
    const page = await readMetaPage(connection.page_id, credential.access_token);
    const { error } = await auth.db
      .from('facebook_page_connections')
      .update({
        page_name: page.name,
        last_verified_at: new Date().toISOString(),
        last_error_category: null,
        last_error_message: null,
      })
      .eq('id', connection.id);
    if (error) throw error;
    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_connection_tested',
      targetType: 'facebook_page',
      targetId: page.id,
      targetName: page.name,
    });
    return json({ success: true, message: 'Facebook connection is working', pageName: page.name });
  } catch (error) {
    const failure = typeof error === 'object' && error !== null && 'category' in error
      ? error as ReturnType<typeof classifyException>
      : classifyException(error);
    const { error: statusError } = await auth.db
      .from('facebook_page_connections')
      .update({
        connection_status: categoryNeedsReauthorization(failure.category) ? 'needs_attention' : connection.connection_status,
        last_error_category: failure.category,
        last_error_message: failure.message,
      })
      .eq('id', connection.id);
    if (statusError) {
      console.error('[facebook-integration] Could not save the connection test result', { message: statusError.message });
    }
    await recordFacebookAudit(auth.db, {
      admin: auth.admin,
      actionType: 'facebook_connection_tested',
      targetType: 'facebook_page',
      targetId: connection.page_id,
      result: 'error',
      errorMessage: failure.category,
    });
    return json({ error: failure.message, code: failure.category }, 502);
  }
});
