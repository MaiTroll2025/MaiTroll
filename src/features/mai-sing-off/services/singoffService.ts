import { supabase } from '@/lib/supabase'
import { createNotification } from '@/lib/notifications'
import { OFFICIAL_GIFTS, GiftItem } from '@/lib/giftConstants'
import type {
  SingOffSession,
  SingOffUser,
  SingOffQueueEntry,
  SingOffRound,
  SingOffDecision,
  SingOffSessionState,
  SingOffChatMessage,
  SingOffGiftEvent,
  SingOffStats,
  ScheduledShow,
  SingOffRoleApplication,
  SingOffChampionship,
UpcomingEvent,
  ActiveRolesList,
} from '../types'

export type SingOffTokenMode = 'singoff-publisher' | 'singoff-viewer'

export interface SingOffTokenResponse {
  success: boolean
  token: string
  accessToken: string
  serverUrl: string
  roomName: string
}

export interface RpcResult {
  success: boolean
  error?: string
  session_id?: string
  room_name?: string
  round_number?: number
  round_id?: string
  winner_id?: string | null
  status?: string
  user_id?: string
  already?: boolean
  [key: string]: unknown
}

/** Fetch a LiveKit token for a Sing Off room. Reuses the livekit-token edge
 * function, which validates authorization server-side via
 * singoff_validate_token_access. */
export async function fetchSingOffToken(
  roomName: string,
  userId: string,
  userName: string,
  mode: SingOffTokenMode,
): Promise<SingOffTokenResponse | null> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      room: roomName,
      roomName,
      identity: userId,
      name: userName || 'User',
      role: mode === 'singoff-publisher' ? 'publisher' : 'audience',
      canPublish: mode === 'singoff-publisher',
      canSubscribe: true,
      mode,
    },
  })

  if (error) {
    console.error('[singoff] token fetch failed', error)
    return null
  }
  return data as SingOffTokenResponse
}

async function rpc(name: string, params: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, ...(data as Record<string, unknown>) }
}

/** CEO / staff create a new Sing Off session. */
export async function createSession(userId: string, config: Record<string, any> = {}) {
  const res = await rpc('singoff_create_session', { p_user_id: userId, p_config: config })
  if (!res.success) return res
  const { data } = await supabase
    .from('mai_singoff_sessions')
    .select('id, room_name, status, config')
    .eq('host_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { success: true, session_id: (data as any)?.id, room_name: (data as any)?.room_name }
}

export const startShow = (sessionId: string, userId: string) =>
  rpc('singoff_start_show', { p_session_id: sessionId, p_user_id: userId })

export const endShow = (sessionId: string, userId: string) =>
  rpc('singoff_end_show', { p_session_id: sessionId, p_user_id: userId })

export const joinSession = (sessionId: string, userId: string) =>
  rpc('singoff_join_session', { p_session_id: sessionId, p_user_id: userId })

export const assignPosition = (
  sessionId: string,
  targetUserId: string,
  position: string,
  role: string,
  assignerId: string,
) =>
  rpc('singoff_assign_position', {
    p_session_id: sessionId,
    p_target_user_id: targetUserId,
    p_position: position,
    p_role: role,
    p_assigner_id: assignerId,
  })

/** Role-based seat claim — a participant takes an eligible stage seat and
 * becomes a publisher for that box. Uses the server-authoritative assign
 * RPC so role + position + can_publish are all set in one call. */
export const claimSeat = (
  sessionId: string,
  targetUserId: string,
  position: string,
  role: string,
  assignerId: string,
) =>
  rpc('singoff_assign_position', {
    p_session_id: sessionId,
    p_target_user_id: targetUserId,
    p_position: position,
    p_role: role,
    p_assigner_id: assignerId,
  })

export const moveHost = (sessionId: string, hostUserId: string, targetPosition: string) =>
  rpc('singoff_move_host', { p_session_id: sessionId, p_host_user_id: hostUserId, p_target_position: targetPosition })

export const callToStage = (sessionId: string, userId: string, position: string, callerId: string) =>
  rpc('singoff_call_to_stage', { p_session_id: sessionId, p_user_id: userId, p_position: position, p_caller_id: callerId })

export const requestQueue = (
  sessionId: string,
  userId: string,
  displayName: string,
  avatarUrl: string,
  level: number,
  trollCoins: number,
  requestedPosition: string | null,
) =>
  rpc('singoff_request_queue', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_display_name: displayName,
    p_avatar_url: avatarUrl,
    p_level: level,
    p_troll_coins: trollCoins,
    p_requested_position: requestedPosition,
  })

