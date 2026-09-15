/**
 * Staff Action Logging Utility
 *
 * Logs every action performed by staff members to the `staff_action_audit_log` table.
 * This ensures a complete audit trail of all staff activity.
 *
 * Usage:
 *   import { logStaffAction, StaffActionType, StaffActionCategory } from '@/lib/logStaffAction';
 *
 *   await logStaffAction({
 *     actionType: StaffActionType.COIN_GRANT,
 *     actionCategory: StaffActionCategory.FINANCE,
 *     targetType: 'user',
 *     targetId: userId,
 *     targetName: username,
 *     details: { amount: 1000, reason: 'Promotional grant' },
 *     routePath: '/admin/grant-coins',
 *   });
 */

import { supabase } from './supabase';
import { useAuthStore } from './store';

// ─── Action Types ────────────────────────────────────────────
export enum StaffActionType {
  // Page views
  PAGE_VIEW = 'page_view',

  // Moderation
  USER_WARN = 'user_warn',
  USER_MUTE = 'user_mute',
  USER_JAIL = 'user_jail',
  USER_BAN = 'user_ban',
  USER_UNMUTE = 'user_unmute',
  USER_UNJAIL = 'user_unjail',
  USER_UNBAN = 'user_unban',
  MESSAGE_DELETE = 'message_delete',
  MESSAGE_FLAG = 'message_flag',

  // Finance
  COIN_GRANT = 'coin_grant',
  COIN_DEDUCT = 'coin_deduct',
  CASHOUT_APPROVE = 'cashout_approve',
  CASHOUT_REJECT = 'cashout_reject',
  CASHOUT_PROCESS = 'cashout_process',
  PAYOUT_PROCESS = 'payout_process',
  REFUND_ISSUE = 'refund_issue',

  // Admin
  ROLE_CHANGE = 'role_change',
  ROLE_GRANT = 'role_grant',
  ROLE_REVOKE = 'role_revoke',
  PERMISSION_CHANGE = 'permission_change',
  SYSTEM_CONFIG = 'system_config',
  MAINTENANCE_TOGGLE = 'maintenance_toggle',
  ANNOUNCEMENT_CREATE = 'announcement_create',
  NOTIFICATION_SEND = 'notification_send',
  DATA_EXPORT = 'data_export',

  // Court
  DOCKET_CREATE = 'docket_create',
  CHARGES_FILE = 'charges_file',
  SENTENCE_ISSUE = 'sentence_issue',
  APPEAL_REVIEW = 'appeal_review',
  BAIL_SET = 'bail_set',

  // Auction
  AUCTION_CREATE = 'auction_create',
  AUCTION_START = 'auction_start',
  AUCTION_END = 'auction_end',
  LOT_ADD = 'lot_add',
  LOT_REMOVE = 'lot_remove',
  BID_ACCEPT = 'bid_accept',

  // Stream
  STREAM_START = 'stream_start',
  STREAM_END = 'stream_end',
  STREAM_LOCKDOWN = 'stream_lockdown',
  STREAM_KICK = 'stream_kick',
  SEAT_ASSIGN = 'seat_assign',
  GHOST_MODE_TOGGLE = 'ghost_mode_toggle',

  // Marketplace
  LISTING_APPROVE = 'listing_approve',
  LISTING_REJECT = 'listing_reject',
  LISTING_REMOVE = 'listing_remove',
  SELLER_VERIFY = 'seller_verify',

  // Officer
  OFFICER_ASSIGN = 'officer_assign',
  OFFICER_SHIFT_CREATE = 'officer_shift_create',
  PATROL_LOG = 'patrol_log',

  // Church
  SERVICE_START = 'service_start',
  SERVICE_END = 'service_end',
  PRAYER_MANAGE = 'prayer_manage',

  // TCNN
  ARTICLE_PUBLISH = 'article_publish',
  ARTICLE_DELETE = 'article_delete',
  BROADCAST_START_TCNN = 'broadcast_start_tcnn',

  // General
  PROFILE_EDIT = 'profile_edit',
  SEARCH_USER = 'search_user',
  LOGIN_AS = 'login_as',
  ACCESS_DENIED = 'access_denied',
}

// ─── Action Categories ───────────────────────────────────────
export enum StaffActionCategory {
  MODERATION = 'moderation',
  FINANCE = 'finance',
  ADMIN = 'admin',
  COURT = 'court',
  AUCTION = 'auction',
  STREAM = 'stream',
  MARKETPLACE = 'marketplace',
  OFFICER = 'officer',
  CHURCH = 'church',
  TCNN = 'tcnn',
  HR = 'hr',
  GOVERNMENT = 'government',
  ACADEMY = 'academy',
  NAVIGATION = 'navigation',
}

