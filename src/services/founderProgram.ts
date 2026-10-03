/**
 * Mai Troll — Founder Program client service
 *
 * Thin, typed wrapper over the SECURITY DEFINER RPCs created in
 * supabase/migrations/2026100300000{0,1}_founder_program_*.sql
 *
 * SECURITY NOTE
 * -------------
 * Nothing here is a security boundary. Every RPC derives the actor from
 * auth.uid() on the server and re-verifies
 *     status = 'active' AND now() < end_at
 * before granting anything. These helpers exist for UI convenience only.
 * Never accept an actor id, role or multiplier from the client.
 */

import { supabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type FounderStatus = 'active' | 'expired' | 'removed' | 'suspended' | 'none';

export interface FounderPermissions {
  view_reports: boolean;
  arrest: boolean;
  release: boolean;
  summon: boolean;
  schedule_broadcast: boolean;
  chat: boolean;
}

export interface FounderMyStatus {
  success: boolean;
  code?: string;
  message?: string;
  is_founder: boolean;
  founder_status: FounderStatus;
  founder_id?: string;
  start_at?: string;
  end_at?: string;
  founder_start_date?: string;
  founder_end_date?: string;
  gift_multiplier?: number;
  cashout_multiplier?: number;
  founder_multiplier?: number;
  founder_cashout_multiplier?: number;
  days_remaining?: number;
  term_months?: number;
  notes?: string | null;
  created_at?: string;
  can_access_hub: boolean;
  is_admin_view?: boolean;
  permissions: FounderPermissions;
}

export interface FounderDirectoryEntry {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  start_at: string;
  end_at: string;
  gift_multiplier: number;
  cashout_multiplier: number;
  /**
   * True when this Founder is also an Admin. Admins never render the Founder
   * badge or gold username, in any container, on web or phone — their role
   * presentation already takes precedence. Their Founder economics still apply.
   */
  is_admin?: boolean;
}

export interface FounderMessage {
  id: string;
  sender_id: string;
  username: string;
  avatar_url?: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
}

/**
 * A Founder as returned by the chat read path. `founder_list_messages` returns a
 * lighter projection than the public directory, so the term fields are optional
 * here even though the directory always includes them.
 */
export interface FounderChatPeer {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  start_at?: string;
  end_at?: string;
  gift_multiplier: number;
  cashout_multiplier: number;
  is_me?: boolean;
  is_admin?: boolean;
}

export interface ScheduledFounderBroadcast {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  scheduled_for: string;
  duration_minutes?: number | null;
  category?: string | null;
  status: 'scheduled' | 'cancelled' | 'completed' | 'live' | 'expired';
  stream_id?: string | null;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
}

export interface FounderGiftReward {
  id: string;
  founder_user_id: string;
  founder_username: string;
  stream_id: string | null;
  stream_title: string;
  gift_name: string;
  gift_amount: number;
  base_creator_reward: number;
  founder_multiplier: number;
  founder_bonus: number;
  final_creator_reward: number;
  credited: boolean;
  reversed: boolean;
  created_at: string;
}

export interface FounderReport {
  report_id: string;
  reporter_id: string;
  reporter_username: string;
  reported_user_id?: string | null;
  reported_username: string;
  reason: string;
  description?: string | null;
  stream_id?: string | null;
  stream_title?: string | null;
  status: string;
  created_at: string;
}

export interface FounderActionRecord {
  id: string;
  action_type: string;
  founder_user_id?: string | null;
  founder_username?: string | null;
  target_user_id?: string | null;
  target_username?: string | null;
  report_id?: string | null;
  case_id?: string | null;
  scheduled_broadcast_id?: string | null;
  reason?: string | null;
  notes?: string | null;
  details?: Record<string, unknown> | null;
  status?: string;
  actor_role?: string | null;
  created_at: string;
}

export interface FounderRow {
  id: string;
  user_id: string;
  status: FounderStatus;
  start_at: string;
  end_at: string;
  gift_multiplier: number;
  cashout_multiplier: number;
  previous_role?: string | null;
  previous_troll_role?: string | null;
  created_at: string;
  updated_at?: string;
  removed_at?: string | null;
  removed_by?: string | null;
  removal_reason?: string | null;
  notes?: string | null;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  troll_role?: string | null;
  is_broadcaster?: boolean;
  days_remaining: number;
  is_active: boolean;
}

export interface FounderProgramSettings {
  program_enabled: boolean;
  capacity: number;
  active_count: number;
  default_duration_months: number;
  default_gift_multiplier: number;
  default_cashout_multiplier: number;
  allowed_multipliers: number[];
  min_multiplier: number;
  max_multiplier: number;
  allow_manual_expiration: boolean;
  notes?: string | null;
  updated_at?: string;
}

export interface FounderUserSearchResult {
  user_id: string;
  username: string;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  troll_role?: string | null;
  is_broadcaster?: boolean;
  is_verified?: boolean;
  created_at?: string;
  founder_status: FounderStatus;
  is_founder: boolean;
  /**
   * True when the candidate is an Admin. Admins can be granted Founder status
   * and keep the Founder economics, but the badge / gold username stays hidden.
   */
  is_admin?: boolean;
}

/** Normalised result used by every helper below. */
export interface FounderResult<T = Record<string, unknown>> {
  ok: boolean;
  code?: string;
  message: string;
  data?: T;
}

const ok = <T>(data: T, message = 'OK'): FounderResult<T> => ({ ok: true, message, data });
const fail = (message: string, code?: string): FounderResult<never> => ({
  ok: false,
  message: message || 'Something went wrong. Please try again.',
  code,
});

/**
 * Turns a Supabase/PostgREST error into a user-facing message.
 * Never leaks SQL text, schema names, or service-role details.
 */
function friendlyError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Something went wrong. Please try again.';
  const raw = (error.message || '').toLowerCase();

  if (raw.includes('row-level security') || raw.includes('rls') || raw.includes('permission denied')) {
    return 'You do not have permission to do that.';
  }
  if (raw.includes('jwt') || raw.includes('token') || raw.includes('signature')) {
    return 'Your session expired. Please sign in again.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Connection problem. Please check your connection and try again.';
  }
  if (error.code === 'PGRST116' || raw.includes('no rows')) {
    return 'That record could not be found.';
  }
  // Generic fallback: never echo raw database text to the user.
  return 'Something went wrong. Please try again.';
}

