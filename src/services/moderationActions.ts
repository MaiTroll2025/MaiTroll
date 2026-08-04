import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isStaffProfile } from '@/lib/staff';

export type ModerationAction =
  | 'mute'
  | 'unmute'
  | 'disable_chat'
  | 'enable_chat'
  | 'kick'
  | 'arrest'
  | 'suspend_license'
  | 'grant_license'
  | 'remove_officer'
  | 'set_to_user'
  | 'end_stream'
  | 'background_check';

export interface ModerationEvidence {
  proof_type?: 'screenshot' | 'uploaded_image' | 'video_clip' | 'broadcast_timestamp' | 'existing_url' | 'written_notes';
  proof_url?: string;
  recording_timestamp?: string;
  notes?: string;
}

export interface ModerationActionParams {
  action: ModerationAction;
  streamId: string;
  targetUserId: string;
  reason?: string;
  evidence?: ModerationEvidence;
  durationMinutes?: number;
  idempotencyKey?: string;
}

export interface ModerationResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

function resolveModerationAuthority(profile: any): string {
  if (!profile) return 'unauthorized';

  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  if (profile.is_admin === true || role === 'admin') return 'admin';
  if (role === 'ceo' || profile.is_ceo === true) return 'ceo';
  if (role === 'lead_troll_officer' || profile.is_lead_officer === true) return 'lead_troll_officer';
  if (role === 'troll_officer' || profile.is_troll_officer === true) return 'troll_officer';
  if (role === 'broadcaster' || profile.is_broadcaster === true) return 'broadcaster';
  if (role === 'broadofficer' || profile.is_broadofficer === true) return 'broadofficer';

  return 'unauthorized';
}

function requiresProof(action: ModerationAction): boolean {
  return action === 'arrest';
}

function hasValidProof(evidence?: ModerationEvidence): boolean {
  if (!evidence) return false;
  if (evidence.proof_url && evidence.proof_url.trim().length > 0) return true;
  if (evidence.proof_type && evidence.proof_type !== 'written_notes') return true;
  if (evidence.recording_timestamp && evidence.recording_timestamp.trim().length > 0) return true;
  if (evidence.notes && evidence.notes.trim().length > 0) return true;
  return false;
}

function canRepeatLicenseSuspension(authority: string): boolean {
  return authority === 'ceo' || authority === 'admin' || authority === 'lead_troll_officer' || authority === 'troll_officer';
}

function canPerformModerationAction(
  authority: string,
  action: ModerationAction,
  isStreamOwner: boolean,
  isAssignedBroadofficer: boolean,
): boolean {
  switch (authority) {
    case 'ceo':
      return true;
    case 'admin':
      return action !== 'set_to_user' || true;
    case 'lead_troll_officer':
      return action !== 'set_to_user' && action !== 'grant_license';
    case 'troll_officer':
      return (
        action === 'mute' ||
        action === 'unmute' ||
        action === 'arrest' ||
        action === 'disable_chat' ||
        action === 'enable_chat' ||
        action === 'kick' ||
        action === 'suspend_license' ||
        action === 'background_check'
      );
    case 'broadcaster':
      return (
        isStreamOwner &&
        (action === 'mute' ||
          action === 'unmute' ||
          action === 'arrest' ||
          action === 'disable_chat' ||
          action === 'enable_chat' ||
          action === 'kick' ||
          action === 'suspend_license' ||
          action === 'remove_officer' ||
          action === 'end_stream' ||
          action === 'background_check')
      );
    case 'broadofficer':
      return (
        isAssignedBroadofficer &&
        (action === 'mute' ||
          action === 'unmute' ||
          action === 'arrest' ||
          action === 'disable_chat' ||
          action === 'enable_chat' ||
          action === 'kick' ||
          action === 'suspend_license' ||
          action === 'background_check')
      );
    default:
      return false;
  }
}

export async function performModerationAction(params: ModerationActionParams): Promise<ModerationResult> {
  const { profile } = useAuthStore.getState();
  const actorId = profile?.id;
  const authority = resolveModerationAuthority(profile);

  if (authority === 'unauthorized') {
    return { success: false, error: 'Unauthorized: no valid moderation authority' };
  }

  if (requiresProof(params.action) && !hasValidProof(params.evidence)) {
    return { success: false, error: 'Proof is required for arrest actions' };
  }

  if (!canPerformModerationAction(authority, params.action, false, false)) {
    return { success: false, error: `Action ${params.action} is not permitted for your authority level` };
  }

  const idempotencyKey = params.idempotencyKey || `${params.action}-${params.streamId}-${params.targetUserId}-${Date.now()}`;

  try {
    const { data, error } = await supabase.rpc('moderation_action', {
      p_action: params.action,
      p_stream_id: params.streamId,
      p_target_user_id: params.targetUserId,
      p_actor_id: actorId,
      p_reason: params.reason || '',
      p_evidence_type: params.evidence?.proof_type || null,
      p_evidence_url: params.evidence?.proof_url || null,
      p_recording_timestamp: params.evidence?.recording_timestamp || null,
      p_evidence_notes: params.evidence?.notes || null,
      p_duration_minutes: params.durationMinutes || null,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Moderation action failed' };
  }
}

export function getModerationAuthority(): string {
  const { profile } = useAuthStore.getState();
  return resolveModerationAuthority(profile);
}

export function moderationActionRequiresProof(action: ModerationAction): boolean {
  return requiresProof(action);
}

export function canRepeatSuspension(): boolean {
  const { profile } = useAuthStore.getState();
  const authority = resolveModerationAuthority(profile);
  return canRepeatLicenseSuspension(authority);
}