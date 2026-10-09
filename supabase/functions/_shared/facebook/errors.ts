/**
 * Safe error handling for the Facebook publishing integration.
 *
 * Every Meta (or network) failure is reduced to a small, stable category
 * plus a human-readable message that is safe to show an administrator.
 * Access tokens, app secrets, request bodies and stack traces are NEVER
 * included in a category or a message.
 */

export type FacebookErrorCategory =
  | 'not_connected'
  | 'connection_needs_attention'
  | 'auth_error'
  | 'permission_error'
  | 'rate_limit'
  | 'page_not_found'
  | 'invalid_content'
  | 'invalid_media'
  | 'duplicate_post'
  | 'network_error'
  | 'meta_unavailable'
  | 'oauth_cancelled'
  | 'no_pages'
  | 'config_error'
  | 'ineligible_content'
  | 'unknown';

/** Categories where retrying cannot possibly help. */
const NON_RETRYABLE: ReadonlySet<FacebookErrorCategory> = new Set<FacebookErrorCategory>([
  'auth_error',
  'permission_error',
  'page_not_found',
  'invalid_content',
  'invalid_media',
  'ineligible_content',
  'oauth_cancelled',
  'no_pages',
  'config_error',
  'not_connected',
  'connection_needs_attention',
]);

/** Categories that indicate the stored Page connection is no longer usable. */
const DEGRADES_CONNECTION: ReadonlySet<FacebookErrorCategory> = new Set<FacebookErrorCategory>([
  'auth_error',
  'permission_error',
  'page_not_found',
]);

export function isRetryableCategory(category: FacebookErrorCategory): boolean {
  return !NON_RETRYABLE.has(category);
}

export function categoryNeedsReauthorization(category: FacebookErrorCategory): boolean {
  return DEGRADES_CONNECTION.has(category);
}

/** Administrator-facing copy per category. Never contains secrets. */
const ADMIN_MESSAGES: Record<FacebookErrorCategory, string> = {
  not_connected:
    'No Mai Troll Facebook Page is connected. Connect the Facebook Page to enable publishing.',
  connection_needs_attention:
    'Facebook publishing is unavailable because the Mai Troll Facebook Page connection needs to be reauthorized.',
  auth_error:
    'Facebook rejected the stored Page authorization. Reconnect the Mai Troll Facebook Page.',
  permission_error:
    'The Mai Troll Facebook Page authorization is missing the pages_manage_posts permission. Reconnect and accept all requested permissions.',
  rate_limit:
    'Facebook is rate limiting requests. Mai Troll will retry later instead of retrying immediately.',
  page_not_found:
    'The linked Facebook Page could not be found. It may have been deleted, or the admin lost access to it.',
  invalid_content:
    'Facebook rejected the post content. Review the announcement text and try again.',
  invalid_media:
    'Facebook rejected the attached image. The post can be retried without the image.',
  duplicate_post:
    'Facebook reported this content as already published.',
  network_error:
    'Mai Troll could not reach Facebook. This is usually temporary.',
  meta_unavailable:
    'Facebook is currently unavailable. Mai Troll will retry later.',
  oauth_cancelled: 'The Facebook authorization was cancelled.',
  no_pages:
    'The signed-in Facebook account does not administer a Page. Sign in with an account that manages the Mai Troll Page.',
  config_error:
    'The Facebook integration is not fully configured on the server. An administrator must complete the Meta setup.',
  ineligible_content:
    'This Mai Troll content is not eligible for Facebook publishing.',
  unknown: 'Facebook publishing failed for an unexpected reason.',
};

export function adminMessageForCategory(category: FacebookErrorCategory): string {
  return ADMIN_MESSAGES[category] ?? ADMIN_MESSAGES.unknown;
}

export interface FacebookFailure {
  category: FacebookErrorCategory;
  /** Safe to display to an administrator. */
  message: string;
  /** True when the same request may succeed later without changes. */
  retryable: boolean;
}

export function failure(
  category: FacebookErrorCategory,
  messageOverride?: string,
): FacebookFailure {
  return {
    category,
    message: messageOverride || adminMessageForCategory(category),
    retryable: isRetryableCategory(category),
  };
}

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
  };
  // OAuth token endpoint errors
  error_code?: number;
  error_message?: string;
  error_description?: string;
}

/**
 * Meta error code → category.
 * Reference: https://developers.facebook.com/docs/graph-api/guides/error-handling
 */
function categorizeMetaCode(code: number, subcode: number | undefined): FacebookErrorCategory {
  switch (code) {
    case 190: // access token expired / invalidated
    case 102: // session key invalid
    case 463:
    case 467:
      return 'auth_error';
    case 10: // permission denied
    case 200:
    case 299:
      return 'permission_error';
    case 4: // app-level rate limit
    case 17:
    case 32:
    case 613:
    case 80004: // page-level rate limit
      return 'rate_limit';
    case 100: // invalid parameter
      return subcode === 33 ? 'page_not_found' : 'invalid_content';
    case 506: // duplicate post
      return 'duplicate_post';
    case 803: // object does not exist / not accessible
      return 'page_not_found';
    case 368: // temporarily blocked for policy reasons
      return 'rate_limit';
    default:
      return 'unknown';
  }
}

export interface ClassifyInput {
  status: number;
  body: unknown;
}

/**
 * Turn a non-2xx Graph API response into a safe FacebookFailure.
 * `bodyText` is intentionally never surfaced: Meta echoes request details
 * (including tokens for some endpoints) in its error payloads.
 */
export function classifyMetaResponse({ status, body }: ClassifyInput): FacebookFailure {
  const parsed = (typeof body === 'object' && body !== null ? body : {}) as MetaErrorBody;
  const metaError = parsed.error;

  if (metaError) {
    const code = typeof metaError.code === 'number' ? metaError.code : -1;
    const subcode = typeof metaError.error_subcode === 'number' ? metaError.error_subcode : undefined;
    const category = categorizeMetaCode(code, subcode);
    if (metaError.is_transient === true && category === 'unknown') {
      return failure('meta_unavailable');
    }
    return failure(category);
  }

  // OAuth token exchange errors use a flat shape.
  const oauthCode = typeof parsed.error_code === 'number' ? parsed.error_code : undefined;
  if (oauthCode !== undefined) {
    if (oauthCode === 100) return failure('oauth_cancelled');
    return failure('auth_error');
  }

  if (status === 401 || status === 403) return failure('permission_error');
  if (status === 429) return failure('rate_limit');
  if (status >= 500) return failure('meta_unavailable');
  return failure('unknown');
}

/** Reduce any thrown value to a safe failure without leaking internals. */
export function classifyException(error: unknown): FacebookFailure {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return failure('network_error', 'The request to Facebook timed out.');
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowered = message.toLowerCase();

  if (
    lowered.includes('dns') ||
    lowered.includes('network') ||
    lowered.includes('connection') ||
    lowered.includes('fetch failed') ||
    lowered.includes('socket') ||
    lowered.includes('timed out') ||
    lowered.includes('timeout')
  ) {
    return failure('network_error');
  }

  return failure('unknown');
}