async function rpc<T = Record<string, unknown>>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<FounderResult<T>> {
  try {
    const { data, error } = await supabase.rpc(name, params);
    if (error) return fail(friendlyError(error), error.code);

    const payload = (data ?? {}) as Record<string, unknown>;

    if (payload.success === false) {
      return fail(
        typeof payload.message === 'string' ? payload.message : 'The action could not be completed.',
        typeof payload.code === 'string' ? payload.code : undefined,
      );
    }
    return ok(payload as T);
  } catch (error) {
    return fail(friendlyError(error as { message?: string }));
  }
}

/* -------------------------------------------------------------------------- */
/* Public / shared reads                                                       */
/* -------------------------------------------------------------------------- */

/** Active Founder directory — powers the gold username + Founder badge. */
export async function getFounderDirectory(): Promise<FounderDirectoryEntry[]> {
  try {
    const { data, error } = await supabase.rpc('founder_public_directory');
    if (error) return [];
    const founders = (data as { founders?: FounderDirectoryEntry[] } | null)?.founders;
    return Array.isArray(founders) ? founders : [];
  } catch {
    return [];
  }
}

export async function getMyFounderStatus(): Promise<FounderMyStatus | null> {
  const res = await rpc<FounderMyStatus & Record<string, unknown>>('founder_my_status');
  console.log('[founderProgram] getMyFounderStatus RPC raw response:', res);
  if (res.data) {
    console.log('[founderProgram] getMyFounderStatus data:', res.data);
  }
  return res.ok ? (res.data as FounderMyStatus) : null;
}

