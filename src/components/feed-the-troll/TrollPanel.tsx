import { CASHOUT_TIERS } from '@/config/coinConfig';
import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type {
  TrollFeedState,
  TrollFeedLeaderboardEntry,
  TrollFeedTransaction,
  TrollFeedMilestoneConfig,
  TrollFeedMilestone,
  TrollFeedSettings,
  TrollFeedGiftTrain,
  TrollRealtimeEvent,
  TrollEvolutionStage,
  HallOfFameWindow,
} from '@/types/feedTheTroll';

interface TrollPanelProps {
  open: boolean;
  onClose: () => void;
  broadcasterId: string;
  streamId?: string | null;
  state: TrollFeedState | null;
  leaderboard: TrollFeedLeaderboardEntry[];
  recentFeedings: TrollFeedTransaction[];
  milestoneConfigs: TrollFeedMilestoneConfig[];
  milestones: TrollFeedMilestone[];
  settings: TrollFeedSettings | null;
  giftTrain: TrollFeedGiftTrain | null;
  lastEvent: TrollRealtimeEvent | null;
  battleMode?: boolean;
}

type Tab = 'status' | 'topGifters' | 'recent' | 'milestones' | 'hallOfFame';

const STAGE_LABEL: Record<TrollEvolutionStage, string> = {
  baby: 'Baby Troll',
  young: 'Young Troll',
  warrior: 'Warrior Troll',
  king: 'King Troll',
};

const fmt = (n: number) => Math.round(n).toLocaleString();

