// ============================================================
// State Battle Service
// ============================================================
// All Supabase RPC calls and queries for the State Battle system.
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  StateRow,
  StateMemberRow,
  StateBattleRow,
  StateLeaderboardEntry,
  StateBattleMatchResult,
  RecordStateBattleResult,
} from '@/types/stateBattle';

// ---- Queries ----

export async function fetchStates(): Promise<StateRow[]> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .order('battle_points', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStateByCode(stateCode: string): Promise<StateRow | null> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .eq('state_code', stateCode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchStateLeaderboard(limit = 50): Promise<StateLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_state_leaderboard', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

export async function fetchUserState(userId: string): Promise<StateMemberRow | null> {
  const { data, error } = await supabase
    .from('state_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchStateMembers(stateCode: string): Promise<StateMemberRow[]> {
  const { data, error } = await supabase
    .from('state_members')
    .select('*')
    .eq('state_code', stateCode)
    .order('battle_points_earned', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStateBattles(stateCode: string, limit = 20): Promise<StateBattleRow[]> {
  const { data, error } = await supabase
    .from('state_battles')
    .select('*')
    .or(`state_a.eq.${stateCode},state_b.eq.${stateCode}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ---- Mutations / RPCs ----

export async function assignUserToState(userId: string, stateCode: string): Promise<void> {
  const { error } = await supabase
    .from('state_members')
    .upsert({ user_id: userId, state_code: stateCode }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getUserStateRPC(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_state', { p_user_id: userId });
  if (error) throw error;

  if (data && typeof data === 'object') {
    if ('state_code' in data) {
      return (data as any).state_code ?? null;
    }
    if ('state' in data) {
      return (data as any).state ?? null;
    }
    return null;
  }

  return data ?? null;
}

export async function findStateBattleMatch(
  streamId: string,
  broadcasterId: string
): Promise<StateBattleMatchResult> {
  const { data, error } = await supabase.rpc('find_state_battle_match', {
    p_stream_id: streamId,
    p_broadcaster_id: broadcasterId,
  });
  if (error) throw error;
  return data as StateBattleMatchResult;
}

export async function recordStateBattle(params: {
  battleId: string;
  hostUserId: string;
  challengerUserId: string;
  winnerUserId: string;
  hostScore: number;
  challengerScore: number;
}): Promise<RecordStateBattleResult> {
  const { data, error } = await supabase.rpc('record_state_battle', {
    p_battle_id: params.battleId,
    p_host_user_id: params.hostUserId,
    p_challenger_user_id: params.challengerUserId,
    p_winner_user_id: params.winnerUserId,
    p_host_score: params.hostScore,
    p_challenger_score: params.challengerScore,
  });
  if (error) throw error;
  return data as RecordStateBattleResult;
}

// ---- Realtime subscriptions ----

export function subscribeToStateLeaderboard(callback: () => void) {
  const channel = supabase
    .channel('state-leaderboard-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'states' },
      () => callback()
    )
    .subscribe();
  return channel;
}

export function subscribeToStateBattles(stateCode: string, callback: () => void) {
  const channel = supabase
    .channel(`state-battles-${stateCode}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'state_battles',
        filter: `state_a=eq.${stateCode}`,
      },
      () => callback()
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'state_battles',
        filter: `state_b=eq.${stateCode}`,
      },
      () => callback()
    )
    .subscribe();
  return channel;
}