export const updateQueueStatus = (sessionId: string, entryId: string, newStatus: string, updaterId: string) =>
  rpc('singoff_update_queue_status', { p_session_id: sessionId, p_entry_id: entryId, p_new_status: newStatus, p_updater_id: updaterId })

export const startRound = (sessionId: string, creatorId: string) =>
  rpc('singoff_start_round', { p_session_id: sessionId, p_creator_id: creatorId })

export const submitDecision = (
  sessionId: string,
  roundId: string,
  judgeId: string,
  challengerId: string,
  decision: 'no' | 'yes' | 'mai_winner',
  isMaiWinner = false,
) =>
  rpc('singoff_submit_decision', {
    p_session_id: sessionId,
    p_round_id: roundId,
    p_judge_id: judgeId,
    p_challenger_id: challengerId,
    p_decision: decision,
    p_is_mai_winner: isMaiWinner,
  })

export const maiWinner = (sessionId: string, roundId: string, judgeId: string, challengerId: string) =>
  rpc('singoff_mai_winner', { p_session_id: sessionId, p_round_id: roundId, p_judge_id: judgeId, p_challenger_id: challengerId })

export const endRound = (sessionId: string, roundId: string, closerId: string) =>
  rpc('singoff_end_round', { p_session_id: sessionId, p_round_id: roundId, p_closer_id: closerId })

export const kickUser = (sessionId: string, targetUserId: string, actorId: string) =>
  rpc('singoff_kick_user', { p_session_id: sessionId, p_target_user_id: targetUserId, p_actor_id: actorId })

export const applyJudge = (
  userId: string,
  statement: string,
  experience: string,
  broadcastingExperience: string,
  agreement: boolean,
) =>
  rpc('singoff_apply_judge', {
    p_user_id: userId,
    p_statement: statement,
    p_experience: experience,
    p_broadcasting_experience: broadcastingExperience,
    p_agreement: agreement,
  })

export const setJudgeStatus = (applicationId: string, assignerId: string, action: string, reason?: string) =>
  rpc('singoff_set_judge_status', { p_application_id: applicationId, p_assigner_id: assignerId, p_action: action, p_reason: reason || null })

export const updateConfig = (sessionId: string, userId: string, config: Record<string, any>) =>
  rpc('singoff_update_config', { p_session_id: sessionId, p_user_id: userId, p_config: config })

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export const scheduleShow = (
  userId: string,
  title: string,
  scheduledAt: string,
  config: Record<string, any> = {},
) =>
  rpc('singoff_schedule_show', {
    p_user_id: userId,
    p_title: title,
    p_scheduled_at: scheduledAt,
    p_config: config,
  })

export const updateScheduledShow = (
  sessionId: string,
  userId: string,
  title?: string | null,
  scheduledAt?: string | null,
) =>
  rpc('singoff_update_scheduled_show', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_title: title ?? null,
    p_scheduled_at: scheduledAt ?? null,
  })

export const cancelScheduledShow = (sessionId: string, userId: string) =>
  rpc('singoff_cancel_scheduled_show', { p_session_id: sessionId, p_user_id: userId })

export async function listScheduledShows(): Promise<ScheduledShow[]> {
  const { data, error } = await supabase.rpc('singoff_list_scheduled_shows')
  if (error) {
    console.error('[singoff] list scheduled shows failed', error)
    return []
  }
  return (data as ScheduledShow[]) ?? []
}

// ---------------------------------------------------------------------------
// Role applications (judge + host)
// ---------------------------------------------------------------------------

export const applyRole = (
  userId: string,
  applicationType: 'judge' | 'host',
  statement: string,
  experience: string,
  broadcastingExperience: string,
  agreement: boolean,
) =>
  rpc('singoff_apply_role', {
    p_user_id: userId,
    p_application_type: applicationType,
    p_statement: statement,
    p_experience: experience,
    p_broadcasting_experience: broadcastingExperience,
    p_agreement: agreement,
  })

