import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  UserPlus,
  Trash2,
  Save,
  Settings2,
  ScrollText,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FounderRow,
  FounderProgramSettings,
  FounderUserSearchResult,
  FounderActionRecord,
  adminListFounders,
  adminSearchFounderCandidates,
  adminAddFounder,
  adminUpdateFounder,
  adminRemoveFounder,
  adminGetFounderSettings,
  adminUpdateFounderSettings,
  adminListFounderActions,
  formatMultiplier,
  formatFounderDate,
  founderStatusLabel,
} from '@/services/founderProgram';
import { refreshFounderDirectory } from '@/hooks/useFounderProgram';

type PanelTab = 'add' | 'manage' | 'settings' | 'audit';

const PANEL_TABS: { id: PanelTab; label: string; icon: typeof UserPlus }[] = [
  { id: 'add', label: 'Add Founder', icon: UserPlus },
  { id: 'manage', label: 'Current Founders', icon: Crown },
  { id: 'settings', label: 'Program Rules', icon: Settings2 },
  { id: 'audit', label: 'Founder Audit', icon: ScrollText },
];

/**
 * ⭐ Admin Founder management.
 *
 * Rendered as a TAB INSIDE the Founder page (not a separate admin route) so
 * Admins and Founders use one surface. The panel itself is only mounted for
 * admins, and every action here is re-authorized server-side by the
 * founder_admin_* RPCs — hiding this tab grants nothing.
 */
