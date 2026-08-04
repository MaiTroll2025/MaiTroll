export type TroceanTeam = 'tide' | 'storm'
export type TroceanMatchStatus = 'lobby' | 'placement' | 'active' | 'paused' | 'completed' | 'cancelled'
export type TroceanAttackResult = 'miss' | 'takedown' | 'blocked'

export interface TroceanMatch {
  id: string
  name: string
  created_by: string
  status: TroceanMatchStatus
  visibility: 'public' | 'private'
  team_tide_name: string
  team_storm_name: string
  max_players: number
  players_per_team: number
  current_round: number
  current_turn_player_id: string | null
  turn_started_at: string | null
  turn_ends_at: string | null
  attack_cost: number
  takedown_reward: number
  winner_team: TroceanTeam | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface TroceanPlayer {
  id: string
  match_id: string
  user_id: string
  team: TroceanTeam
  team_slot: number
  username: string
  avatar_url: string | null
  is_ready: boolean
  is_connected: boolean
  is_eliminated: boolean
  takedowns: number
  attacks: number
  misses: number
  coins_spent: number
  coins_earned: number
}

export interface TroceanAttack {
  id: string
  match_id: string
  attacker_user_id: string
  target_tile: string
  result: TroceanAttackResult
  revealed_username: string | null
  coin_cost: number
  coin_reward: number
  round_number: number
  turn_number: number
  created_at: string
}

export interface TroceanTrump {
  id: string
  match_id: string
  trump_type: string
  visibility: 'public' | 'team' | 'player'
  team: TroceanTeam | null
  safe_message: string
  starts_at: string
  expires_at: string | null
}

export interface TroceanPublicState {
  match: TroceanMatch
  players: TroceanPlayer[]
  attacks: TroceanAttack[]
  trumps: TroceanTrump[]
  attacked_tiles: Array<{ tile: string; result: TroceanAttackResult; revealed_username?: string | null }>
  spectators: number
}

export interface TroceanPrivateState {
  player_id: string
  own_tile: string | null
  location_locked: boolean
  is_my_turn: boolean
  valid_actions: string[]
  private_clue: string | null
}

export const TROCEAN_COLUMNS = 'ABCDEFGHIJKL'.split('')
export const TROCEAN_ROWS = Array.from({ length: 12 }, (_, index) => index + 1)
export const TROCEAN_TILES = TROCEAN_ROWS.flatMap((row) => TROCEAN_COLUMNS.map((column) => `${column}${row}`))

export function formatTroceanCountdown(endsAt?: string | null): string {
  if (!endsAt) return '--:--'
  const remaining = Math.max(0, new Date(endsAt).getTime() - Date.now())
  const seconds = Math.floor(remaining / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
