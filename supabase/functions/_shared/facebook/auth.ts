/**
 * Server-side authorization for the Facebook publishing integration.
 *
 * This is the single gate every Facebook Edge Function passes through.
 * It never trusts a client-supplied role, user id or Page id: the caller's
 * JWT is verified against Supabase Auth, and the role is then read from
 * user_profiles using the service role.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface AuthorizedAdmin {
  userId: string;
  email: string | null;
  role: string;
  isAdmin: boolean;
  isStaff: boolean;
}

export interface AuthResult {
  ok: boolean;
  status: number;
  error?: string;
  code?: string;
  admin?: AuthorizedAdmin;
  /** Service-role client. Only returned on success so it cannot be used accidentally. */
  db?: SupabaseClient;
}

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'ceo', 'owner']);

const FACEBOOK_PUBLISHER_ROLES = new Set([
  'ceo',
  'secretary',
  'ceo_assistant',
  'noah_assistant',
  'marketing_agent',
]);

const MARKETING_PAGE_PUBLISHER_ROLES = new Set(['marketing_agent']);
const MARKETING_PAGE_ADMIN_ROLES = new Set(['admin', 'superadmin', 'owner']);

export function isFacebookAdminProfile(profile: {
  role?: string | null;
  troll_role?: string | null;
  is_admin?: boolean | null;
} | null): boolean {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();
  return profile.is_admin === true || ADMIN_ROLES.has(role) || ADMIN_ROLES.has(trollRole);
}

function readBearerToken(req: Request): string {
  const header = req.headers.get('Authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

export function adminClient(): SupabaseClient {
  const url = (Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!url || !serviceKey) {
    throw new Error('Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Authenticate the caller and require one of the supplied integration roles.
 *
 * Verification order (all server-side):
 *   1. Bearer token must be present.
 *   2. Token must resolve to a real Supabase Auth user.
 *   3. user_profiles row for that user must match an allowed publisher role
 *      or the administrator predicate.
 *
 * Ordinary users can never reach the Facebook integration because step 3
 * fails for them. No client-provided role is ever consulted.
 */
async function authorizeFacebookUser(
  req: Request,
  allowedRoles: ReadonlySet<string>,
  marketingPageOnly = false,
): Promise<AuthResult> {
  let db: SupabaseClient;
  try {
    db = adminClient();
  } catch (error) {
    console.error('[facebook-auth] Server misconfiguration', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return {
      ok: false,
      status: 500,
      code: 'server_configuration_missing',
      error: 'Facebook integration service is not configured.',
    };
  }

  const token = readBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'authentication_required',
      error: 'Missing authentication token',
    };
  }

  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false,
      status: 401,
      code: 'authentication_required',
      error: 'Invalid or expired authentication token',
    };
  }

  const userId = userData.user.id;

  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('id, role, troll_role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[facebook-auth] Profile lookup failed', {
      userId,
      message: profileError.message,
    });
    return {
      ok: false,
      status: 500,
      code: 'profile_lookup_failed',
      error: 'Unable to verify account permissions.',
    };
  }

  const role = String(profile?.role || '').toLowerCase();
  const trollRole = String(profile?.troll_role || '').toLowerCase();

  const isAdmin = isFacebookAdminProfile(profile);

  const isMarketingPageAdmin =
    profile?.is_admin === true ||
    MARKETING_PAGE_ADMIN_ROLES.has(role) ||
    MARKETING_PAGE_ADMIN_ROLES.has(trollRole);
  const isStaff = marketingPageOnly
    ? isMarketingPageAdmin || allowedRoles.has(role) || allowedRoles.has(trollRole)
    : isAdmin || allowedRoles.has(role) || allowedRoles.has(trollRole);

  if (!isStaff) {
    console.warn('[facebook-auth] Rejected unauthorized Facebook integration request', {
      userId,
      role: role || null,
      trollRole: trollRole || null,
    });
    return {
      ok: false,
      status: 403,
      code: 'insufficient_role',
      error: 'Your Mai Troll role is not authorized for this Facebook action.',
    };
  }

  return {
    ok: true,
    status: 200,
    db,
    admin: {
      userId,
      email: userData.user.email ?? null,
      role: role || 'admin',
      isAdmin,
      isStaff,
    },
  };
}

/** Facebook connection and global publishing settings are administrator-only. */
export function requireAdmin(req: Request): Promise<AuthResult> {
  return authorizeFacebookUser(req, new Set());
}

/** Contextual publish actions are available only to explicitly approved roles. */
export function requirePublisher(req: Request): Promise<AuthResult> {
  return authorizeFacebookUser(req, FACEBOOK_PUBLISHER_ROLES);
}

/** The Marketing page composer is intentionally narrower than contextual publishing. */
export function requireMarketingPagePublisher(req: Request): Promise<AuthResult> {
  return authorizeFacebookUser(req, MARKETING_PAGE_PUBLISHER_ROLES, true);
}

/**
 * Best-effort audit write using the service role.
 * Never throws and never records secrets.
 */
export async function recordFacebookAudit(
  db: SupabaseClient,
  entry: {
    admin: AuthorizedAdmin;
    actionType: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: Record<string, unknown>;
    result?: 'success' | 'denied' | 'error';
    errorMessage?: string;
  },
): Promise<void> {
  try {
    const { error } = await db.from('action_logs').insert({
      user_id: entry.admin.userId,
      data: {
        staff_user_id: entry.admin.userId,
        staff_role: entry.admin.role,
        staff_email: entry.admin.email,
        action_type: entry.actionType,
        action_category: 'admin',
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        target_name: entry.targetName ?? null,
        details: entry.details ?? {},
        route_path: '/admin/integrations/facebook',
        result: entry.result ?? 'success',
        error_message: entry.errorMessage ?? null,
      },
    });

    if (error) {
      console.warn('[facebook-audit] Failed to record audit entry', {
        actionType: entry.actionType,
        message: error.message,
      });
    }
  } catch (error) {
    console.warn('[facebook-audit] Audit exception', {
      actionType: entry.actionType,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