export const reviewApplication = (
  applicationId: string,
  assignerId: string,
  action: 'approve' | 'reject' | 'suspend',
  reason?: string | null,
) =>
  rpc('singoff_review_application', {
    p_application_id: applicationId,
    p_assigner_id: assignerId,
    p_action: action,
    p_reason: reason ?? null,
  })

export const releaseRole = (
  targetUserId: string,
  role: 'judge' | 'host',
  assignerId: string,
  sessionId?: string | null,
  reason?: string | null,
) =>
  rpc('singoff_release_role', {
    p_user_id: targetUserId,
    p_role: role,
    p_assigner_id: assignerId,
    p_session_id: sessionId ?? null,
    p_reason: reason ?? null,
  })

export async function listRoleApplications(userId: string): Promise<SingOffRoleApplication[]> {
  const { data, error } = await supabase.rpc('singoff_list_role_applications', { p_user_id: userId })
  if (error) {
    console.error('[singoff] list role applications failed', error)
    return []
  }
  return (data as SingOffRoleApplication[]) ?? []
}

export async function listActiveRoles(userId: string): Promise<ActiveRolesList> {
  const { data, error } = await supabase.rpc('singoff_list_active_roles', { p_user_id: userId })
  if (error) {
    console.error('[singoff] list active roles failed', error)
    return { judges: [], hosts: [] }
  }
  const raw = (data as any) ?? {}
  return {
    judges: raw.judges ?? [],
    hosts: raw.hosts ?? [],
  }
}

// ---------------------------------------------------------------------------
// Championships
// ---------------------------------------------------------------------------

export const generateChampionship = (
  userId: string,
  name?: string | null,
  grandPrizeCoins?: number,
  grandPrizeDescription?: string | null,
  entriesLimit?: number,
) =>
  rpc('singoff_generate_championship', {
    p_user_id: userId,
    p_name: name ?? null,
    p_grand_prize_coins: grandPrizeCoins ?? 100000,
    p_grand_prize_description: grandPrizeDescription ?? null,
    p_entries_limit: entriesLimit ?? 16,
  })

export const editGrandPrize = (
  championshipId: string,
  userId: string,
  coins?: number | null,
  description?: string | null,
) =>
  rpc('singoff_edit_grand_prize', {
    p_championship_id: championshipId,
    p_user_id: userId,
    p_coins: coins ?? null,
    p_description: description ?? null,
  })

export const completeChampionship = (
  championshipId: string,
  userId: string,
  championUserId: string,
) =>
  rpc('singoff_complete_championship', {
    p_championship_id: championshipId,
    p_user_id: userId,
    p_champion_user_id: championUserId,
  })

export async function listChampionships(): Promise<SingOffChampionship[]> {
  const { data, error } = await supabase.rpc('singoff_list_championships')
  if (error) {
    console.error('[singoff] list championships failed', error)
    return []
  }
  return (data as SingOffChampionship[]) ?? []
}

// ---------------------------------------------------------------------------
// EPaper aggregated upcoming events
// ---------------------------------------------------------------------------

export async function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  const { data, error } = await supabase.rpc('singoff_get_upcoming_events')
  if (error) {
    console.error('[singoff] get upcoming events failed', error)
    return []
  }
  return (data as UpcomingEvent[]) ?? []
}

/** Load full session state (parsed from the singoff_get_session_state RPC). */
export async function loadSessionState(sessionId: string, userId: string): Promise<SingOffSessionState | null> {
  const { data, error } = await supabase.rpc('singoff_get_session_state', {
    p_session_id: sessionId,
    p_user_id: userId,
  })
  if (error) {
    console.error('[singoff] load state failed', error)
    return null
  }
  const raw = (data as any) ?? {}
  const parseArr = <T,>(v: any): T[] => (Array.isArray(v) ? v as T[] : [])
  return {
    session: raw.session ?? null,
    participants: parseArr<SingOffUser>(raw.participants),
    queue: parseArr<SingOffQueueEntry>(raw.queue),
    rounds: parseArr<SingOffRound>(raw.rounds),
    decisions: parseArr<SingOffDecision>(raw.decisions),
    authority: {
      is_staff: !!raw.is_staff,
      is_host: !!raw.is_host,
      is_judge: !!raw.is_judge,
      is_ceo: !!raw.is_ceo,
    },
  }
}

