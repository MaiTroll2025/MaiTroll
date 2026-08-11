// ============================================================================
// Moderation Actions — shared TypeScript types + Edge Function helper
// Authorizes ONLY these roles for Mod Actions:
//   ceo, admin, lead_troll_officer, troll_officer, secretary,
//   broadcaster, broadofficer, ceo_assistant, noah_assistant
// ============================================================================

import { supabase } from '../lib/supabase';

/**
 * The ONLY roles allowed to use Mod Actions (frontend gating + backend).
 * Any account without one of these roles has NO access to Mod Actions.
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
] as const;

export type ModActionsRole = (typeof MOD_ACTIONS_ROLES)[number];

/**
 * Authorized action names accepted by the `moderation-actions` Edge Function.
 */
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

/**
 * Payload sent to the `moderation-actions` Edge Function.
 */
export interface ModerationActionPayload {
  action: ModerationActionType;
  /** uuid or null — required for stream-scoped actions */
  stream_id?: string | null;
  /** uuid or guest identifier (guests supported for kick) */
  target_user_id?: string | null;
  /** mute / disable_chat / restriction duration in minutes */
  duration_minutes?: number;
  /** license suspension duration in hours */
  duration_hours?: number;
  /** reason text (required for arrest / suspend_license / end_stream) */
  reason?: string;
  /** arrest severity: minor | moderate | serious | severe */
  severity?: 'minor' | 'moderate' | 'serious' | 'severe';
}

/**
 * Consistent result envelope returned by the Edge Function and the secure RPCs.
 */
export interface ModerationActionResult {
  success: boolean;
  code: string;
  message: string;
  data: Record<string, unknown> | null;
}

/**
 * Check whether a profile has one of the authorized Mod Actions roles.
 * Normalizes role values and supports boolean flag equivalents.
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

  // Boolean flag equivalents that map to the 9 authorized roles only.
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
 * Invoke the `moderation-actions` Edge Function with the given payload.
 * The Edge Function authenticates the caller (bearer token) and enforces
 * the role server-side. Returns a normalized ModerationActionResult.
 */
export async function invokeModerationAction(
  payload: ModerationActionPayload
): Promise<ModerationActionResult> {
  const { data, error } = await supabase.functions.invoke('moderation-actions', {
    body: payload,
  });

  if (error) {
    // If the function returned an HTTP error, surface a safe message.
    const raw = (error as any)?.context?.data;
    if (raw && typeof raw === 'object' && 'message' in raw) {
      return raw as ModerationActionResult;
    }
    return {
      success: false,
      code: 'FUNCTION_ERROR',
      message: error.message || 'Moderation action failed. Please try again.',
      data: null,
    };
  }

  if (!data || typeof data !== 'object') {
    return {
      success: false,
      code: 'INVALID_RESPONSE',
      message: 'The server returned an invalid response.',
      data: null,
    };
  }

  return data as ModerationActionResult;
}
