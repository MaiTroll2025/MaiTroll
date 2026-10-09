import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  adminClient,
  isFacebookAdminProfile,
  recordFacebookAudit,
  type AuthorizedAdmin,
} from '../_shared/facebook/auth.ts';
import {
  FACEBOOK_SCOPES,
  configuredPageId,
  graphBaseUrl,
  metaAppId,
  metaAppSecret,
  oauthRedirectUri,
  resolveGraphApiVersion,
  siteUrl,
} from '../_shared/facebook/config.ts';
import { classifyMetaResponse } from '../_shared/facebook/errors.ts';
import { hashOAuthNonce, verifyOAuthState } from '../_shared/facebook/state.ts';

interface MetaTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: unknown;
  error_code?: number;
}

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
}

interface MetaPermission {
  permission: string;
  status: string;
}

function redirect(result: string, reason?: string): Response {
  const url = new URL('/admin/marketing', siteUrl());
  url.searchParams.set('facebook', result);
  if (reason) url.searchParams.set('reason', reason);
  return Response.redirect(url.toString(), 302);
}

async function graphJson<T>(url: URL, token?: string): Promise<T> {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw classifyMetaResponse({ status: response.status, body });
  return body as T;
}

function safeReason(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'category' in error) {
    const category = String((error as { category: unknown }).category);
    return /^[a-z_]+$/.test(category) ? category : 'unknown';
  }
  return 'unknown';
}

serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const callback = new URL(req.url);
  const stateValue = callback.searchParams.get('state');
  const code = callback.searchParams.get('code');
  const appId = metaAppId();
  const appSecret = metaAppSecret();
  if (!appId || !appSecret) return redirect('error', 'config_error');

  const verification = await verifyOAuthState(stateValue, appSecret);
  if (!verification.valid || !verification.state) {
    console.warn('[facebook-oauth] Invalid callback state', { reason: verification.reason });
    return redirect('error', 'invalid_state');
  }

  const db = adminClient();
  const stateRow = await db
    .from('facebook_oauth_states')
    .delete()
    .eq('nonce_hash', await hashOAuthNonce(verification.state.nonce))
    .eq('user_id', verification.state.userId)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle();

  if (stateRow.error || !stateRow.data) {
    console.warn('[facebook-oauth] State nonce was missing, expired, or already consumed');
    return redirect('error', 'invalid_state');
  }

  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('id, role, troll_role, is_admin')
    .eq('id', verification.state.userId)
    .maybeSingle();

  if (profileError || !isFacebookAdminProfile(profile)) {
    console.warn('[facebook-oauth] Callback user is no longer an administrator');
    return redirect('error', 'insufficient_role');
  }

  const admin: AuthorizedAdmin = {
    userId: verification.state.userId,
    email: null,
    role: String(profile?.role || 'admin').toLowerCase(),
    isAdmin: true,
    isStaff: true,
  };

  if (callback.searchParams.has('error')) {
    await recordFacebookAudit(db, {
      admin,
      actionType: 'facebook_oauth_cancelled',
      result: 'denied',
    });
    return redirect('cancelled', 'oauth_cancelled');
  }
  if (!code) return redirect('error', 'invalid_state');

  try {
    const version = resolveGraphApiVersion();
    const baseUrl = graphBaseUrl(version);
    const exchangeUrl = new URL(`${baseUrl}/oauth/access_token`);
    exchangeUrl.searchParams.set('client_id', appId);
    exchangeUrl.searchParams.set('client_secret', appSecret);
    exchangeUrl.searchParams.set('redirect_uri', oauthRedirectUri());
    exchangeUrl.searchParams.set('code', code);
    const shortToken = await graphJson<MetaTokenResponse>(exchangeUrl);
    if (!shortToken.access_token) throw new Error('Meta did not return an access token');

    const longTokenUrl = new URL(`${baseUrl}/oauth/access_token`);
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortToken.access_token);
    const longToken = await graphJson<MetaTokenResponse>(longTokenUrl);
    if (!longToken.access_token) throw new Error('Meta did not return a long-lived access token');

    const permissionsUrl = new URL(`${baseUrl}/me/permissions`);
    const permissionResponse = await graphJson<{ data?: MetaPermission[] }>(
      permissionsUrl,
      longToken.access_token,
    );
    const grantedScopes = new Set(
      (permissionResponse.data || [])
        .filter((permission) => permission.status === 'granted')
        .map((permission) => permission.permission),
    );
    if (FACEBOOK_SCOPES.some((scope) => !grantedScopes.has(scope))) {
      throw { category: 'permission_error' };
    }

    const pagesUrl = new URL(`${baseUrl}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,tasks');
    const pagesResponse = await graphJson<{ data?: MetaPage[] }>(pagesUrl, longToken.access_token);
    const pages = (pagesResponse.data || []).filter((page) => page.id && page.name && page.access_token);
    const targetPageId = configuredPageId();
    const selectedPages = targetPageId
      ? pages.filter((page) => page.id === targetPageId)
      : pages.length === 1
        ? pages
        : [];

    if (selectedPages.length !== 1) {
      await recordFacebookAudit(db, {
        admin,
        actionType: 'facebook_oauth_failed',
        result: 'error',
        errorMessage: targetPageId ? 'configured_page_not_found' : 'page_selection_required',
      });
      return redirect('error', targetPageId ? 'page_not_found' : 'page_selection_required');
    }

    const page = selectedPages[0];
    if (!page.tasks?.some((task) => task === 'CREATE_CONTENT' || task === 'MANAGE')) {
      throw { category: 'permission_error' };
    }
    const existing = await db
      .from('facebook_page_connections')
      .select('id, page_id')
      .in('connection_status', ['connected', 'needs_attention'])
      .order('updated_at', { ascending: false });
    if (existing.error) throw existing.error;

    const reusableConnection = (existing.data || []).find((item) => item.page_id === page.id);
    for (const staleConnection of existing.data || []) {
      if (staleConnection.id === reusableConnection?.id) continue;
      const { error: disconnectError } = await db
        .from('facebook_page_connections')
        .update({
          connection_status: 'disconnected',
          disconnected_by: admin.userId,
          disconnected_at: new Date().toISOString(),
        })
        .eq('id', staleConnection.id);
      if (disconnectError) throw disconnectError;
      const { error: removeTokenError } = await db
        .from('facebook_page_credentials')
        .delete()
        .eq('connection_id', staleConnection.id);
      if (removeTokenError) throw removeTokenError;
    }

    let connectionId: string | undefined = reusableConnection?.id;
    if (connectionId) {
      const { error } = await db
        .from('facebook_page_connections')
        .update({
          page_name: page.name,
          connection_status: 'connected',
          connected_by: admin.userId,
          graph_api_version: version,
          token_last4: page.access_token.slice(-4),
          token_expires_at: null,
          granted_scopes: [...FACEBOOK_SCOPES],
          last_verified_at: new Date().toISOString(),
          last_error_category: null,
          last_error_message: null,
          disconnected_by: null,
          disconnected_at: null,
        })
        .eq('id', connectionId);
      if (error) throw error;
    } else {
      const { data, error } = await db
        .from('facebook_page_connections')
        .insert({
          page_id: page.id,
          page_name: page.name,
          connection_status: 'connected',
          connected_by: admin.userId,
          graph_api_version: version,
          token_last4: page.access_token.slice(-4),
          token_expires_at: null,
          granted_scopes: [...FACEBOOK_SCOPES],
        })
        .select('id')
        .single();
      if (error) throw error;
      connectionId = data.id;
    }

    const { error: credentialError } = await db
      .from('facebook_page_credentials')
      .upsert({
        connection_id: connectionId,
        access_token: page.access_token,
        updated_at: new Date().toISOString(),
      });
    if (credentialError) throw credentialError;

    await recordFacebookAudit(db, {
      admin,
      actionType: 'facebook_page_connected',
      targetType: 'facebook_page',
      targetId: page.id,
      targetName: page.name,
      details: { graph_api_version: version },
    });

    return redirect('connected');
  } catch (error) {
    const reason = safeReason(error);
    console.error('[facebook-oauth] Callback failed', { reason });
    await recordFacebookAudit(db, {
      admin,
      actionType: 'facebook_oauth_failed',
      result: 'error',
      errorMessage: reason,
    });
    return redirect('error', reason);
  }
});