export async function loadStats(userId?: string): Promise<SingOffStats | null> {
  const { data, error } = await supabase.rpc('singoff_get_stats', { p_user_id: userId ?? null })
  if (error) {
    console.error('[singoff] stats failed', error)
    return null
  }
  return data as SingOffStats
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function sendChatMessage(
  sessionId: string,
  userId: string | null,
  senderName: string,
  body: string,
  role: string | null,
) {
  const { error } = await supabase.from('mai_singoff_chat').insert({
    session_id: sessionId,
    user_id: userId,
    sender_name: senderName,
    body,
    role_at_time: role,
    is_gift: false,
  })
  if (error) {
    console.error('[singoff] chat send failed', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export function subscribeChat(
  sessionId: string,
  onMessage: (msg: SingOffChatMessage) => void,
) {
  const channel = supabase
    .channel(`mai-singoff-chat:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mai_singoff_chat', filter: `session_id=eq.${sessionId}` },
      (payload) => onMessage((payload.new as any) as SingOffChatMessage),
    )
    .subscribe()
  return channel
}

// ---------------------------------------------------------------------------
// Gifts (server-authoritative coin transfer via spend_coins RPC)
// ---------------------------------------------------------------------------

export async function sendSingOffGift(
  sessionId: string,
  senderId: string,
  recipientId: string,
  gift: GiftItem,
  quantity = 1,
): Promise<RpcResult> {
  const coins = gift.cost * quantity
  const spend = await supabase.rpc('spend_coins', {
    p_sender_id: senderId,
    p_receiver_id: recipientId,
    p_coin_amount: coins,
    p_source: 'mai_singoff_gift',
    p_item: `${gift.name} (${quantity})`,
  })
  if (spend.error) {
    return { success: false, error: spend.error.message }
  }

  await supabase.from('mai_singoff_gifts').insert({
    session_id: sessionId,
    sender_id: senderId,
    receiver_id: recipientId,
    gift_id: gift.id,
    gift_name: gift.name,
    quantity,
    coins,
  })

// Realtime: broadcast to the show channel for chat line + popup
  const channel = supabase.channel(`mai-singoff:${sessionId}`) as any
  channel.broadcast(
    'gift_sent',
    { sender_id: senderId, recipient_id: recipientId, gift_id: gift.id, gift_name: gift.name, coins, quantity } as any,
  )
  return { success: true, coins }
}

export function subscribeGifts(sessionId: string, onGift: (gift: SingOffGiftEvent) => void) {
  const channel = supabase.channel(`mai-singoff:${sessionId}`)
  channel.on('broadcast', { event: 'gift_sent' }, (payload: any) => {
    onGift(payload.payload as SingOffGiftEvent)
  })
  return channel
}

export function broadcastMaiWinner(sessionId: string, challengerId: string, challengerName: string) {
  const channel = supabase.channel(`mai-singoff:${sessionId}`) as any
  channel.broadcast('mai_winner', { challenger_id: challengerId, challenger_name: challengerName } as any)
}

export function broadcastCountdown(sessionId: string, targetUserId: string, startAt: number) {
  const channel = supabase.channel(`mai-singoff:${sessionId}`) as any
  channel.broadcast('countdown_started', { target_user_id: targetUserId, start_at: startAt } as any)
}

export function broadcastKick(sessionId: string, targetUserId: string) {
  const channel = supabase.channel(`mai-singoff:${sessionId}`) as any
  channel.broadcast('user_kicked', { user_id: targetUserId } as any)
}

// ---------------------------------------------------------------------------
// Active shows (lobby)
// ---------------------------------------------------------------------------

export async function getActiveShows(limit = 20) {
  const { data, error } = await supabase
    .from('mai_singoff_sessions')
    .select('id, room_name, host_id, started_at, config, created_at')
    .eq('status', 'active')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[singoff] load shows failed', error)
    return []
  }
  return data as any[]
}

/** Gift catalog reused for the stage gift picker. */
export { OFFICIAL_GIFTS }