// ─── Log Interface ───────────────────────────────────────────
export interface StaffActionLog {
  actionType: StaffActionType | string;
  actionCategory: StaffActionCategory | string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  routePath?: string;
  result?: 'success' | 'denied' | 'error';
  errorMessage?: string;
}

// ─── Core Logging Function ───────────────────────────────────
export async function logStaffAction(log: StaffActionLog): Promise<string | null> {
  try {
    const { profile } = useAuthStore.getState();
    if (!profile) return null;

    // Only log actions for staff members
    const staffRoles = new Set([
      'admin', 'superadmin', 'owner', 'ceo', 'staff',
      'lead_troll_officer', 'troll_officer', 'officer',
      'secretary', 'executive_secretary', 'troll_city_secretary',
      'prosecutor', 'attorney', 'judge', 'auctioneer',
      'pastor', 'journalist', 'ceo_assistant', 'noah_assistant',
      'president', 'vice_president', 'hr_admin', 'hr_manager',
      'agency_hr', 'agency_hr_manager', 'agency_leader',
      'marketing_readonly', 'empire_partner', 'notary', 'broadofficer',
      'academy_teacher', 'academy_director', 'admissions_officer',
      'temp_city_admin', 'temp_admin', 'moderator',
      'tcnn_news_caster', 'tcnn_chief_news_caster',
    ]);

    const role = String(profile.role || '').toLowerCase();
    const trollRole = String(profile.troll_role || '').toLowerCase();

    const isStaff =
      profile.is_admin ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      profile.is_secretary ||
      profile.is_prosecutor ||
      profile.is_attorney ||
      profile.is_ceo ||
      profile.is_officer ||
      (profile as any).is_superadmin ||
      (profile as any).is_journalist ||
      (profile as any).is_ceo_assistant ||
      (profile as any).is_noah_assistant ||
      (profile as any).is_pastor ||
      (profile as any).is_hr_admin ||
      (profile as any).is_agency_hr_manager ||
      (profile as any).is_agency_leader ||
      staffRoles.has(role) ||
      staffRoles.has(trollRole);

    if (!isStaff) return null;

    // Use RPC to log (server-side captures user identity securely)
    const { data, error } = await supabase.rpc('log_staff_action', {
      p_action_type: log.actionType,
      p_action_category: log.actionCategory,
      p_target_type: log.targetType || null,
      p_target_id: log.targetId || null,
      p_target_name: log.targetName || null,
      p_details: log.details || {},
      p_route_path: log.routePath || null,
      p_result: log.result || 'success',
      p_error_message: log.errorMessage || null,
    });

    if (error) {
      console.error('[StaffAudit] Failed to log action:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('[StaffAudit] Exception logging action:', err);
    return null;
  }
}

// ─── Convenience: Log Page View ──────────────────────────────
export async function logStaffPageView(routePath: string): Promise<string | null> {
  return logStaffAction({
    actionType: StaffActionType.PAGE_VIEW,
    actionCategory: StaffActionCategory.NAVIGATION,
    routePath,
    result: 'success',
  });
}

// ─── Convenience: Log Access Denied ──────────────────────────
export async function logStaffAccessDenied(
  routePath: string,
  requiredRole: string
): Promise<string | null> {
  return logStaffAction({
    actionType: StaffActionType.ACCESS_DENIED,
    actionCategory: StaffActionCategory.ADMIN,
    routePath,
    details: { requiredRole },
    result: 'denied',
  });
}

// ─── Permission Check with Logging ───────────────────────────
export async function checkAndLogPermission(
  resource: string,
  action: string
): Promise<boolean> {
  const { profile } = useAuthStore.getState();
  if (!profile) return false;

  const role = String(profile.role || '').toLowerCase();

  try {
    const { data, error } = await supabase.rpc('check_staff_permission', {
      p_role_name: role,
      p_resource: resource,
    });

    if (error) {
      console.error('[StaffAudit] Permission check failed:', error);
      // Fall back to hasRole
      return false;
    }

    // Log the permission check
    await logStaffAction({
      actionType: action,
      actionCategory: StaffActionCategory.ADMIN,
      details: { resource, permitted: data },
      result: data ? 'success' : 'denied',
    });

    return data as boolean;
  } catch (err) {
    console.error('[StaffAudit] Permission check exception:', err);
    return false;
  }
}
