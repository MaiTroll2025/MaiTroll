export type RoomVisibility = 'public' | 'private' | 'quick' | 'solo';
export type RoomStatus = 'waiting' | 'in_progress' | 'finished' | 'abandoned';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface RoomInfo {
  id: string;
  name: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  host_id: string;
  max_players: number;
  current_round: number;
  total_rounds: number;
  autostart_at: string | null;
  match_started_at: string | null;
  join_code: string | null;
}

export interface PlayerState {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_ready: boolean;
  score: number;
  connected: boolean;
  has_left: boolean;
  answered: boolean;
}

export interface RoundResult {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  choice: number;
  is_correct: boolean;
  points: number;
}

export interface RoundState {
  id: string;
  round_number: number;
  category: string;
  prompt: string;
  options: string[];
  status: 'open' | 'revealed';
  started_at: string;
  deadline_at: string;
  revealed_at: string | null;
  correct_index: number | null;
  my_choice: number | null;
  answered_count: number;
  results: RoundResult[] | null;
}

export interface RoomState {
  server_now: string;
  room: RoomInfo;
  players: PlayerState[];
  round: RoundState | null;
}

export interface PublicRoom {
  room_id: string;
  room_name: string;
  max_players: number;
  player_count: number;
  host_name: string;
  created_at: string;
}

export interface LeaderboardRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  matches_played: number;
  best_score: number;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';

export interface AnswerResult {
  accepted: boolean;
  is_correct?: boolean;
  points?: number;
  coins_spent?: number;
  coins_earned?: number;
  balance?: number;
  reason?: string;
}