const TrollPanel: React.FC<TrollPanelProps> = ({
  open,
  onClose,
  broadcasterId: _broadcasterId,
  state,
  leaderboard,
  recentFeedings,
  milestoneConfigs,
  milestones,
  settings,
  giftTrain,
  lastEvent: _lastEvent,
  battleMode: _battleMode,
}) => {
  const [tab, setTab] = useState<Tab>('status');
  const [hofWindow, setHofWindow] = useState<HallOfFameWindow>('live');

  const cycleBalance = state?.current_cycle_balance ?? 0;

  const nextCashoutTier = useMemo(() => {
    return [...CASHOUT_TIERS].reverse().find((t) => cycleBalance < t.coins) ?? null;
  }, [cycleBalance]);

  const threshold = nextCashoutTier?.coins ?? settings?.cashout_threshold ?? 50000;
  const remaining = Math.max(0, threshold - cycleBalance);
  const progressPct = Math.min(100, (cycleBalance / threshold) * 100);

  const nextThreshold = useMemo(() => {
    // Next evolution threshold for the progress bar.
    const order: TrollEvolutionStage[] = ['baby', 'young', 'warrior', 'king'];
    const idx = order.indexOf(state?.evolution_stage ?? 'baby');
    const map: Record<TrollEvolutionStage, number> = { baby: 10000, young: 100000, warrior: 1000000, king: 1000000 };
    return map[order[Math.min(idx + 1, order.length - 1)]] ?? 1000000;
  }, [state?.evolution_stage]);

  const evolutionPct = state
    ? Math.min(100, (state.lifetime_fed_coins / nextThreshold) * 100)
    : 0;

  const completedMilestoneIds = useMemo(() => new Set(milestones.map((m) => m.milestone_id)), [milestones]);

  // Hall of Fame ranking (live = current leaderboard).
  const hofList = useMemo(() => {
    if (hofWindow === 'live' || hofWindow === 'lifetime') return leaderboard;
    // Weekly/monthly snapshots are persisted server-side; for live preview we
    // reuse the leaderboard sorted by eligible value.
    return [...leaderboard].sort((a, b) => b.total_eligible_value - a.total_eligible_value);
  }, [hofWindow, leaderboard]);

  const rankBadge = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[92vw] p-0 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30">
        <DialogTitle className="sr-only">Feed the Troll</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${
              state ? `troll-${state.evolution_stage}` : ''
            }`}
            style={{ background: 'rgba(124,179,66,0.25)' }}
          >
            🧌
          </div>
          <div className="flex-1">
            <div className="text-sm font-black text-white">
              {state ? STAGE_LABEL[state.evolution_stage] : 'Troll'} {state?.current_seasonal_theme ? `· ${state.current_seasonal_theme}` : ''}
            </div>
            <div className="text-[10px] text-cyan-300/80">
              Cycle #{state?.current_cycle_index ?? 1} · Fed {fmt(state?.total_feedings ?? 0)} times
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-2 pt-2 text-[11px] font-bold">
          {([
            ['status', 'Status'],
            ['topGifters', 'Top Gifters'],
            ['recent', 'Recent'],
            ['milestones', 'Milestones'],
            ['hallOfFame', 'Hall of Fame'],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
                tab === k ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {tab === 'status' && (
            <div className="space-y-3">
              <Stat label="Current feeding balance" value={`🪙 ${fmt(cycleBalance)}`} />
               <Stat label={nextCashoutTier ? `Until ${nextCashoutTier.name}` : 'Until next cashout'} value={`🪙 ${fmt(remaining)}`} highlight />
               <div>
                 <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                   <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progressPct}%` }} />
                 </div>
                 <div className="mt-1 text-[10px] text-slate-400">{nextCashoutTier ? `${progressPct.toFixed(1)}% to ${nextCashoutTier.name}` : `${progressPct.toFixed(1)}% to cashout`}</div>
               </div>
              <Stat label="Lifetime received" value={`🪙 ${fmt(state?.lifetime_fed_coins ?? 0)}`} />
              <Stat label="Total gifts fed" value={fmt(state?.total_feedings ?? 0)} />
              <Stat label="Unique feeders" value={fmt(state?.unique_feeders ?? 0)} />
              <Stat label="Last feeding" value={state?.last_fed_at ? new Date(state.last_fed_at).toLocaleString() : '—'} />
              <Stat label="Cashout cycle" value={`#${state?.current_cycle_index ?? 1} (${state?.cashout_count ?? 0} done)`} />

              <div className="rounded-lg border border-white/10 p-2">
                <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Evolution progress</span>
                  <span>{STAGE_LABEL[state?.evolution_stage ?? 'baby']}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-amber-400" style={{ width: `${evolutionPct}%` }} />
                </div>
              </div>

              {giftTrain && giftTrain.current_train_count >= 3 && (
                <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-[11px] text-amber-200">
                  🔥 Gift train x{giftTrain.current_train_count}! Largest this live: x{giftTrain.largest_train_this_live}
                </div>
              )}
            </div>
          )}

          {tab === 'topGifters' && (
            <div className="space-y-1.5">
              {leaderboard.length === 0 && <Empty text="No feeders yet — send a gift!" />}
              {leaderboard.slice(0, 25).map((e, i) => (
                <div key={e.sender_id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <span className="w-6 text-center text-sm">{rankBadge(i)}</span>
                  <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-slate-700">
                    {e.avatar_url && <img src={e.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{e.username ?? 'Troll Citizen'}</div>
                    <div className="text-[10px] text-slate-400">{e.feeding_count} feeds · biggest 🪙{fmt(e.largest_single_feed)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-cyan-300">🪙{fmt(e.total_troll_allocated)}</div>
                    <div className="text-[10px] text-slate-500">of 🪙{fmt(e.total_eligible_value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'recent' && (
            <div className="space-y-1.5">
              {recentFeedings.length === 0 && <Empty text="No recent feedings" />}
              {recentFeedings.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <span className="text-sm">{t.size_category === 'legendary' ? '🌟' : t.size_category === 'large' ? '🎁' : '🍖'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{t.gift_name ?? 'Gift'}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(t.created_at).toLocaleTimeString()} · 🪙{fmt(t.eligible_gift_value)} eligible
                    </div>
                  </div>
                  <div className="text-right text-xs font-black text-emerald-300">+{fmt(t.troll_allocation)}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'milestones' && (
            <div className="space-y-1.5">
              {milestoneConfigs.map((m) => {
                const done = completedMilestoneIds.has(m.id);
                return (
                  <div key={m.id} className={`rounded-lg border px-3 py-2 ${done ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {m.icon} {m.name}
                      </span>
                      <span className={`text-[10px] font-black ${done ? 'text-amber-300' : 'text-slate-400'}`}>{m.tier}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{m.description}</div>
                    <div className="mt-1 text-[10px] font-bold">{done ? '✅ Completed' : `Goal: ${fmt(m.requirement)}`}</div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'hallOfFame' && (
            <div>
              <div className="mb-2 flex gap-1 text-[10px] font-bold">
                {([
                  ['live', 'This Live'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                  ['lifetime', 'Lifetime'],
                ] as [HallOfFameWindow, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setHofWindow(k)}
                    className={`rounded-full px-2.5 py-1 ${hofWindow === k ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {hofList.slice(0, 25).map((e, i) => (
                  <div key={e.sender_id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <span className="w-6 text-center">{rankBadge(i)}</span>
                    <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-slate-700">
                      {e.avatar_url && <img src={e.avatar_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-white">{e.username ?? 'Troll Citizen'}</div>
                      <div className="text-[10px] text-slate-400">🪙{fmt(e.total_eligible_value)} sent</div>
                    </div>
                    <div className="text-right text-xs font-black text-amber-300">🪙{fmt(e.total_troll_allocated)}</div>
                  </div>
                ))}
                {hofList.length === 0 && <Empty text="No rankings yet" />}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
    <span className="text-[11px] text-slate-400">{label}</span>
    <span className={`text-xs font-black ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</span>
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-8 text-center text-xs text-slate-500">{text}</div>
);

export default TrollPanel;