export default function FounderAdminPanel() {
  const [tab, setTab] = useState<PanelTab>('add');

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-950/30 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-300">
          <AlertTriangle size={13} /> Administrator view
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/55">
          You are managing the Founder Program from inside the Founder page. Every grant,
          multiplier change, and removal below is written to the Founder audit log with your
          user ID. Granting Founder status never changes the target&rsquo;s account role.
        </p>
      </div>

      <nav className="mb-5 flex flex-wrap gap-2">
        {PANEL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition ${
              tab === t.id
                ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'add' && <AddFounderForm />}
      {tab === 'manage' && <ManageFounders />}
      {tab === 'settings' && <ProgramSettingsForm />}
      {tab === 'audit' && <FounderAudit />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add Founder — search, select, configure, grant                               */
/* -------------------------------------------------------------------------- */

function AddFounderForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FounderUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FounderUserSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState<{ capacity: number; activeCount: number } | null>(null);

  const [durationMonths, setDurationMonths] = useState(6);
  const [giftMultiplier, setGiftMultiplier] = useState(2);
  const [cashoutMultiplier, setCashoutMultiplier] = useState(1);
  const [notes, setNotes] = useState('');

  const allowedMultipliers = useMemo(() => [1, 2, 5], []);

  const loadCapacity = useCallback(async () => {
    const res = await adminListFounders('active');
    if (res.ok) setCapacity({ capacity: res.capacity, activeCount: res.activeCount });
  }, []);

  useEffect(() => {
    void loadCapacity();
  }, [loadCapacity]);

  // Debounced candidate search (admin-only RPC, excludes current Founders).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const rows = await adminSearchFounderCandidates(q, 25);
      if (active) {
        setResults(rows);
        setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const atCapacity =
    capacity != null && capacity.activeCount >= capacity.capacity;

  const submit = async () => {
    if (!selected) {
      toast.error('Select a user first.');
      return;
    }
    if (!window.confirm(`Grant Founder status to @${selected.username}?`)) return;

    setBusy(true);
    const res = await adminAddFounder({
      userId: selected.user_id,
      durationMonths,
      giftMultiplier,
      cashoutMultiplier,
      notes: notes.trim() || null,
      reason: `Granted by admin from Founder page`,
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    toast.success(
      `@${selected.username} is now a Founder — their profile badge and gold username are already live.`,
    );

    // Refresh the shared directory immediately so the new Founder's own
    // session (and this admin's) picks up the badge without a reload.
    await refreshFounderDirectory();
    await loadCapacity();

    setSelected(null);
    setQuery('');
    setResults([]);
    setNotes('');
  };

  return (
    <div className="max-w-2xl space-y-5">
      {capacity && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Active founder slots
            </p>
            <p className="mt-0.5 text-lg font-black text-white">
              {capacity.activeCount}
              <span className="text-sm font-bold text-white/35"> / {capacity.capacity}</span>
            </p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-600"
              style={{
                width: `${Math.min(100, (capacity.activeCount / Math.max(1, capacity.capacity)) * 100)}%`,
              }}
            />
          </div>
          {atCapacity && (
            <span className="rounded-full bg-red-500/20 px-2 py-1 text-[9px] font-black uppercase text-red-300">
              Full
            </span>
          )}
        </div>
      )}

      {/* Step 1 — search */}
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
          Step 1 — Search for a user
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, display name, or user ID"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-500/50"
          />
        </div>

        {searching && (
          <p className="mt-2 flex items-center gap-2 text-xs text-white/40">
            <Loader2 size={12} className="animate-spin" /> Searching...
          </p>
        )}

        {!searching && results.length > 0 && (
          <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-2">
            {results.map((r) => (
              <button
                key={r.user_id}
                type="button"
                onClick={() => {
                  setSelected(r);
                  setResults([]);
                }}
                className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-white/5 ${
                  selected?.user_id === r.user_id ? 'bg-yellow-500/10 ring-1 ring-yellow-500/40' : ''
                }`}
              >
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/60">
                    {(r.username || '?').slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-white">
                    @{r.username}
                  </span>
                  <span className="block truncate text-[11px] text-white/40">
                    {r.display_name || 'No display name'}
                    {r.role ? ` · ${r.role}` : ''}
                  </span>
                </span>
                {r.is_admin && (
                  <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-red-300">
                    Admin
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && !selected && (
          <p className="mt-2 text-xs text-white/35">
            No matching users, or they are already Founders.
          </p>
        )}
      </div>

      {/* Step 2 — selected user + terms */}
      {selected && (
        <div className="space-y-4 rounded-2xl border border-yellow-500/25 bg-yellow-500/[0.04] p-4">
          <div className="flex items-center gap-3">
            {selected.avatar_url ? (
              <img src={selected.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white/60">
                {(selected.username || '?').slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">@{selected.username}</p>
              <p className="truncate text-[11px] text-white/40">
                {selected.display_name || 'No display name'}
                {selected.is_broadcaster ? ' · Broadcaster' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs font-bold text-white/40 hover:text-white"
            >
              Change
            </button>
          </div>

          {selected.is_admin && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300">
              This user is an Admin. Their Founder multipliers will apply, but the Founder
              badge and gold username will stay hidden in favour of their Admin presentation.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
                Term (months)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/50"
              />
            </div>

            <MultiplierSelect
              label="Gift multiplier"
              value={giftMultiplier}
              options={allowedMultipliers}
              onChange={setGiftMultiplier}
            />

            <MultiplierSelect
              label="Cashout multiplier"
              value={cashoutMultiplier}
              options={allowedMultipliers}
              onChange={setCashoutMultiplier}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
              Internal note (never shown publicly)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Why this Founder was granted…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-500/50"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 py-3 text-sm font-black uppercase tracking-wider text-black disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Grant Founder status to @{selected.username}
          </button>
        </div>
      )}
    </div>
  );
}

function MultiplierSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
        {label}
      </label>
      <div className="flex gap-1.5">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-black transition ${
              value === m
                ? 'border-yellow-500 bg-yellow-500 text-black'
                : 'border-white/10 bg-black/40 text-white/55 hover:bg-white/5'
            }`}
          >
            {m}×
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Manage current Founders                                                     */
/* -------------------------------------------------------------------------- */

function ManageFounders() {
  const [filter, setFilter] = useState<'active' | 'expired' | 'suspended' | 'removed'>('active');
  const [rows, setRows] = useState<FounderRow[]>([]);
  const [capacity, setCapacity] = useState<{ capacity: number; activeCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editGift, setEditGift] = useState(1);
  const [editCashout, setEditCashout] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminListFounders(filter === 'active' ? 'active' : filter);
    if (res.ok) {
      setRows(res.founders);
      setCapacity({ capacity: res.capacity, activeCount: res.activeCount });
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (row: FounderRow) => {
    setEditing(row.id);
    setEditGift(Number(row.gift_multiplier));
    setEditCashout(Number(row.cashout_multiplier));
  };

  const save = async (row: FounderRow) => {
    setBusyId(row.id);
    const res = await adminUpdateFounder({
      founderId: row.id,
      giftMultiplier: editGift,
      cashoutMultiplier: editCashout,
      reason: 'Multipliers updated from Founder page',
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Multipliers updated');
    setEditing(null);
    await refreshFounderDirectory();
    await load();
  };

  const changeStatus = async (row: FounderRow, status: 'active' | 'suspended') => {
    const label = status === 'active' ? 'Reactivate' : 'Suspend';
    if (!window.confirm(`${label} @${row.username}?`)) return;

    setBusyId(row.id);
    const res = await adminUpdateFounder({
      founderId: row.id,
      status,
      reason: `${label}d from Founder page`,
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${label}d`);
    await refreshFounderDirectory();
    await load();
  };

  const remove = async (row: FounderRow) => {
    const reason = window.prompt(`Remove @${row.username} as Founder?\n\nReason (recorded in the audit log):`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A reason is required to remove a Founder.');
      return;
    }

    setBusyId(row.id);
    const res = await adminRemoveFounder(row.id, reason.trim());
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`@${row.username} removed — badge and gold username are now hidden.`);
    await refreshFounderDirectory();
    await load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['active', 'expired', 'suspended', 'removed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
              filter === s
                ? 'bg-yellow-500 text-black'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {founderStatusLabel(s)}
          </button>
        ))}
      </div>

      {capacity && filter === 'active' && (
        <p className="mb-3 text-xs font-bold text-white/40">
          {capacity.activeCount} of {capacity.capacity} founder slots filled
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-yellow-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-yellow-500/25 py-12 text-center">
          <Crown size={28} className="mx-auto mb-2 text-yellow-500/40" />
          <p className="text-sm font-bold text-white/60">No {founderStatusLabel(filter).toLowerCase()} Founders</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {row.avatar_url ? (
                    <img src={row.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/60">
                      {(row.username || '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-black text-white">
                      @{row.username}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          row.is_active
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {founderStatusLabel(row.status)}
                      </span>
                      {row.role && (
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-purple-300">
                          {row.role}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] font-semibold text-white/40">
                      <span>
                        Gift {formatMultiplier(row.gift_multiplier)} · Cashout{' '}
                        {formatMultiplier(row.cashout_multiplier)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatFounderDate(row.start_at)} → {formatFounderDate(row.end_at)}
                      </span>
                      {row.days_remaining != null && row.is_active && (
                        <span className="text-amber-300">{row.days_remaining} days left</span>
                      )}
                    </p>
                    {row.notes && (
                      <p className="mt-1 text-[11px] italic text-white/30">Note: {row.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {editing === row.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => save(row)}
                        disabled={busyId === row.id}
                        className="flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[10px] font-black uppercase text-emerald-300 disabled:opacity-50"
                      >
                        {busyId === row.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Save size={11} />
                        )}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-black uppercase text-white/50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-black uppercase text-white/60 hover:bg-white/5"
                      >
                        Multipliers
                      </button>
                      {row.is_active ? (
                        <button
                          type="button"
                          onClick={() => changeStatus(row, 'suspended')}
                          disabled={busyId === row.id}
                          className="rounded-lg border border-amber-500/40 px-2.5 py-1.5 text-[10px] font-black uppercase text-amber-300 disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      ) : (
                        row.status === 'suspended' && (
                          <button
                            type="button"
                            onClick={() => changeStatus(row, 'active')}
                            disabled={busyId === row.id}
                            className="rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[10px] font-black uppercase text-emerald-300 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )
                      )}
                      {row.status !== 'removed' && (
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          disabled={busyId === row.id}
                          className="flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-[10px] font-black uppercase text-red-300 disabled:opacity-50"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      )}
                      <Link
                        to={`/profile/id/${row.user_id}`}
                        className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-black uppercase text-white/60 hover:bg-white/5"
                      >
                        Profile
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {editing === row.id && (
                <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <MultiplierSelect
                    label="Gift multiplier"
                    value={editGift}
                    options={[1, 2, 5]}
                    onChange={setEditGift}
                  />
                  <MultiplierSelect
                    label="Cashout multiplier"
                    value={editCashout}
                    options={[1, 2, 5]}
                    onChange={setEditCashout}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Program rules                                                               */
/* -------------------------------------------------------------------------- */

function ProgramSettingsForm() {
  const [settings, setSettings] = useState<FounderProgramSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState(5);
  const [termMonths, setTermMonths] = useState(6);
  const [gift, setGift] = useState(2);
  const [cashout, setCashout] = useState(1);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    adminGetFounderSettings().then((s) => {
      if (!active || !s) return;
      setSettings(s);
      setCapacity(s.capacity);
      setTermMonths(s.default_duration_months);
      setGift(Number(s.default_gift_multiplier));
      setCashout(Number(s.default_cashout_multiplier));
      setEnabled(s.program_enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (capacity < 1) {
      toast.error('Capacity must be at least 1.');
      return;
    }
    setBusy(true);
    const res = await adminUpdateFounderSettings({
      programEnabled: enabled,
      capacity,
      defaultDurationMonths: termMonths,
      defaultGiftMultiplier: gift,
      defaultCashoutMultiplier: cashout,
      reason: 'Program settings updated from Founder page',
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Program rules saved');
    setSettings(await adminGetFounderSettings());
  };

  if (!settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-sm font-black text-white">Program enabled</p>
          <p className="mt-0.5 text-xs text-white/40">
            When off, no new Founders can be granted and existing terms stop applying.
          </p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5 accent-yellow-500"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
            Founder capacity (slots)
          </label>
          <input
            type="number"
            min={1}
            max={1000}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) || 1)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/50"
          />
          <p className="mt-1 text-[10px] font-semibold text-white/30">
            Currently {settings.active_count ?? 0} active
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">
            Default term (months)
          </label>
          <input
            type="number"
            min={1}
            max={120}
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value) || 1)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/50"
          />
        </div>
      </div>

      <MultiplierSelect label="Default gift multiplier" value={gift} options={[1, 2, 5]} onChange={setGift} />
      <MultiplierSelect
        label="Default cashout multiplier"
        value={cashout}
        options={[1, 2, 5]}
        onChange={setCashout}
      />

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] font-semibold text-white/40">
        Allowed multipliers: {(settings.allowed_multipliers ?? [1, 2, 5]).join('×, ')}×
        <br />
        Manual expiration allowed: {settings.allow_manual_expiration ? 'yes' : 'no'}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 px-5 py-3 text-sm font-black uppercase tracking-wider text-black disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        Save program rules
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

function FounderAudit() {
  const [rows, setRows] = useState<FounderActionRecord[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [actionType, setActionType] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminListFounderActions({
      actionType: actionType || null,
      limit: 200,
    });
    setRows(res.actions);
    if (res.actionTypes.length) setActionTypes(res.actionTypes);
    setLoading(false);
  }, [actionType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none"
        >
          <option value="">All actions</option>
          {actionTypes.map((t) => (
            <option key={t} value={t} className="bg-black">
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-black uppercase text-white/60 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-yellow-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-yellow-500/25 py-12 text-center">
          <ScrollText size={28} className="mx-auto mb-2 text-yellow-500/40" />
          <p className="text-sm font-bold text-white/60">No Founder actions recorded</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
              <tr>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Founder</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2.5 font-black text-yellow-300">
                    {r.action_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2.5 text-white/60">
                    {r.founder_username ? `@${r.founder_username}` : '—'}
                    {r.actor_role && (
                      <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-white/50">
                        {r.actor_role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-white/60">
                    {r.target_username ? `@${r.target_username}` : r.target_user_id || '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-white/45">{r.reason || '—'}</td>
                  <td className="px-3 py-2.5 text-white/35">{formatFounderDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
