import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Radio,
  Clock,
  X,
  CheckCircle2,
  FileText,
  Gavel,
  Shield,
  Undo2,
  Send,
  Users,
  Gift,
  Wallet,
  Loader2,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  FounderMyStatus,
  FounderProgramSettings,
  FounderReport,
  FounderGiftReward,
  ScheduledFounderBroadcast,
  getMyFounderStatus,
  listMyFounderBroadcasts,
  scheduleFounderBroadcast,
  listFounderGiftRewards,
  listFounderReports,
  logFounderReportView,
  founderArrestUser,
  getActiveJailForUser,
  founderReleaseUser,
  founderSummonToCourt,
  cancelFounderScheduledBroadcast,
  formatScheduledWhen,
  formatFounderDate,
  founderStatusLabel,
} from '@/services/founderProgram';
import FounderBadge from '@/components/founder/FounderBadge';
import { FounderUpcomingBroadcastChip } from '@/components/founder/FounderScheduledBroadcastBanner';
import FounderAdminPanel from '@/components/founder/FounderAdminPanel';
import { useFounderChat } from '@/hooks/useFounderProgram';

type Tab = 'chat' | 'schedule' | 'rewards' | 'reports' | 'court' | 'settings' | 'admin';

const TABS: { id: Tab; label: string; icon: typeof Users; permission?: keyof FounderMyStatus['permissions'] }[] = [
  { id: 'chat', label: 'Founder Chat', icon: Users, permission: 'chat' },
  { id: 'schedule', label: 'My Broadcasts', icon: Radio, permission: 'schedule_broadcast' },
  { id: 'rewards', label: 'Gift Rewards', icon: Gift },
  { id: 'reports', label: 'Reports', icon: FileText, permission: 'view_reports' },
  { id: 'court', label: 'Court Tools', icon: Gavel, permission: 'summon' },
  { id: 'settings', label: 'Program', icon: Sparkles },
];

/** Admin-only tab. Mounted only when the DB reports admin, and every action
 *  inside is re-authorized server-side by the founder_admin_* RPCs. */
const ADMIN_TAB = {
  id: 'admin' as Tab,
  label: 'Manage Founders',
  icon: Settings2,
};

/* -------------------------------------------------------------------------- */
/*  Screens                                                                   */
/* -------------------------------------------------------------------------- */

