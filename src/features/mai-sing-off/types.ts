import type { UserProfile } from '@/lib/supabase'

export type SingOffStatus = 'setup' | 'scheduled' | 'active' | 'ended' | 'cancelled'

export type SingOffRole =
  | 'audience'
  | 'queue'
  | 'challenger'
  | 'host'
  | 'judge'
  | 'host_judge'
  | 'ceo_judge'

export type SingOffPosition =
  | 'challenger_a'
  | 'challenger_b'
  | 'judge_1'
  | 'judge_2'
  | 'judge_3'
  | 'judge_4'
  | 'host_stage'
  | 'host_judge'
  | 'ceo'
  | null

export type ChairId =
  | 'challenger_a'
  | 'challenger_b'
  | 'judge_1'
  | 'judge_2'
  | 'judge_3'
  | 'judge_4'
  | 'host_stage'
  | 'host_judge'
  | 'ceo'

export interface SingOffSession {
  id: string
  room_name: string
  host_id: string | null
  status: SingOffStatus
  title: string | null
  scheduled_at: string | null
  round_number: number
  config: Record<string, any>
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface SingOffParticipant {
  id: string
  session_id: string
  user_id: string
  role: SingOffRole
  position: SingOffPosition
  display_name: string | null
  avatar_url: string | null
  level: number | null
  troll_coins: number | null
  can_publish: boolean
  joined_at: string
  updated_at: string
}

export interface SingOffUser {
  user_id: string
  display_name: string
  avatar_url: string
  level: number
  troll_coins: number
  role: SingOffRole
  position: SingOffPosition
  can_publish: boolean
  is_kicked?: boolean
  is_muted?: boolean
  is_publishing?: boolean
  livekit_identity?: string | null
}

export type QueueStatus = 'waiting' | 'called' | 'countdown' | 'on_stage' | 'completed' | 'kicked' | 'left'

export interface SingOffQueueEntry {
  id: string
  session_id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  level: number | null
  troll_coins: number | null
  status: QueueStatus
  requested_position: 'challenger_a' | 'challenger_b' | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type RoundStatus = 'pending' | 'active' | 'completed'

export interface SingOffRound {
  id: string
  session_id: string
  round_number: number
  status: RoundStatus
  challenger_a_id: string | null
  challenger_b_id: string | null
  winner_id: string | null
  created_at: string
}

export type Decision = 'no' | 'yes' | 'mai_winner'

export interface SingOffDecision {
  id: string
  session_id: string
  round_id: string
  judge_id: string
  challenger_id: string
  decision: Decision
  created_at: string
}

export type JudgeAppStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type RoleApplicationType = 'judge' | 'host'

export interface SingOffJudgeApplication {
  id: string
  user_id: string
  status: JudgeAppStatus
  statement: string | null
  experience: string | null
  broadcasting_experience: string | null
  agreement: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SingOffRoleApplication {
  id: string
  user_id: string
  application_type: RoleApplicationType
  status: JudgeAppStatus
  statement: string | null
  experience: string | null
  broadcasting_experience: string | null
  agreement: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // profile snapshot (included in list RPCs)
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  level?: number | null
  troll_coins?: number | null
}

export interface SingOffJudgeRecord {
  user_id: string
  display_name?: string | null
  avatar_url?: string | null
  seat_index: number | null
  session_id: string | null
  is_active: boolean
}

export interface SingOffHostRecord {
  user_id: string
  display_name?: string | null
  avatar_url?: string | null
  session_id: string | null
  is_active: boolean
}

export interface ScheduledShow {
  id: string
  title: string | null
  room_name: string
  host_id: string | null
  scheduled_at: string | null
  status: SingOffStatus
  config: Record<string, any>
}

export type ChampionshipStatus = 'upcoming' | 'active' | 'completed'

export interface ChampionshipEntry {
  user_id: string
  status: string
  round_label: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export interface SingOffChampionship {
  id: string
  name: string
  status: ChampionshipStatus
  season_number: number | null
  grand_prize_coins: number
  grand_prize_description: string | null
  entries_limit: number
  bracket: Record<string, any>
  champion_user_id: string | null
  start_at: string | null
  end_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  entries?: ChampionshipEntry[]
}

export interface SingOffAuditLog {
  id: string
  actor_user_id: string | null
  target_user_id: string | null
  session_id: string | null
  action: string
  metadata: Record<string, any>
  created_at: string
}

export interface SingOffRevocationEvent {
  id: string
  user_id: string
  session_id: string | null
  kind: string
  reason: string | null
  payload: Record<string, any>
  created_at: string
}

export type UpcomingEventType = 'show' | 'championship'

export interface UpcomingEvent {
  event_type: UpcomingEventType
  event_id: string
  title: string
  status: string
  scheduled_at: string | null
  season_number: number | null
  grand_prize_coins: number | null
  grand_prize_description: string | null
  route: string
}

export interface ActiveRolesList {
  judges: SingOffJudgeRecord[]
  hosts: SingOffHostRecord[]
}

export interface SingOffStats {
  total_shows: number
  active_shows: number
  total_rounds: number
  top_winners: Array<{ user_id: string; wins: number }>
  my_wins: number
  my_judged: number
}

export interface SingOffAuthority {
  [x: string]: boolean
  is_staff: boolean
  is_host: boolean
  is_judge: boolean
  is_ceo: boolean
}

export interface SingOffSessionState {
  session: SingOffSession | null
  participants: SingOffUser[]
  queue: SingOffQueueEntry[]
  rounds: SingOffRound[]
  decisions: SingOffDecision[]
  authority: SingOffAuthority
}

export interface SingOffChatMessage {
  id: bigint | number
  session_id: string
  user_id: string | null
  sender_name: string
  body: string
  role_at_time: string | null
  is_gift: boolean
  gift_data: Record<string, any> | null
  created_at: string
}

export interface SingOffGiftEvent {
  sender_id: string
  sender_name: string
  recipient_id: string | null
  gift_id: string
  gift_name: string
  coins: number
  created_at: string
}

export type SingOffView =
  | 'stage'
  | 'chat'
  | 'queue'
  | 'judges'
  | 'stats'

export type SingOffLobbyView =
  | 'shows'
  | 'coins'
  | 'championship'
  | 'stats'
  | 'judges'
