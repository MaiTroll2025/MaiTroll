import React, { useState } from 'react';
import { Flame, Radio, Users, Clock, X, Swords } from 'lucide-react'
import { type ActiveBattle } from '../../../hooks/useActiveBattles';

function timeLeftLabel(endsAt: string | null, startedAt: string | null): string {
  const now = Date.now();
  let endMs: number | null = null;
  if (endsAt) endMs = new Date(endsAt).getTime();
  else if (startedAt) endMs = new Date(startedAt).getTime() + 180_000;
  if (!endMs) return '--:--';
  const secs = Math.max(0, Math.ceil((endMs - now) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function BattleCard({
  battle,
  onSelect,
}: {
  battle: ActiveBattle;
  onSelect: (b: ActiveBattle) => void;
}) {
  const cViewers = (battle.challenger?.viewer_count || 0) + (battle.opponent?.viewer_count || 0);
  const isRandom = battle.challenger?.battle_mode === 'random_queue' || battle.opponent?.battle_mode === 'random_queue';
  return (
    <button
      type="button"
      onClick={() => onSelect(battle)}
      className="group w-full text-left rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-purple-400/50 hover:bg-white/[0.06]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Swords size={13} className="shrink-0 text-purple-300" />
          <span className="truncate text-xs font-bold text-white/90">
            {battle.challenger?.title || 'Blue'}
          </span>
          <span className="text-white/30">vs</span>
          <span className="truncate text-xs font-bold text-white/90">
            {battle.opponent?.title || 'Red'}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">
          <Radio size={9} className="animate-pulse" /> Live
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/50">
        <span className="flex items-center gap-1">
          <Users size={11} /> {cViewers.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} /> {timeLeftLabel(battle.ends_at, battle.started_at)}
        </span>
        <span className="rounded bg-purple-500/15 px-1.5 py-0.5 font-bold uppercase text-purple-200">
          {isRandom ? 'Random' : 'Match'}
        </span>
      </div>
    </button>
  );
}

export default function ActiveBattlesPanel({
  battles,
  loading,
  currentBattleId: _currentBattleId,
  onSelectBattle,
  challengerName: _challengerName,
  opponentName: _opponentName,
  currentRole: _currentRole,
  viewerCount: _viewerCount,
}: {
  battles: ActiveBattle[];
  loading: boolean;
  currentBattleId?: string | null;
  onSelectBattle: (b: ActiveBattle) => void;
  challengerName?: string | null;
  opponentName?: string | null;
  currentRole?: string | null;
  viewerCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  const goToBattle = (b: ActiveBattle) => {
    onSelectBattle(b);
    setShowAll(false);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white/80">
            <Flame size={14} className="text-orange-400" /> Active Battles
          </h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
            {battles.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-hide">
          {loading && battles.length === 0 && (
            <div className="py-6 text-center text-xs text-white/40">Loading battles…</div>
          )}
          {!loading && battles.length === 0 && (
            <div className="py-6 text-center text-xs text-white/40">No live battles right now.</div>
          )}
          {battles.slice(0, 6).map((b) => (
            <BattleCard key={b.id} battle={b} onSelect={goToBattle} />
          ))}
        </div>

        {battles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2 w-full rounded-xl border border-purple-400/40 bg-purple-500/10 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
          >
            Browse All
          </button>
        )}
      </div>

      {/* Browse All modal / drawer */}
      {showAll && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowAll(false)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-white">
                <Swords size={16} className="text-purple-300" /> All Active Battles
              </h3>
              <button onClick={() => setShowAll(false)} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
              {battles.length === 0 && (
                <div className="py-10 text-center text-sm text-white/40">No live battles available.</div>
              )}
              {battles.map((b) => (
                <BattleCard key={b.id} battle={b} onSelect={goToBattle} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
