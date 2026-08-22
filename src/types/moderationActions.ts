// ============================================================================
// Moderation Actions — shared TypeScript types + secure RPC helpers
// ============================================================================

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import type { Session } from '@supabase/supabase-js';

/**
 * The ONLY roles allowed to use Mod Actions.
 */
export const MOD_ACTIONS_ROLES = [
  'ceo',
  'admin',
  'lead_troll_officer',
  'troll_officer',
  'secretary',
  'broadcaster',
  'broadofficer',
  'ceo_assistant',
  'noah_assistant',
  'prosecutor',
  'attorney',
  'auctioneer',
  'pastor',
  'journalist',
  'news_caster',
  'chief_news_caster',
  'agency_leader',
  'agency_hr',
  'agency_hr_manager',
  'owner',
  'superadmin',
  'staff',
  'moderator',
  'judge',
  'court_officer',
  'president',
  'vice_president',
  'troller',
  'hr_admin',
  'officer',
] as const;

export type ModActionsRole = (typeof MOD_ACTIONS_ROLES)[number];

export type ModerationActionType =
  | 'mute'
  | 'unmute'
  | 'disable_chat'
  | 'kick'
  | 'arrest'
  | 'suspend_license'
  | 'grant_license'
  | 'remove_officer'
  | 'set_to_user'
  | 'end_stream';

export interface ModerationActionResult {
  success: boolean;
  code: string;
  message: string;
  data: Record<string, unknown> | null;
}

/**
 * Check whether a profile has one of the authorized Mod Actions roles.
 */
export function hasModActionsAccess(profile: {
  role?: string | null;
  troll_role?: string | null;
  is_admin?: boolean;
  is_lead_officer?: boolean;
  is_troll_officer?: boolean;
  is_secretary?: boolean;
  is_ceo?: boolean;
  is_ceo_assistant?: boolean;
  is_noah_assistant?: boolean;
  is_broadcaster?: boolean;
  is_broadofficer?: boolean;
} | null | undefined): boolean {
  if (!profile) return false;

  const normalizedRoles: string[] = [
    String(profile.role || '').toLowerCase(),
    String(profile.troll_role || '').toLowerCase(),
  ].filter(Boolean);

  const roleMatch = normalizedRoles.some((r) =>
    (MOD_ACTIONS_ROLES as readonly string[]).includes(r)
  );

  if (roleMatch) return true;

  return Boolean(
    (profile.is_admin === true && normalizedRoles.includes('admin')) ||
      (profile.is_ceo === true && normalizedRoles.includes('ceo')) ||
      (profile.is_lead_officer === true && normalizedRoles.includes('lead_troll_officer')) ||
      (profile.is_troll_officer === true && normalizedRoles.includes('troll_officer')) ||
      (profile.is_secretary === true && normalizedRoles.includes('secretary')) ||
      (profile.is_broadcaster === true && normalizedRoles.includes('broadcaster')) ||
      (profile.is_broadofficer === true && normalizedRoles.includes('broadofficer')) ||
      (profile.is_ceo_assistant === true && normalizedRoles.includes('ceo_assistant')) ||
      (profile.is_noah_assistant === true && normalizedRoles.includes('noah_assistant'))
  );
}

/**
 * Returns true when the acting user is a broadcaster or broadofficer.
 * These roles get mod actions but NOT the identity-management actions
 * (suspend_license, grant_license, set_to_user).
 */
export function isBroadcasterOrBroadofficer(profile: {
  role?: string | null;
  troll_role?: string | null;
  is_broadcaster?: boolean;
  is_broadofficer?: boolean;
} | null | undefined): boolean {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase()
  const trollRole = String(profile.troll_role || '').toLowerCase()
  return (
    role === 'broadcaster' ||
    trollRole === 'broadcaster' ||
    profile.is_broadcaster === true ||
    role === 'broadofficer' ||
    trollRole === 'broadofficer' ||
    profile.is_broadofficer === true
  )
}

// ============================================================================
// Direct RPC wrappers
// ============================================================================