export async function getFounderHubAccess(): Promise<{
  can_access: boolean;
  is_active_founder: boolean;
  is_admin: boolean;
  founder_status: FounderStatus;
}> {
  try {
    const { data } = await supabase.rpc('founder_hub_access');
    console.log('[founderProgram] getFounderHubAccess RPC result:', data);
    return {
      can_access: Boolean((data as any)?.can_access),
      is_active_founder: Boolean((data as any)?.is_active_founder),
      is_admin: Boolean((data as any)?.is_admin),
      founder_status: ((data as any)?.founder_status ?? 'none') as FounderStatus,
    };
  } catch (error) {
    console.error('[founderProgram] getFounderHubAccess error:', error);
    return { can_access: false, is_active_founder: false, is_admin: false, founder_status: 'none' };
  }
}

/** Upcoming scheduled broadcast used by the profile banner (web + phone). */
export async function getUpcomingFounderBroadcast(userId: string): Promise<ScheduledFounderBroadcast | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc('founder_upcoming_broadcast', {
      p_user_id: userId,
    });
    if (error) return null;
    const broadcast = (data as { broadcast?: ScheduledFounderBroadcast | null } | null)?.broadcast;
    return broadcast ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Founder Chat                                                                */
/* -------------------------------------------------------------------------- */

export async function listFounderMessages(limit = 100, before?: string | null) {
  const res = await rpc<{ messages: FounderMessage[]; active_founders: FounderChatPeer[] }>(
    'founder_list_messages',
    { p_limit: limit, p_before: before ?? null },
  );
  return res.ok
    ? {
        ok: true as const,
        message: res.message,
        messages: res.data?.messages ?? [],
        founders: res.data?.active_founders ?? [],
      }
    : { ok: false as const, message: res.message, messages: [], founders: [] };
}

export async function sendFounderMessage(body: string) {
  return rpc<{ message_id: string; created_at: string }>('founder_send_message', {
    p_body: body,
  });
}

export async function markFounderMessagesRead() {
  return rpc<{ marked_read: number }>('founder_mark_messages_read');
}

