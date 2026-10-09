/**
 * Centralised configuration for the Mai Troll Facebook Page integration.
 *
 * NOTE ON THE GRAPH API VERSION
 * -----------------------------
 * Meta retires Graph API versions on a rolling ~2 year schedule. The
 * version is therefore NOT hardcoded at call sites: it is read from the
 * META_GRAPH_API_VERSION secret so it can be bumped without redeploying
 * every function, and it falls back to DEFAULT_GRAPH_API_VERSION.
 *
 * Verify the currently supported version at
 *   https://developers.facebook.com/docs/graph-api/changelog
 * and set META_GRAPH_API_VERSION accordingly.
 */

/** Latest Graph API version listed in Meta's official changelog. */
export const DEFAULT_GRAPH_API_VERSION = 'v26.0';

const GRAPH_API_VERSION_PATTERN = /^v\d{1,2}\.\d$/;

/**
 * Resolve the Graph API version, validating the shape so a malformed
 * secret cannot produce a silently broken request URL.
 */
export function resolveGraphApiVersion(): string {
  const configured = (Deno.env.get('META_GRAPH_API_VERSION') || '').trim();
  if (configured && GRAPH_API_VERSION_PATTERN.test(configured)) {
    return configured;
  }
  return DEFAULT_GRAPH_API_VERSION;
}

export function graphBaseUrl(version: string): string {
  return `https://graph.facebook.com/${version}`;
}

export function oauthDialogUrl(version: string): string {
  return `https://www.facebook.com/${version}/dialog/oauth`;
}

/**
 * Minimum permissions required to publish to a Page. Requesting only
 * these keeps the Meta consent screen honest:
 *   pages_show_list       - list the Pages the admin manages (required to
 *                           discover and obtain the Page access token)
 *   pages_manage_posts    - create posts as the Page
 *   pages_read_engagement - read the Page so "Test Connection" can verify
 *                           publishing capability without creating a post
 */
export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
] as const;

export function facebookScopesParam(): string {
  return FACEBOOK_SCOPES.join(',');
}

/** Meta app credentials. These live only in Supabase secrets. */
export function metaAppId(): string {
  return (Deno.env.get('META_APP_ID') || Deno.env.get('FACEBOOK_APP_ID') || '').trim();
}

export function metaAppSecret(): string {
  return (Deno.env.get('META_APP_SECRET') || Deno.env.get('FACEBOOK_APP_SECRET') || '').trim();
}

/** Public site origin used to build canonical links and the OAuth redirect. */
export function siteUrl(): string {
  const raw = (Deno.env.get('SITE_URL') || 'https://maitroll.com').trim();
  return raw.replace(/\/+$/, '');
}

/** Where Meta sends the browser back to after consent. Static page, no secrets. */
export function oauthRedirectUri(): string {
  const override = (Deno.env.get('META_OAUTH_REDIRECT_URI') || '').trim();
  if (override) return override;
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required to build the Facebook OAuth callback URL');
  }
  return `${supabaseUrl}/functions/v1/facebook-oauth-callback`;
}

/**
 * Optional explicit Page id. When set, the callback must find this exact
 * Page among the admin's authorized Pages. When empty, authorization only
 * succeeds if the account manages exactly one Page.
 */
export function configuredPageId(): string {
  return (Deno.env.get('META_PAGE_ID') || '').trim();
}

export const PUBLISH_MAX_ATTEMPTS = 3;

/** Backoff schedule (minutes) applied between retry attempts. */
export const RETRY_BACKOFF_MINUTES = [2, 15, 60] as const;

/** Canonical hashtags appended only when the announcement lacks its own. */
export const DEFAULT_HASHTAGS = [
  '#MaiTroll',
  '#VirtualBroadcastingCity',
  '#LiveStreaming',
] as const;