export async function rpcModeratorMuteUser(
  streamId: string,
  targetUserId: string,
  durationMinutes: number,
  reason?: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('moderator_mute_user', {
    p_stream_id: streamId,
    p_target_user_id: targetUserId,
    p_duration_minutes: durationMinutes,
    p_reason: reason || `Muted for ${durationMinutes} minutes`,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModeratorUnmuteUser(
  streamId: string,
  targetUserId: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('moderator_unmute_user', {
    p_stream_id: streamId,
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModeratorDisableChat(
  streamId: string,
  targetUserId: string,
  durationMinutes: number,
  reason?: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('moderator_disable_chat', {
    p_stream_id: streamId,
    p_target_user_id: targetUserId,
    p_duration_minutes: durationMinutes,
    p_reason: reason || `Chat disabled for ${durationMinutes} minutes`,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModeratorKickUser(
  streamId: string,
  targetUserId: string,
  reason?: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('moderator_kick_user', {
    p_stream_id: streamId,
    p_target_user_id: targetUserId,
    p_reason: reason || 'Kicked by moderator',
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModoArrest(
  streamId: string,
  targetUserId: string,
  reason: string,
  severity: 'minor' | 'moderate' | 'serious' | 'severe',
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('modo_arrest', {
    p_stream_id: streamId,
    p_target_user_id: targetUserId,
    p_reason: reason,
    p_severity: severity,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }

  if (data && typeof data === 'object' && data.success) {
    const targetUsername = (data as any).target_username || 'User'
    const arrestedBy = (data as any).arrested_by_username || 'Staff'
    const { notifyAdminUserArrested } = await import('../lib/notifications')
    notifyAdminUserArrested(
      targetUserId,
      targetUsername,
      reason,
      severity,
      arrestedBy
    ).catch((e) => console.warn('[moderationActions] Failed to notify admins of arrest:', e))
  }

  return data as ModerationActionResult;
}

export async function rpcModoSuspendLicense(
  targetUserId: string,
  reason: string,
  durationHours: number,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('modo_suspend_license', {
    p_target_user_id: targetUserId,
    p_reason: reason,
    p_duration_hours: durationHours,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModoGrantLicense(
  targetUserId: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('modo_grant_license', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcRemoveStreamBroadofficer(
  streamId: string,
  officerId: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('remove_stream_broadofficer', {
    p_stream_id: streamId,
    p_officer_id: officerId,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcResetUserPermissions(
  targetUserId: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('reset_user_permissions', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcModoEndStream(
  streamId: string,
  targetBroadcasterId?: string,
  reason?: string,
  restrictDurationMinutes: number = 60,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('modo_end_stream', {
    p_stream_id: streamId,
    p_target_broadcaster_id: targetBroadcasterId || null,
    p_reason: reason || 'Ended by moderator',
    p_restrict_duration_minutes: restrictDurationMinutes,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

// ============================================================================
// Report RPC wrappers
// ============================================================================

export async function rpcSubmitReport(
  targetUserId: string | null,
  streamId: string | null,
  reason: string,
  description?: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_target_user_id: targetUserId,
    p_stream_id: streamId,
    p_reason: reason,
    p_description: description || null,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcListReports(
  statusFilter?: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('list_reports', {
    p_status_filter: statusFilter || null,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcRejectReport(
  reportId: string,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('reject_report', {
    p_report_id: reportId,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}

export async function rpcTakeAction(
  reportId: string | null,
  actionType: 'warn' | 'suspend_stream' | 'arrest',
  targetUserId: string | null,
  streamId: string | null,
  reason: string,
  actionDetails?: string,
  expiresAt?: string,
  banDurationHours?: number,
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.rpc('take_action', {
    p_report_id: reportId,
    p_action_type: actionType,
    p_target_user_id: targetUserId,
    p_stream_id: streamId,
    p_reason: reason,
    p_action_details: actionDetails || null,
    p_expires_at: expiresAt || null,
    p_ban_duration_hours: banDurationHours || null,
  });

  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message, data: null };
  }
  return data as ModerationActionResult;
}