export async function getFounderUnreadCount(): Promise<number> {
  try {
    const { data } = await supabase.rpc('founder_unread_count');
    return Number((data as any)?.unread ?? 0) || 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Broadcast scheduling                                                         */
/* -------------------------------------------------------------------------- */

export async function scheduleFounderBroadcast(input: {
  title: string;
  description?: string | null;
  scheduledFor: string;
  durationMinutes?: number | null;
  category?: string | null;
}) {
  return rpc<{ id: string; scheduled_for: string }>('founder_schedule_broadcast', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_scheduled_for: input.scheduledFor,
    p_duration_minutes: input.durationMinutes ?? null,
    p_category: input.category ?? null,
  });
}

export async function updateFounderScheduledBroadcast(input: {
  id: string;
  title?: string | null;
  description?: string | null;
  scheduledFor?: string | null;
  durationMinutes?: number | null;
  category?: string | null;
  reason?: string | null;
}) {
  return rpc<{ id: string }>('founder_update_scheduled_broadcast', {
    p_id: input.id,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_scheduled_for: input.scheduledFor ?? null,
    p_duration_minutes: input.durationMinutes ?? null,
    p_category: input.category ?? null,
    p_reason: input.reason ?? null,
  });
}

export async function cancelFounderScheduledBroadcast(id: string, reason?: string) {
  return rpc<{ id: string }>('founder_cancel_scheduled_broadcast', {
    p_id: id,
    p_reason: reason ?? null,
  });
}

export async function listMyFounderBroadcasts(): Promise<ScheduledFounderBroadcast[]> {
  try {
    const { data } = await supabase.rpc('founder_list_my_scheduled_broadcasts');
    const rows = (data as { broadcasts?: ScheduledFounderBroadcast[] } | null)?.broadcasts;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listFounderProgramSchedule(): Promise<ScheduledFounderBroadcast[]> {
  try {
    const { data } = await supabase.rpc('founder_list_program_schedule');
    const rows = (data as { broadcasts?: ScheduledFounderBroadcast[] } | null)?.broadcasts;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listFounderGiftRewards(limit = 250) {
  const res = await rpc<{ rewards: FounderGiftReward[] }>('founder_list_gift_rewards', {
    p_founder_user_id: null,
    p_limit: limit,
  });
  return res.ok
    ? { ok: true as const, message: res.message, rewards: res.data?.rewards ?? [] }
    : { ok: false as const, message: res.message, rewards: [] as FounderGiftReward[] };
}

/* -------------------------------------------------------------------------- */
/* Reports / arrests / releases / court                                        */
/* -------------------------------------------------------------------------- */

export async function listFounderReports(status: 'pending' | 'reviewing' = 'pending', limit = 50) {
  const res = await rpc<{ reports: FounderReport[] }>('founder_list_reports', {
    p_status: status,
    p_limit: limit,
  });
  return res.ok
    ? { ok: true as const, message: res.message, reports: res.data?.reports ?? [] }
    : { ok: false as const, message: res.message, reports: [] as FounderReport[] };
}

export async function logFounderReportView(reportId: string) {
  return rpc('founder_log_report_view', { p_report_id: reportId });
}

export async function founderArrestUser(input: {
  targetUserId: string;
  reason: string;
  reportId?: string | null;
  severity?: 'minor' | 'moderate' | 'serious' | 'severe';
  notes?: string | null;
}) {
  return rpc<{ jail_id: string; case_id: string; court_date: string; bail: number }>(
    'founder_arrest_user',
    {
      p_target_user_id: input.targetUserId,
      p_reason: input.reason,
      p_report_id: input.reportId ?? null,
      p_severity: input.severity ?? 'moderate',
      p_notes: input.notes ?? null,
    },
  );
}

export async function founderReleaseUser(input: {
  jailId: string;
  reason?: string | null;
  notes?: string | null;
}) {
  return rpc<{ jail_id: string; released_at: string }>('founder_release_user', {
    p_jail_id: input.jailId,
    p_reason: input.reason ?? null,
    p_notes: input.notes ?? null,
  });
}

/**
 * Resolve a user's current jail via the existing SECURITY DEFINER helper.
 * `founder_release_user` takes a jail id, so the Court Tools screen needs this
 * to offer "release by user".
 */
export async function getActiveJailForUser(userId: string): Promise<{
  is_jailed: boolean;
  jail_id: string | null;
  discipline_level: number | null;
  scheduled_release_at: string | null;
  bond_amount: number | null;
  bond_allowed: boolean | null;
} | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc('is_user_jailed', { p_user_id: userId });
    if (error) return null;
    const rows = (data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return {
      is_jailed: Boolean(rows[0].is_jailed),
      jail_id: (rows[0].jail_id as string | null) ?? null,
      discipline_level: (rows[0].discipline_level as number | null) ?? null,
      scheduled_release_at: (rows[0].scheduled_release_at as string | null) ?? null,
      bond_amount: (rows[0].bond_amount as number | null) ?? null,
      bond_allowed: (rows[0].bond_allowed as boolean | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function founderSummonToCourt(input: {
  targetUserId: string;
  reason: string;
  courtDate?: string | null;
  courtTime?: string | null;
  reportId?: string | null;
  caseType?: 'non_payment' | 'eviction' | 'lease_violation' | 'criminal' | 'civil';
  notes?: string | null;
}) {
  return rpc<{ case_id: string; docket_id: string; summons_id: string; court_date: string }>(
    'founder_summon_to_court',
    {
      p_target_user_id: input.targetUserId,
      p_reason: input.reason,
      p_court_date: input.courtDate ?? null,
      p_court_time: input.courtTime ?? null,
      p_report_id: input.reportId ?? null,
      p_case_type: input.caseType ?? 'civil',
      p_notes: input.notes ?? null,
    },
  );
}

export async function listMyFounderActions(limit = 100): Promise<FounderActionRecord[]> {
  try {
    const { data } = await supabase.rpc('founder_my_actions', { p_limit: limit });
    const rows = (data as { actions?: FounderActionRecord[] } | null)?.actions;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Coin economy                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cashout wrapper. Runs the EXISTING request_cashout (tiers, fees, weekly
 * limits, verification all still apply) and only then layers the Founder
 * multiplier on top of the request that already passed.
 */
export async function founderRequestCashout(input: {
  coinsToRedeem: number;
  providerType: string;
  providerUsername: string;
  userTag?: string | null;
  idVerificationUrl?: string | null;
}) {
  return rpc('founder_request_cashout', {
    p_coins_to_redeem: input.coinsToRedeem,
    p_provider_type: input.providerType,
    p_provider_username: input.providerUsername,
    p_user_tag: input.userTag ?? null,
    p_id_verification_url: input.idVerificationUrl ?? null,
  });
}

/** Public, traceable breakdown of a Founder gift reward. */
export interface FounderGiftBreakdown {
  gift_amount: number;
  base_creator_reward: number;
  founder_multiplier: number;
  founder_bonus: number;
  final_creator_reward: number;
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                        */
/* -------------------------------------------------------------------------- */

export async function adminListFounders(status?: 'active' | 'expired' | 'removed' | 'suspended' | null) {
  const res = await rpc<{ founders: FounderRow[]; capacity: number; active_count: number }>(
    'founder_admin_list',
    { p_status: status ?? null },
  );
  return res.ok
    ? {
        ok: true as const,
        message: res.message,
        founders: res.data?.founders ?? [],
        capacity: res.data?.capacity ?? 5,
        activeCount: res.data?.active_count ?? 0,
      }
    : {
        ok: false as const,
        message: res.message,
        founders: [] as FounderRow[],
        capacity: 5,
        activeCount: 0,
      };
}

export async function adminSearchFounderCandidates(query: string, limit = 25) {
  const res = await rpc<{ users: FounderUserSearchResult[] }>('founder_admin_search_users', {
    p_query: query ?? '',
    p_limit: limit,
    p_exclude_founders: true,
  });
  return res.ok ? (res.data?.users ?? []) : [];
}

export async function adminAddFounder(input: {
  userId: string;
  durationMonths?: number | null;
  giftMultiplier?: number | null;
  cashoutMultiplier?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  notes?: string | null;
  reason?: string | null;
}) {
  return rpc('founder_admin_add', {
    p_user_id: input.userId,
    p_duration_months: input.durationMonths ?? null,
    p_gift_multiplier: input.giftMultiplier ?? null,
    p_cashout_multiplier: input.cashoutMultiplier ?? null,
    p_start_at: input.startAt ?? null,
    p_end_at: input.endAt ?? null,
    p_notes: input.notes ?? null,
    p_reason: input.reason ?? null,
  });
}

export async function adminUpdateFounder(input: {
  founderId: string;
  giftMultiplier?: number | null;
  cashoutMultiplier?: number | null;
  endAt?: string | null;
  status?: FounderStatus | null;
  notes?: string | null;
  reason?: string | null;
}) {
  return rpc('founder_admin_update', {
    p_founder_id: input.founderId,
    p_gift_multiplier: input.giftMultiplier ?? null,
    p_cashout_multiplier: input.cashoutMultiplier ?? null,
    p_end_at: input.endAt ?? null,
    p_status: input.status ?? null,
    p_notes: input.notes ?? null,
    p_reason: input.reason ?? null,
  });
}

export async function adminRemoveFounder(founderId: string, reason: string) {
  return rpc('founder_admin_remove', {
    p_founder_id: founderId,
    p_reason: reason,
  });
}

export async function adminListFounderActions(filters: {
  founderUserId?: string | null;
  actionType?: string | null;
  targetUserId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
} = {}) {
  const res = await rpc<{ actions: FounderActionRecord[]; action_types: string[] }>(
    'founder_admin_list_actions',
    {
      p_founder_user_id: filters.founderUserId ?? null,
      p_action_type: filters.actionType ?? null,
      p_target_user_id: filters.targetUserId ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_limit: filters.limit ?? 200,
    },
  );
  return res.ok
    ? { ok: true as const, message: res.message, actions: res.data?.actions ?? [], actionTypes: res.data?.action_types ?? [] }
    : { ok: false as const, message: res.message, actions: [] as FounderActionRecord[], actionTypes: [] as string[] };
}

export async function adminGetFounderSettings(): Promise<FounderProgramSettings | null> {
  try {
    const { data } = await supabase.rpc('founder_admin_get_settings');
    return (data as { settings?: FounderProgramSettings } | null)?.settings ?? null;
  } catch {
    return null;
  }
}

export async function adminUpdateFounderSettings(input: {
  programEnabled?: boolean | null;
  capacity?: number | null;
  defaultDurationMonths?: number | null;
  defaultGiftMultiplier?: number | null;
  defaultCashoutMultiplier?: number | null;
  allowedMultipliers?: number[] | null;
  maxMultiplier?: number | null;
  allowManualExpiration?: boolean | null;
  notes?: string | null;
  /** Recorded in the Founder audit log alongside the new values. */
  reason?: string | null;
}) {
  return rpc('founder_admin_update_settings', {
    p_program_enabled: input.programEnabled ?? null,
    p_capacity: input.capacity ?? null,
    p_default_duration_months: input.defaultDurationMonths ?? null,
    p_default_gift_multiplier: input.defaultGiftMultiplier ?? null,
    p_default_cashout_multiplier: input.defaultCashoutMultiplier ?? null,
    p_allowed_multipliers: input.allowedMultipliers ?? null,
    p_max_multiplier: input.maxMultiplier ?? null,
    p_allow_manual_expiration: input.allowManualExpiration ?? null,
    p_notes: input.notes ?? null,
    p_reason: input.reason ?? null,
  });
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

export function formatMultiplier(value?: number | null): string {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return '1×';
  return `${n % 1 === 0 ? n : n.toFixed(2).replace(/0$/, '')}×`;
}

export function formatFounderDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatFounderDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Tonight at 8:00 PM" style label for the profile banner. */
export function formatScheduledWhen(value?: string | null): string {
  if (!value) return 'Scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Scheduled';

  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (sameDay) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;

  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (days > 0 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
}

export function founderStatusLabel(status?: FounderStatus | string | null): string {
  switch (status) {
    case 'active':
      return 'Founder Active';
    case 'expired':
      return 'Founder Program Expired';
    case 'removed':
      return 'Founder Status Removed';
    case 'suspended':
      return 'Founder Status Suspended';
    default:
      return 'Not a Founder';
  }
}

export const founderProgram = {
  getFounderDirectory,
  getMyFounderStatus,
  getFounderHubAccess,
  getUpcomingFounderBroadcast,
  listFounderMessages,
  sendFounderMessage,
  markFounderMessagesRead,
  getFounderUnreadCount,
  scheduleFounderBroadcast,
  updateFounderScheduledBroadcast,
  cancelFounderScheduledBroadcast,
  listMyFounderBroadcasts,
  listFounderProgramSchedule,
  listFounderReports,
  logFounderReportView,
  founderArrestUser,
  getActiveJailForUser,
  founderReleaseUser,
  founderSummonToCourt,
  listMyFounderActions,
  founderRequestCashout,
  adminListFounders,
  adminSearchFounderCandidates,
  adminAddFounder,
  adminUpdateFounder,
  adminRemoveFounder,
  adminListFounderActions,
  adminGetFounderSettings,
  adminUpdateFounderSettings,
};

export default founderProgram;