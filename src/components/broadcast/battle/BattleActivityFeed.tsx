import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Swords, UserPlus, UserMinus, Zap, Trophy, Crown, Clock, MessageSquare } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SysEvent {
  id: string;
  type: string;
  message: string;
  team?: 'challenger' | 'opponent' | null;
  score?: number | null;
  ts: number;
}

function teamWord(team?: string | null) {
  if (team === 'challenger') return 'Blue';
  if (team === 'opponent') return 'Red';
  return '';
}

export default function BattleActivityFeed({
  battleId,
  challengerName: _challengerName,
  opponentName: _opponentName,
}: {
  battleId?: string | null;
  challengerName?: string | null;
  opponentName?: string | null;
}) {
  const [events, setEvents] = useState<SysEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const nameCache = useRef<Record<string, string>>({});
  const lastLeadRef = useRef<'challenger' | 'opponent' | 'tie'>('tie');
  const lastSuddenRef = useRef<boolean>(false);

  const addEvent = useCallback((evt: Omit<SysEvent, 'ts'>) => {
    if (seenRef.current.has(evt.id)) return;
    seenRef.current.add(evt.id);
    setEvents((prev) => [{ ...evt, ts: Date.now() }, ...prev].slice(0, 60));
  }, []);

  const lookupName = useCallback(async (userId: string): Promise<string> => {
    if (nameCache.current[userId]) return nameCache.current[userId];
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();
      const name = data?.username || userId.slice(0, 8);
      nameCache.current[userId] = name;
      return name;
    } catch {
      return userId.slice(0, 8);
    }
  }, []);

  useEffect(() => {
    if (!battleId) return;
    let mounted = true;

    // Seed: emit "Battle started" if battle is already live.
    (async () => {
      const { data } = await supabase
        .from('battles')
        .select('status, score_challenger, score_opponent, sudden_death')
        .eq('id', battleId)
        .maybeSingle();
      if (!mounted || !data) return;
      if (data.status === 'active' || data.status === 'starting' || data.status === 'ready') {
        addEvent({ id: `started:${battleId}`, type: 'battle_started', message: 'Battle started' });
      }
      if (data.sudden_death) lastSuddenRef.current = true;
      const lead =
        (data.score_challenger || 0) > (data.score_opponent || 0)
          ? 'challenger'
          : (data.score_opponent || 0) > (data.score_challenger || 0)
          ? 'opponent'
          : 'tie';
      lastLeadRef.current = lead;
    })();

    const battlesChannel = supabase
      .channel(`activity-battles:${battleId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = (payload.old as any) || {};
          if (newRow.status === 'ended' && oldRow.status !== 'ended') {
            const winnerTeam =
              newRow.winner_stream_id &&
              (newRow.winner_stream_id === (newRow.challenger_stream_id as string) ||
                newRow.winner_id === (newRow.challenger_stream_id as string))
                ? 'challenger'
                : 'opponent';
            addEvent({
              id: `ended:${battleId}:${newRow.updated_at || Date.now()}`,
              type: 'battle_ended',
              message: `Battle ended — ${teamWord(winnerTeam) || 'Winner'} wins!`,
              team: winnerTeam,
            });
          }
          if (newRow.sudden_death && !lastSuddenRef.current) {
            lastSuddenRef.current = true;
            addEvent({ id: `sudden:${battleId}:${newRow.updated_at || Date.now()}`, type: 'sudden_death', message: 'Sudden Death started!' });
          }
          const cs = Number(newRow.score_challenger || 0);
          const os = Number(newRow.score_opponent || 0);
          const lead = cs > os ? 'challenger' : os > cs ? 'opponent' : 'tie';
          if (lead !== 'tie' && lead !== lastLeadRef.current) {
            lastLeadRef.current = lead;
            addEvent({
              id: `lead:${battleId}:${cs}:${os}`,
              type: 'lead',
              message: `${teamWord(lead)} took the lead`,
              team: lead,
              score: lead === 'challenger' ? cs : os,
            });
          }
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`activity-participants:${battleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
        async (payload) => {
          const row = payload.new as any;
          if (row.role !== 'stage') return;
          const name = await lookupName(row.user_id);
          addEvent({
            id: `join:${battleId}:${row.user_id}:${row.seat_index ?? 0}`,
            type: 'seat_joined',
            message: `${name} joined the ${teamWord(row.team)} team`,
            team: row.team,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
        async (payload) => {
          const row = payload.old as any;
          if (row.role !== 'stage') return;
          const name = await lookupName(row.user_id);
          addEvent({
            id: `leave:${battleId}:${row.user_id}:${row.seat_index ?? 0}`,
            type: 'seat_left',
            message: `${name} left the ${teamWord(row.team)} team`,
            team: row.team,
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(battlesChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [battleId, addEvent, lookupName]);

  const iconFor = (type: string) => {
    switch (type) {
      case 'battle_started':
        return <Swords size={12} className="text-purple-300" />;
      case 'seat_joined':
        return <UserPlus size={12} className="text-emerald-300" />;
      case 'seat_left':
        return <UserMinus size={12} className="text-orange-300" />;
      case 'sudden_death':
        return <Zap size={12} className="text-red-300" />;
      case 'battle_ended':
        return <Trophy size={12} className="text-yellow-300" />;
      case 'lead':
        return <Crown size={12} className="text-amber-200" />;
      default:
        return <MessageSquare size={12} className="text-white/40" />;
    }
  };

  return (
    <div className="flex max-h-44 shrink-0 flex-col border-b border-white/10">
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/60">
        <Clock size={12} /> System Activity
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2 scrollbar-hide">
        {events.length === 0 && (
          <div className="py-2 text-center text-[11px] text-white/30">No battle events yet.</div>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            className={cn(
              'flex items-start gap-1.5 rounded-md border px-2 py-1 text-[11px]',
              e.type === 'battle_ended'
                ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-100'
                : e.type === 'sudden_death'
                ? 'border-red-400/30 bg-red-400/10 text-red-100'
                : e.team === 'challenger'
                ? 'border-blue-400/20 bg-blue-400/5 text-blue-100'
                : e.team === 'opponent'
                ? 'border-red-400/20 bg-red-400/5 text-red-100'
                : 'border-white/10 bg-white/[0.03] text-white/70'
            )}
          >
            <span className="mt-0.5 shrink-0">{iconFor(e.type)}</span>
            <span className="min-w-0 flex-1">{e.message}</span>
            <span className="shrink-0 text-[9px] text-white/30">
              {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