function FounderChatScreen() {
  const { messages, founders, loading, sending, error, send } = useFounderChat(true);
  const [draft, setDraft] = useState('');
  const bottomRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    const ok = await send(body);
    if (!ok) {
      toast.error('Message could not be sent.');
      return;
    }
    setDraft('');
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/30">
      <div className="flex items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5">
        <Users size={14} className="text-yellow-400" />
        <p className="text-xs font-black uppercase tracking-widest text-yellow-300">
          Founder Chat
        </p>
        <span className="ml-auto text-[10px] font-bold text-white/40">
          {founders.length} founder{founders.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/5 px-3 py-2">
        {founders.map((founder) => (
          <div key={founder.user_id} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
            {founder.avatar_url ? (
              <img src={founder.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/15 text-[8px] font-black text-yellow-200">
                {founder.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-28 truncate text-[10px] font-bold text-white/60">@{founder.username}</span>
          </div>
        ))}
        {founders.length === 0 && (
          <span className="px-1 text-[10px] text-white/35">No active Founders yet</span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-yellow-400" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-white/40">
            No messages yet. Say hello to the other founders.
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.is_mine ? 'flex-row-reverse' : ''}`}
          >
            {m.avatar_url ? (
              <img src={m.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-[10px] font-black text-yellow-300">
                {m.username.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className={`max-w-[75%] ${m.is_mine ? 'text-right' : ''}`}>
              <div className={`mb-0.5 flex items-center gap-1.5 ${m.is_mine ? 'justify-end' : ''}`}>
                <span className="text-[10px] font-black text-white/70">@{m.username}</span>
                {!m.is_mine && <FounderBadge userId={m.sender_id} compact />}
                <span className="text-[9px] font-semibold text-white/30">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`inline-block rounded-2xl px-3.5 py-2 text-left text-sm ${
                  m.is_mine
                    ? 'rounded-tr-sm bg-gradient-to-br from-yellow-500 to-amber-600 font-semibold text-black'
                    : 'rounded-tl-sm bg-white/10 text-white'
                }`}
              >
                {m.body}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-yellow-500/20 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the founders..."
          maxLength={2000}
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-500/50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 text-black disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

function ScheduleFounderBroadcastForm({ onScheduled }: { onScheduled: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledFor, setScheduledFor] = useState(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    const when = new Date(scheduledFor);
    if (!Number.isFinite(when.getTime()) || when <= new Date()) {
      toast.error('Choose a future broadcast time.');
      return;
    }

    setSaving(true);
    const result = await scheduleFounderBroadcast({
      title: title.trim(),
      description: description.trim() || null,
      scheduledFor: when.toISOString(),
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      category: category.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success('Broadcast scheduled.');
    setTitle('');
    setDescription('');
    setCategory('');
    await onScheduled();
  };

  return (
    <form onSubmit={submit} className="mb-5 grid gap-3 rounded-2xl border border-red-500/20 bg-red-950/15 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="text-sm font-black text-white">Schedule a broadcast</h3>
        <p className="mt-0.5 text-xs text-white/40">Your scheduled broadcast will appear on your Founder profile.</p>
      </div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        Title
        <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-red-400/50" />
      </label>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        Start time
        <input required type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-red-400/50" />
      </label>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        Duration in minutes
        <input type="number" min={1} max={600} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-red-400/50" />
      </label>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        Category
        <input maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-red-400/50" />
      </label>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/45 sm:col-span-2">
        Description
        <textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 block w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-red-400/50" />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {saving ? 'Scheduling...' : 'Schedule Broadcast'}
        </button>
      </div>
    </form>
  );
}

function BroadcastScheduleScreen({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<ScheduledFounderBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listMyFounderBroadcasts());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCancel = async (row: ScheduledFounderBroadcast) => {
    if (!window.confirm(`Cancel "${row.title}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    const res = await cancelFounderScheduledBroadcast(row.id, 'Cancelled by Founder');
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Broadcast cancelled');
    await load();
    onChanged();
  };

  if (loading) {
    return (
      <>
        <ScheduleFounderBroadcastForm onScheduled={async () => { await load(); onChanged(); }} />
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-yellow-400" /></div>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        <ScheduleFounderBroadcastForm onScheduled={async () => { await load(); onChanged(); }} />
        <div className="rounded-2xl border border-dashed border-yellow-500/25 py-12 text-center">
          <Radio size={28} className="mx-auto mb-2 text-yellow-500/40" />
          <p className="text-sm font-bold text-white/60">No broadcasts scheduled</p>
        </div>
      </>
    );
  }

  const upcoming = rows.filter((r) => r.status === 'scheduled' || r.status === 'live');
  const past = rows.filter((r) => r.status !== 'scheduled' && r.status !== 'live');

  return (
    <div className="space-y-5">
      <ScheduleFounderBroadcastForm onScheduled={async () => { await load(); onChanged(); }} />
      {upcoming.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-widest text-red-400">Upcoming</h3>
          {upcoming.map((row) => (
            <FounderBroadcastRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/35">History</h3>
          {past.map((row) => (
            <FounderBroadcastRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function FounderBroadcastRow({
  row,
  busy,
  onCancel,
}: {
  row: ScheduledFounderBroadcast;
  busy?: boolean;
  onCancel?: (row: ScheduledFounderBroadcast) => void;
}) {
  const tone =
    row.status === 'cancelled'
      ? 'border-white/10 opacity-60'
      : row.status === 'completed'
        ? 'border-white/10'
        : 'border-red-500/30 bg-red-950/25';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {row.status === 'scheduled' && (
              <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                <Radio size={9} className="animate-pulse" /> Scheduled
              </span>
            )}
            {row.status === 'cancelled' && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/50">
                <X size={9} className="inline" /> Cancelled
              </span>
            )}
            {row.status === 'completed' && (
              <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                <CheckCircle2 size={9} className="inline" /> Completed
              </span>
            )}
            {row.status === 'expired' && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/50">
                Expired
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm font-black text-white">{row.title}</p>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Clock size={12} />
            {formatScheduledWhen(row.scheduled_for)}
          </p>

          {row.duration_minutes && (
            <p className="mt-0.5 text-[11px] font-semibold text-white/40">
              {row.duration_minutes} minute broadcast
              {row.category ? ` · ${row.category}` : ''}
            </p>
          )}

          {row.cancel_reason && row.status === 'cancelled' && (
            <p className="mt-1 text-[11px] italic text-white/35">Reason: {row.cancel_reason}</p>
          )}
        </div>

        {row.status === 'scheduled' && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(row)}
            disabled={busy}
            className="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-[10px] font-black uppercase text-red-300 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function GiftRewardsScreen() {
  const [rewards, setRewards] = useState<FounderGiftReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listFounderGiftRewards().then((result) => {
      if (!active) return;
      setRewards(result.rewards);
      setError(result.ok ? null : result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-yellow-400" /></div>;
  }

  if (error) {
    return <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  }

  if (!rewards.length) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/25 py-12 text-center">
        <Gift size={28} className="mx-auto mb-2 text-yellow-500/40" />
        <p className="text-sm font-bold text-white/60">No broadcast gift rewards yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rewards.map((reward) => (
        <article key={reward.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-300">
            <Gift size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {reward.gift_name} <span className="font-semibold text-white/45">on {reward.stream_title}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              @{reward.founder_username} · {formatFounderDate(reward.created_at)} · {reward.founder_multiplier}× reward
              {reward.reversed ? ' · reversed' : !reward.credited ? ' · pending' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-black ${reward.reversed ? 'text-white/40 line-through' : 'text-emerald-300'}`}>
              {reward.reversed ? '' : '+'}{reward.founder_bonus.toLocaleString()} coins
            </p>
            <p className="text-[10px] text-white/35">
              {reward.base_creator_reward.toLocaleString()} base · {reward.final_creator_reward.toLocaleString()} total
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportsScreen() {
  const [status, setStatus] = useState<'pending' | 'reviewing'>('pending');
  const [rows, setRows] = useState<FounderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listFounderReports(status, 50);
    setRows(res.reports);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = async (row: FounderReport) => {
    setExpanded(row.report_id);
    await logFounderReportView(row.report_id);
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['pending', 'reviewing'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
              status === s
                ? 'bg-yellow-500 text-black'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-yellow-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-yellow-500/25 py-12 text-center">
          <FileText size={28} className="mx-auto mb-2 text-yellow-500/40" />
          <p className="text-sm font-bold text-white/60">Queue is clear</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.report_id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <button
                type="button"
                onClick={() => (expanded === row.report_id ? setExpanded(null) : view(row))}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    @{row.reported_username}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-red-300">{row.reason}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/35">
                    Reported by @{row.reporter_username} ·{' '}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase text-white/30">
                  {expanded === row.report_id ? 'Hide' : 'View'}
                </span>
              </button>

              {expanded === row.report_id && (
                <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                  {row.description && (
                    <p className="text-xs leading-relaxed text-white/60">{row.description}</p>
                  )}
                  {row.stream_title && (
                    <p className="text-xs text-white/50">Stream: {row.stream_title}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/profile/id/${row.reported_user_id}`}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase text-white/70 hover:bg-white/10"
                    >
                      View Profile
                    </Link>
                    <ReportCourtActions report={row} onDone={load} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCourtActions({ report, onDone }: { report: FounderReport; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [jailed, setJailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (report.reported_user_id) {
      getActiveJailForUser(report.reported_user_id).then((jail) => {
        if (active) setJailed(Boolean(jail?.is_jailed));
      });
    }
    return () => {
      active = false;
    };
  }, [report.reported_user_id]);

  const act = async (kind: 'arrest' | 'summon' | 'release') => {
    const targetId = report.reported_user_id;
    if (!targetId) {
      toast.error('This report has no reported user.');
      return;
    }

    if (kind === 'arrest' && !window.confirm(`Arrest @${report.reported_username}?`)) return;
    if (kind === 'summon' && !window.confirm(`Summon @${report.reported_username} to court?`)) return;

    setBusy(true);

    let res;
    if (kind === 'arrest') {
      res = await founderArrestUser({
        targetUserId: targetId,
        reason: `Report: ${report.reason}`,
        reportId: report.report_id,
      });
    } else if (kind === 'summon') {
      res = await founderSummonToCourt({
        targetUserId: targetId,
        reason: `Report: ${report.reason}`,
        reportId: report.report_id,
      });
    } else {
      // Release is jail-scoped, so resolve the active jail first.
      const jail = await getActiveJailForUser(targetId);
      if (!jail?.jail_id) {
        setBusy(false);
        toast.error('That user is not currently jailed.');
        return;
      }
      res = await founderReleaseUser({ jailId: jail.jail_id, reason: 'Report resolved' });
    }

    setBusy(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      kind === 'arrest'
        ? 'User arrested'
        : kind === 'summon'
          ? 'Summoned to court'
          : 'User released',
    );
    onDone();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => act('arrest')}
        disabled={busy || jailed}
        title={jailed ? 'This user is already jailed' : undefined}
        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[10px] font-black uppercase text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        <Shield size={11} className="mr-1 inline" /> Arrest
      </button>
      <button
        type="button"
        onClick={() => act('summon')}
        disabled={busy}
        className="rounded-lg border border-purple-500/40 px-3 py-1.5 text-[10px] font-black uppercase text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
      >
        <Gavel size={11} className="mr-1 inline" /> Summon
      </button>
      <button
        type="button"
        onClick={() => act('release')}
        disabled={busy || !jailed}
        title={jailed ? undefined : 'This user is not currently jailed'}
        className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        <Undo2 size={11} className="mr-1 inline" /> Release
      </button>
    </>
  );
}

function CourtToolsScreen() {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; label: string }[]>([]);
  const [jail, setJail] = useState<{
    jail_id: string | null;
    scheduled_release_at: string | null;
  } | null>(null);

  // Release is jail-scoped, so look up the current jail as the user id changes.
  useEffect(() => {
    const id = userId.trim();
    if (!id) {
      setJail(null);
      return;
    }
    let active = true;
    getActiveJailForUser(id).then((j) => {
      if (active) setJail(j?.is_jailed ? j : null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const run = async (kind: 'arrest' | 'release' | 'summon') => {
    const id = userId.trim();
    if (!id) {
      toast.error('Enter a user ID.');
      return;
    }
    if (kind !== 'release' && !reason.trim()) {
      toast.error('A reason is required for this action.');
      return;
    }
    if (!window.confirm(`Confirm ${kind} for this user?`)) return;

    setBusy(true);

    let res;
    if (kind === 'arrest') {
      res = await founderArrestUser({ targetUserId: id, reason: reason.trim() });
    } else if (kind === 'summon') {
      res = await founderSummonToCourt({ targetUserId: id, reason: reason.trim() });
    } else {
      if (!jail?.jail_id) {
        setBusy(false);
        toast.error('That user is not currently jailed.');
        return;
      }
      res = await founderReleaseUser({
        jailId: jail.jail_id,
        reason: reason.trim() || 'Released by Founder',
      });
    }

    setBusy(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${kind} complete`);
    setResult(Object.entries(res.data ?? {}).map(([k, v]) => ({ id: k, label: String(v) })));
    setReason('');
    if (kind === 'arrest') setJail({ jail_id: null, scheduled_release_at: null });
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-300">
          <AlertTriangle size={13} /> Founder court authority
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/50">
          Founders may place troll users in jail, release them, and summon them to Troll Court.
          Every action is written to the Founder audit log with your user ID and cannot be
          edited or deleted. You cannot act on Admins, Troll Officers, or other Founders.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
          User ID
        </label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Paste the user ID"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-500/50"
        />
        {jail?.jail_id && (
          <p className="mt-1.5 text-[11px] font-bold text-emerald-300">
            Currently jailed
            {jail.scheduled_release_at
              ? ` · scheduled release ${new Date(jail.scheduled_release_at).toLocaleString()}`
              : ''}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why is this action being taken?"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-500/50"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run('arrest')}
          disabled={busy || Boolean(jail?.jail_id)}
          title={jail?.jail_id ? 'This user is already jailed' : undefined}
          className="rounded-xl bg-gradient-to-br from-red-600 to-red-800 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          <Shield size={13} className="mr-1.5 inline" /> Arrest
        </button>
        <button
          type="button"
          onClick={() => run('summon')}
          disabled={busy}
          className="rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          <Gavel size={13} className="mr-1.5 inline" /> Summon to Court
        </button>
        <button
          type="button"
          onClick={() => run('release')}
          disabled={busy || !jail?.jail_id}
          title={jail?.jail_id ? undefined : 'This user is not currently jailed'}
          className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          <Undo2 size={13} className="mr-1.5 inline" /> Release
        </button>
      </div>

      {result.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Result
          </p>
          {result.map((r) => (
            <p key={r.id} className="mt-1 break-all font-mono text-[11px] text-white/60">
              {r.id}: {r.label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramScreen({ status }: { status: FounderMyStatus }) {
  const [settings, setSettings] = useState<FounderProgramSettings | null>(null);

  useEffect(() => {
    // Settings are RLS-readable by any authenticated user and hold no secrets
    // (capacity, defaults, allowed multipliers).
    let active = true;

    void (async () => {
      try {
        const { data } = await supabase
          .from('founder_program_settings')
          .select(
            'program_enabled, capacity, default_duration_months, default_gift_multiplier, default_cashout_multiplier, allowed_multipliers, min_multiplier, max_multiplier',
          )
          .eq('id', true)
          .maybeSingle();

        if (active && data) {
          setSettings({ ...(data as FounderProgramSettings), active_count: 0 });
        }
      } catch {
        /* settings are informational — the hub works without them */
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const perks = [
    {
      icon: Gift,
      label: 'Stream gift rewards',
      value: `${status.gift_multiplier ?? 1}× creator earnings`,
    },
    {
      icon: Wallet,
      label: 'Cashout rate',
      value: `${status.cashout_multiplier ?? 1}× on your normal rate`,
    },
    { icon: Radio, label: 'Scheduled broadcasts', value: 'Promoted on your profile' },
    { icon: Users, label: 'Founder Chat', value: 'Private founder-only channel' },
    { icon: Shield, label: 'Moderation tools', value: 'Arrest, release, court summons' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {perks.map((p) => (
          <div
            key={p.label}
            className="flex items-start gap-3 rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4"
          >
            <p.icon size={18} className="mt-0.5 shrink-0 text-yellow-400" />
            <div className="min-w-0">
              <p className="text-xs font-black text-white">{p.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/45">{p.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-white/45">
          Your term
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Started</p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {formatFounderDate(status.founder_start_date ?? status.start_at)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Ends</p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {formatFounderDate(status.founder_end_date ?? status.end_at)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Days left</p>
            <p className="mt-0.5 text-sm font-bold text-amber-300">
              {status.days_remaining ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {settings && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/45">
            Program details
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
                Standard term
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {settings.default_duration_months} months
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
                Founder slots
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">{settings.capacity}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
                Default multipliers
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {settings.default_gift_multiplier}× / {settings.default_cashout_multiplier}×
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] italic text-white/25">
        Founder status does not change your account role. You keep every permission you already
        had.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function FounderHub() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<FounderMyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [upcoming, setUpcoming] = useState<ScheduledFounderBroadcast | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getMyFounderStatus();
    console.log('[FounderHub] getMyFounderStatus result:', s);
    if (s) {
      console.log('[FounderHub] getMyFounderStatus - is_admin_view:', s.is_admin_view);
      console.log('[FounderHub] getMyFounderStatus - can_access_hub:', s.can_access_hub);
      console.log('[FounderHub] getMyFounderStatus - founder_status:', s.founder_status);
      console.log('[FounderHub] getMyFounderStatus - permissions:', s.permissions);
    }
    setStatus(s);
    setUpcoming(s ? await listMyFounderBroadcasts().then((r) => r.find((b) => b.status === 'scheduled') ?? null) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!status) return;

    console.log('[FounderHub] status:', status);
    console.log('[FounderHub] is_admin_view:', status.is_admin_view);
    console.log('[FounderHub] can_access_hub:', status.can_access_hub);
    console.log('[FounderHub] founder_status:', status.founder_status);
    console.log('[FounderHub] permissions:', status.permissions);

    // Debug: call the hub access function directly
    supabase.rpc('founder_hub_access').then(({ data, error }) => {
      console.log('[FounderHub] founder_hub_access RPC result:', { data, error });
    });

    // Debug: call can_manage_founders directly
    supabase.rpc('can_manage_founders').then(({ data, error }) => {
      console.log('[FounderHub] can_manage_founders RPC result:', { data, error });
    });

    // Debug: call founder_user_is_admin directly
    if (user?.id) {
      supabase.rpc('founder_user_is_admin', { p_user_id: user.id }).then(({ data, error }) => {
        console.log('[FounderHub] founder_user_is_admin RPC result:', { data, error });
      });
    }

    // Debug: check user profile
    if (user?.id) {
      supabase.from('user_profiles').select('id, username, role, troll_role, is_admin, is_superadmin').eq('id', user.id).single().then(({ data, error }) => {
        console.log('[FounderHub] user_profiles:', { data, error });
      });
    }

    // Debug: check founder record
    if (user?.id) {
      supabase.from('founders').select('*').eq('user_id', user.id).then(({ data, error }) => {
        console.log('[FounderHub] founders table:', { data, error });
      });
    }

    // Debug: check program settings
    supabase.from('founder_program_settings').select('*').eq('id', true).single().then(({ data, error }) => {
      console.log('[FounderHub] founder_program_settings:', { data, error });
    });

    // Admins land on Founder management even when they also hold Founder status.
    if (status.is_admin_view) {
      setTab('admin');
      return;
    }
    if (status.can_access_hub) {
      const first = TABS.find((t) => !t.permission || status?.permissions?.[t.permission]);
      if (first) setTab(first.id);
    }
  }, [status, user]);

  const isAdmin = Boolean(status?.is_admin_view);

  const visibleTabs = useMemo(() => {
    const base = TABS.filter((t) => !t.permission || status?.permissions?.[t.permission]);
    console.log('[FounderHub] visibleTabs base:', base);
    console.log('[FounderHub] isAdmin:', isAdmin);
    const result = isAdmin ? [...base, ADMIN_TAB] : base;
    console.log('[FounderHub] visibleTabs final:', result);
    return result;
  }, [status, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-yellow-400" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Sparkles size={34} className="mx-auto mb-3 text-yellow-500/40" />
        <h1 className="text-xl font-black text-white">Sign in to view the Founder Hub</h1>
      </div>
    );
  }

  console.log('[FounderHub] Access check - status:', status);
  console.log('[FounderHub] Access check - can_access_hub:', status?.can_access_hub);
  console.log('[FounderHub] Access check - is_admin_view:', status?.is_admin_view);
  console.log('[FounderHub] Access check - founder_status:', status?.founder_status);

  if (!status?.can_access_hub) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Sparkles size={34} className="mx-auto mb-3 text-yellow-500/30" />
        <h1 className="text-2xl font-black text-white">Founder Access Only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          {status?.founder_status && status.founder_status !== 'none'
            ? `Your Founder status is "${founderStatusLabel(status.founder_status)}". Contact an administrator if you believe this is a mistake.`
            : 'This area is reserved for active Mai Troll Founders and administrators.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-white/20"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 overflow-hidden rounded-3xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-purple-500/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={22} className="text-yellow-400" />
              <h1 className="text-2xl font-black tracking-tight text-white">Founder Hub</h1>
              <FounderBadge userId={user.id} showMultipliers />
            </div>
            <p className="mt-1.5 text-sm text-white/50">
              {!status.is_founder && isAdmin
                ? 'Administrator view — manage Founder Program members and rules.'
                : status.days_remaining != null
                  ? `${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'} remaining in your term.`
                  : 'Welcome to the Founder Hub.'}
            </p>
          </div>

          {upcoming && <div className="w-full max-w-xs"><FounderUpcomingBroadcastChip broadcast={upcoming} /></div>}
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition ${
              tab === t.id
                ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-black shadow-[0_0_18px_rgba(255,199,44,0.35)]'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'chat' && <FounderChatScreen />}
      {tab === 'schedule' && <BroadcastScheduleScreen onChanged={load} />}
      {tab === 'rewards' && <GiftRewardsScreen />}
      {tab === 'reports' && <ReportsScreen />}
      {tab === 'court' && <CourtToolsScreen />}
      {tab === 'settings' && <ProgramScreen status={status} />}
      {tab === 'admin' && isAdmin && <FounderAdminPanel />}
    </div>
  );
}
