import { supabase } from '../lib/supabase';
import type {
  AnswerResult,
  LeaderboardPeriod,
  LeaderboardRow,
  PublicRoom,
  RoomState,
  RoomVisibility,
} from '../lib/types';

const ERROR_TEXT: Record<string, string> = {
  not_signed_in: 'Sign in to play.',
  room_not_found: 'That lobby no longer exists.',
  room_full: 'This lobby is full.',
  room_already_started: 'This match has already started.',
  private_room: 'This lobby is private. Use its join code to enter.',
  invalid_code: 'No lobby matches that code.',
  not_a_member: 'You are no longer in this lobby.',
  not_host: 'Only the host can start the match.',
  not_enough_players: 'You need at least two players to start.',
  not_all_ready: 'Everyone has to be ready before the match starts.',
  auto_start_only: 'Quick matches start on their own countdown.',
  round_closed: 'Time is up for this question.',
  invalid_choice: 'That answer is not valid.',
  already_answered: 'Your answer is already locked in.',
  invalid_name: 'Give your lobby a name between 1 and 40 characters.',
  invalid_size: 'Pick between 2 and 12 players.',
  invalid_visibility: 'Choose a public or private lobby.',
  question_space_exhausted: 'The question bank is temporarily unavailable. Try again shortly.',
  insufficient_troll_coins: 'You are out of Troll Coins. Each answer costs 1 coin.',
};

const ERROR_CODES = Object.keys(ERROR_TEXT);

export class GameError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function toGameError(error: { message: string }): GameError {
  const code = ERROR_CODES.find((key) => error.message.includes(key)) ?? 'unknown';
  return new GameError(code, ERROR_TEXT[code] ?? 'Something went wrong. Please try again.');
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    throw toGameError(error);
  }
  return data as T;
}

export const gameApi = {
  createRoom: (name: string, visibility: Exclude<RoomVisibility, 'quick' | 'solo'>, maxPlayers: number) =>
    call<string>('mai_dk_create_room', { p_name: name, p_visibility: visibility, p_max_players: maxPlayers }),
  quickMatch: () => call<string>('mai_dk_quick_match'),
  createSoloMatch: () => call<string>('mai_dk_create_solo_match'),
  joinRoomById: (roomId: string) => call<string>('mai_dk_join_room_by_id', { p_room_id: roomId }),
  joinRoomByCode: (code: string) => call<string>('mai_dk_join_room_by_code', { p_code: code }),
  leaveRoom: (roomId: string) => call<void>('mai_dk_leave_room', { p_room_id: roomId }),
  setReady: (roomId: string, ready: boolean) => call<void>('mai_dk_set_ready', { p_room_id: roomId, p_ready: ready }),
  startMatch: (roomId: string) => call<void>('mai_dk_start_match', { p_room_id: roomId }),
  tickRoom: (roomId: string) => call<RoomState>('mai_dk_tick_room', { p_room_id: roomId }),
  submitAnswer: (roundId: string, choice: number) =>
    call<AnswerResult>('mai_dk_submit_answer', { p_round_id: roundId, p_choice: choice }),
  listPublicRooms: () => call<PublicRoom[]>('mai_dk_list_public_rooms'),
  getTrollCoinBalance: () => call<number>('mai_dk_get_troll_coin_balance'),
  getLeaderboard: (period: LeaderboardPeriod, limit = 25) =>
    call<LeaderboardRow[]>('mai_dk_get_leaderboard', { p_period: period, p_limit: limit }),
};

export function errorText(error: unknown): string {
  if (error instanceof GameError) {
    return error.message;
  }
  return 'Connection hiccup. Please try again.';
}
