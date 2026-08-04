import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Calendar,
  Coins,
  Crown,
  EyeOff,
  Gift,
  History,
  Radio,
  RefreshCw,
  Rocket,
  Swords,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
  Flame,
  Siren,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { useCoins } from "../lib/hooks/useCoins";
import {
  universeShowdownRegister,
  universeShowdownWithdraw,
  universeShowdownInvite,
  universeShowdownRespondInvite,
  universeShowdownRemoveInvite,
  fetchShowdownPublic,
  fetchMyShowdown,
  fetchMyShowdownInvites,
  fetchMyShowdownSentInvites,
  fetchShowdownDates,
} from "../lib/api/universe";
import { COIN_PACKAGES, formatCoins } from "../lib/coinMath";

const UNIVERSE_TIME_ZONE = "America/Denver";
const QUICK_PACKAGES = COIN_PACKAGES.slice(0, 4);
const SHOWDOWN_CAPACITY = 30;

// ============================================================================
// TIME / FORMAT HELPERS
// ============================================================================
function safeDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMountainDate(value?: string | Date | null, includeTime = true) {
  const date = safeDate(value);
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: UNIVERSE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      : {}),
  }).format(date);
}

function formatMountainTime(value?: string | Date | null) {
  const date = safeDate(value);
  if (!date) return "7:00 PM Mountain Time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: UNIVERSE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function getMountainParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: UNIVERSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function mountainWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const represented = getMountainParts(new Date(utcGuess));
    const representedUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second,
    );
    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcGuess += desiredUtc - representedUtc;
  }
  return new Date(utcGuess);
}

function nextFallbackBattleDate(from = new Date()) {
  const nowMountain = getMountainParts(from);
  const base = new Date(
    Date.UTC(nowMountain.year, nowMountain.month - 1, nowMountain.day),
  );
  for (let offset = 0; offset < 14; offset += 1) {
    const candidateDay = new Date(base);
    candidateDay.setUTCDate(base.getUTCDate() + offset);
    const weekday = candidateDay.getUTCDay();
    if (weekday !== 2 && weekday !== 5) continue;
    const candidate = mountainWallTimeToUtc(
      candidateDay.getUTCFullYear(),
      candidateDay.getUTCMonth() + 1,
      candidateDay.getUTCDate(),
      19,
    );
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return from;
}

function useCountdown(target: Date) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, target.getTime() - Date.now()),
  );
  useEffect(() => {
    setRemaining(Math.max(0, target.getTime() - Date.now()));
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [target]);
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
    completed: remaining <= 0,
  };
}

// ============================================================================
// SMALL PRESENTATIONAL COMPONENTS
// ============================================================================
function StatusBadge({
  label,
  tone = "violet",
}: {
  label: string;
  tone?: "violet" | "emerald" | "rose" | "amber" | "slate";
}) {
  const classes: Record<string, string> = {
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    slate: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${classes[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
      {label}
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),transparent_35%,rgba(168,85,247,0.05))]" />
      <div className="relative">{children}</div>
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-200 shadow-[0_0_22px_rgba(139,92,246,0.18)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-white sm:text-lg">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

// A single digit that slides vertically when it decrements.
function CountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 p-3 text-center shadow-inner shadow-black/40 sm:p-4">
      <div className="relative h-12 overflow-hidden sm:h-16">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={value}
            initial={{ y: "-110%", opacity: 0, filter: "blur(6px)" }}
            animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "110%", opacity: 0, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-3xl font-black tabular-nums tracking-tight text-white [text-shadow:0_0_24px_rgba(168,85,247,0.75)] sm:text-5xl"
          >
            {String(value).padStart(2, "0")}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
      <Activity className="mx-auto h-7 w-7 text-slate-600" />
      <p className="mt-3 text-sm font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

// ============================================================================
// DATA TYPES
// ============================================================================
type ShowdownBattle = {
  id: string;
  event_date?: string;
  scheduled_start?: string;
  capacity?: number;
  registered_count?: number;
  guest_count?: number;
  status?: string;
  is_overflow?: boolean;
  [key: string]: any;
};

type ShowdownSignup = {
  id: string;
  battle_id?: string;
  battle_name?: string;
  is_guest?: boolean;
  seat_index?: number;
  status?: string;
  battle?: ShowdownBattle | null;
  [key: string]: any;
};

type ShowdownPublicRow = {
  battle_id: string;
  battle_name: string;
  is_guest: boolean;
  seat_index: number;
  battle_status?: string;
  event_date?: string;
  scheduled_start?: string;
  [key: string]: any;
};

type ShowdownInvite = {
  id: string;
  battle_id?: string;
  status?: string;
  invited_user_id?: string;
  inviter_user_id?: string;
  invited?: { username?: string | null; avatar_url?: string | null } | null;
  inviter?: { username?: string | null; avatar_url?: string | null } | null;
  [key: string]: any;
};

// ============================================================================
// SECTION: BLIND ROSTER CARD (auto battle name only — real usernames hidden)
// ============================================================================
function RosterChip({ row, index }: { row: ShowdownPublicRow; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay: Math.min(index * 0.012, 0.3) }}
      className="relative flex items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/25 bg-violet-400/10 text-[10px] font-black text-violet-200">
        {row.seat_index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{row.battle_name}</p>
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          {row.is_guest ? "Guest Fighter" : "Challenger"}
        </p>
      </div>
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
    </motion.div>
  );
}

// ============================================================================
// SECTION: GUEST INVITE SEARCH
// ============================================================================
function GuestInvitePanel({
  mySignup,
  onChanged,
  myId,
}: {
  mySignup: ShowdownSignup | null;
  onChanged: () => void;
  myId?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [sent, setSent] = useState<ShowdownInvite[]>([]);
  const [searching, setSearching] = useState(false);

  const loadSent = useCallback(async () => {
    if (!myId) return;
    const { data } = await fetchMyShowdownSentInvites(myId);
    setSent((data || []) as ShowdownInvite[]);
  }, [myId]);

  useEffect(() => {
    void loadSent();
  }, [loadSent, mySignup?.id]);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(8);
    setResults(data || []);
    setSearching(false);
  }, []);

  const invite = async (invitedUserId: string) => {
    const res = await universeShowdownInvite(invitedUserId);
    if (res.success) {
      toast.success("Guest invited");
      setQuery("");
      setResults([]);
      await loadSent();
      onChanged();
    } else {
      toast.error(res.error || "Invite failed");
    }
  };

  const remove = async (inviteId: string) => {
    const res = await universeShowdownRemoveInvite(inviteId);
    if (res.success) {
      toast.success("Invite removed");
      await loadSent();
      onChanged();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  const accepted = sent.filter((s) => s.status === "accepted").length;
  const pending = sent.filter((s) => s.status === "pending").length;

  return (
    <Panel className="border-emerald-400/15">
      <div className="p-5 sm:p-6">
        <SectionTitle
          icon={Users}
          title="Invite Your Squad"
          subtitle="Invite up to 3 friends. When they accept, they are auto-added to your battle as GUEST fighters."
          action={
            <StatusBadge
              label={`${accepted + pending}/3`}
              tone={accepted + pending > 0 ? "emerald" : "slate"}
            />
          }
        />

        {!mySignup ? (
          <div className="mt-5">
            <EmptyState
              title="Register first"
              description="You must join the showdown before you can invite guest fighters."
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <input
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Search a friend to invite…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/40"
              />
              {searching ? (
                <p className="mt-2 text-xs text-slate-500">Searching…</p>
              ) : null}
              {results.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => invite(u.id)}
                      className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-2 py-2 text-left transition hover:bg-white/10"
                    >
                      <UserPlus className="h-4 w-4 text-emerald-300" />
                      <span className="text-sm text-white">{u.username}</span>
                      <span className="ml-auto rounded-lg bg-emerald-400/20 px-2 py-1 text-[11px] font-black text-emerald-200">
                        Invite
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {sent.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No invites sent yet. Invite up to 3 friends to fight in your corner.
                </p>
              ) : (
                sent.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="h-9 w-9 overflow-hidden rounded-xl bg-slate-800">
                      {inv.invited?.avatar_url ? (
                        <img src={inv.invited.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {inv.invited?.username || "Fighter"}
                      </p>
                      <p
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          inv.status === "accepted"
                            ? "text-emerald-300"
                            : inv.status === "declined"
                            ? "text-rose-300"
                            : "text-amber-300"
                        }`}
                      >
                        {inv.status}
                      </p>
                    </div>
                    {(inv.status === "pending" || inv.status === "accepted") && (
                      <button
                        type="button"
                        onClick={() => remove(inv.id)}
                        className="text-rose-300 hover:text-rose-200"
                        aria-label="Remove invite"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ============================================================================
// MAIN PAGE — SHOWDOWN SIGN-UP EXPERIENCE
// ============================================================================
export default function UniverseBattlesPage() {
  const { user } = useAuthStore();
  const { balances } = useCoins();
  const navigate = useNavigate();

  const [battles, setBattles] = useState<ShowdownBattle[]>([]);
  const [publicRoster, setPublicRoster] = useState<ShowdownPublicRow[]>([]);
  const [dates, setDates] = useState<any[]>([]);
  const [mySignup, setMySignup] = useState<ShowdownSignup | null>(null);
  const [myInvites, setMyInvites] = useState<ShowdownInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);

  const activeBattle = useMemo<ShowdownBattle | null>(() => {
    const now = Date.now();
    const future = battles
      .filter((b) => {
        const start = safeDate(b.scheduled_start);
        return start
          ? start.getTime() >= now || ["open", "full", "sealed"].includes((b.status || "").toLowerCase())
          : true;
      })
      .sort((a, b) => {
        const at = safeDate(a.scheduled_start)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bt = safeDate(b.scheduled_start)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
    return future[0] || null;
  }, [battles]);

  const countdownTarget = useMemo(
    () => safeDate(activeBattle?.scheduled_start) || nextFallbackBattleDate(),
    [activeBattle?.scheduled_start],
  );
  const countdown = useCountdown(countdownTarget);

  const registered = (activeBattle?.registered_count ?? 0) + (activeBattle?.guest_count ?? 0);
  const capacity = activeBattle?.capacity ?? SHOWDOWN_CAPACITY;
  const fillPct = Math.min(100, Math.round((registered / capacity) * 100));
  const isInBattle = Boolean(mySignup);
  const isFull = (activeBattle?.status || "").toLowerCase() === "full" || registered >= capacity;

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const [bRes, pRes, dRes] = await Promise.all([
          supabase
            .from("universe_showdown_battles")
            .select("*")
            .order("scheduled_start", { ascending: true }),
          fetchShowdownPublic(),
          fetchShowdownDates(),
        ]);
        setBattles(((bRes.data as ShowdownBattle[]) || []).filter(
          (b) => (b.status || "").toLowerCase() !== "cancelled",
        ));
        setPublicRoster((pRes.data as ShowdownPublicRow[]) || []);
        setDates((dRes.data as any[]) || []);

        if (user?.id) {
          const [meRes, invRes] = await Promise.all([
            fetchMyShowdown(user.id),
            fetchMyShowdownInvites(user.id),
          ]);
          const meRows = (meRes.data as ShowdownSignup[]) || [];
          const active = meRows.find((s) => s.status === "active") || null;
          setMySignup(active);
          setMyInvites((invRes.data as ShowdownInvite[]) || []);
        } else {
          setMySignup(null);
          setMyInvites([]);
        }
      } catch (error) {
        console.error("Unable to load Universe Showdown:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: keep roster / battles / my invites synced.
  useEffect(() => {
    const rosterChannel = supabase
      .channel("universe-showdown-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "universe_showdown_signups" }, () => void load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "universe_showdown_battles" }, () => void load(true))
      .subscribe();

    const inviteChannel = supabase
      .channel(`universe-showdown-invites:${user?.id || "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "universe_showdown_invites" }, () => void load(true))
      .subscribe();

    return () => {
      void supabase.removeChannel(rosterChannel);
      void supabase.removeChannel(inviteChannel);
    };
  }, [load, user?.id]);

  const handleRegister = async () => {
    if (!user) {
      toast.error("Sign in to join the showdown");
      navigate("/login");
      return;
    }
    setRegistering(true);
    const res = await universeShowdownRegister();
    setRegistering(false);
    if (res.success) {
      toast.success(`You are locked in as ${res.battle_name}`);
      await load();
    } else {
      toast.error(res.error || "Could not join");
    }
  };

  const handleWithdraw = async () => {
    const res = await universeShowdownWithdraw();
    if (res.success) {
      toast.success("You left the showdown");
      await load();
    } else {
      toast.error(res.error || "Could not withdraw");
    }
  };

  const respondInvite = async (inviteId: string, accept: boolean) => {
    const res = await universeShowdownRespondInvite(inviteId, accept);
    if (res.success) {
      toast.success(accept ? `Joined as ${res.battle_name || "guest"}` : "Invite declined");
      await load();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  const myPendingInvite = myInvites.find((i) => i.status === "pending");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-28 text-white lg:pb-10">
      <style>{`
        @keyframes universeDrift {
          0%, 100% { transform: translate3d(-2%, -1%, 0) scale(1); opacity: .45; }
          50% { transform: translate3d(2%, 1%, 0) scale(1.06); opacity: .7; }
        }
        @keyframes universeScan {
          0% { transform: translate3d(-120%, 0, 0); }
          100% { transform: translate3d(220%, 0, 0); }
        }
        @keyframes universePulse {
          0%, 100% { opacity: .35; transform: scale(.96); }
          50% { opacity: .9; transform: scale(1.04); }
        }
        @keyframes flameAura {
          0%,100% { box-shadow: 0 0 10px #f59e0b, 0 0 22px rgba(245,158,11,.4); }
          50% { box-shadow: 0 0 22px #f59e0b, 0 0 45px rgba(245,158,11,.7); }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,#211044_0%,#070b18_42%,#000_78%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(99,102,241,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.045)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="pointer-events-none fixed -left-40 top-10 -z-10 h-[34rem] w-[34rem] animate-[universeDrift_12s_ease-in-out_infinite] rounded-full bg-violet-600/20 blur-[120px] will-change-transform" />
      <div className="pointer-events-none fixed -right-40 top-1/3 -z-10 h-[30rem] w-[30rem] animate-[universeDrift_15s_ease-in-out_infinite_reverse] rounded-full bg-indigo-600/15 blur-[120px] will-change-transform" />

      <main className="mx-auto max-w-[1280px] space-y-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-[0_0_35px_rgba(168,85,247,0.45)]">
              <Swords className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-black bg-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="bg-gradient-to-r from-white via-violet-200 to-amber-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
                  Universe Showdown
                </h1>
                <StatusBadge label={isFull ? "Battle Full" : "Sign-Ups Open"} tone={isFull ? "amber" : "emerald"} />
              </div>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Join the battle. Your opponent stays hidden until the room opens. Anyone can sign up.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-violet-400/30 hover:bg-violet-400/10 disabled:opacity-50 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/universe/live")}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-4 py-2.5 text-sm font-black shadow-[0_0_28px_rgba(244,63,94,0.25)] transition hover:brightness-110 sm:flex-none"
            >
              <Radio className="h-4 w-4" />
              Battle Room
            </button>
          </div>
        </header>

        {/* HERO — countdown terminal + big register CTA */}
        <Panel className="border-violet-400/20">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_.6fr]">
            <div className="relative overflow-hidden p-5 sm:p-7 lg:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(99,102,241,0.16),transparent_32%)]" />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-[universeScan_8s_linear_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent will-change-transform" />

              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">
                  Next Official Battle
                </p>
                <h2 className="mt-2 text-xl font-black text-white sm:text-3xl">
                  {activeBattle?.event_date
                    ? safeDate(activeBattle.scheduled_start)
                      ? new Intl.DateTimeFormat("en-US", {
                          timeZone: UNIVERSE_TIME_ZONE,
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        }).format(safeDate(activeBattle.scheduled_start)!)
                      : "Universe Showdown"
                    : "Universe Showdown"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatMountainDate(countdownTarget)}
                </p>

                <div className="mt-6 flex gap-2 sm:gap-3">
                  <CountdownDigit value={countdown.days} label="Days" />
                  <CountdownDigit value={countdown.hours} label="Hours" />
                  <CountdownDigit value={countdown.minutes} label="Minutes" />
                  <CountdownDigit value={countdown.seconds} label="Seconds" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200 [text-shadow:0_0_18px_rgba(245,158,11,.45)]">
                    {formatMountainTime(countdownTarget)}
                  </span>
                  <StatusBadge label={`${registered}/${capacity} Locked In`} tone="violet" />
                  <StatusBadge label="Opponent Hidden" tone="slate" />
                </div>
              </div>
            </div>

            {/* Right column: register / status */}
            <div className="border-t border-white/10 bg-black/20 p-5 lg:border-l lg:border-t-0 lg:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Your Showdown Status
              </p>

              {loading ? (
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
                  ))}
                </div>
              ) : isInBattle ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4 text-center">
                    <Crown className="mx-auto h-7 w-7 text-emerald-300" />
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
                      Your Battle Name
                    </p>
                    <p className="mt-1 text-xl font-black text-white">{mySignup?.battle_name}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      {mySignup?.is_guest ? "Guest Fighter" : "Challenger"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/universe/live")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-4 py-3 text-sm font-black transition hover:brightness-110"
                  >
                    <Flame className="h-4 w-4" /> Enter Battle Room
                  </button>
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Leave Showdown
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="rounded-2xl border border-dashed border-violet-400/25 bg-violet-400/[0.06] p-5 text-center">
                    <Rocket className="mx-auto h-8 w-8 text-violet-300" />
                    <p className="mt-3 font-black text-white">Claim your spot</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      We mint you an anonymous battle name. You won&apos;t see who you fight until the room opens.
                    </p>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={true}
                      className="mt-4 w-full cursor-not-allowed rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-600 px-4 py-3 text-sm font-black transition opacity-50"
                    >
                      {registering ? "Locking In…" : "Registration Closed"}
                    </button>
                  </div>
                </div>
              )}

              {myPendingInvite ? (
                <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
                  <p className="text-sm font-black text-white">You&apos;re invited to a squad</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {myPendingInvite.inviter?.username || "A fighter"} wants you as a guest.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondInvite(myPendingInvite.id, true)}
                      className="flex-1 rounded-xl bg-emerald-500/80 py-2 text-sm font-black transition hover:bg-emerald-500"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => respondInvite(myPendingInvite.id, false)}
                      className="flex-1 rounded-xl bg-rose-500/80 py-2 text-sm font-black transition hover:bg-rose-500"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Capacity bar */}
          <div className="px-5 pb-5 sm:px-7 lg:px-8">
            <div className="mt-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
              <span>Battle Capacity</span>
              <span className={isFull ? "text-amber-300" : "text-violet-200"}>
                {registered} / {capacity}
              </span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 will-change-transform"
                initial={false}
                animate={{ width: `${fillPct}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            </div>
            {isFull ? (
              <p className="mt-2 flex items-center gap-2 text-xs font-bold text-amber-300">
                <Siren className="h-4 w-4" /> This battle is full — new sign-ups roll into the next date.
              </p>
            ) : null}
          </div>
        </Panel>

        {/* Blind roster + calendar strip */}
        <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <Panel>
            <div className="p-5 sm:p-6">
              <SectionTitle
                icon={EyeOff}
                title="Who's In (Blind Roster)"
                subtitle="Auto-generated battle names only. Real usernames are hidden until the official reveal."
                action={
                  <StatusBadge label={`${publicRoster.length} Fighters`} tone="violet" />
                }
              />

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {publicRoster.length ? (
                    publicRoster.map((row, index) => (
                      <RosterChip key={row.signup_id || row.battle_name + index} row={row} index={index} />
                    ))
                  ) : (
                    <div className="col-span-full">
                      <EmptyState
                        title="No challengers yet"
                        description="Be the first to join the showdown. Your battle name appears here instantly."
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Panel>

          <Panel className="border-amber-400/15">
            <div className="p-5 sm:p-6">
              <SectionTitle
                icon={Calendar}
                title="Battle Calendar"
                subtitle="Fixed 7:00 PM Mountain Time. Two weekly slots — overflow fills Friday."
                action={
                  <button
                    type="button"
                    onClick={() => navigate("/universe/calendar")}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-white/10"
                  >
                    Full
                  </button>
                }
              />
              <div className="mt-5 space-y-3">
                {(dates.length ? dates : battles).slice(0, 4).map((item: any) => {
                  const start = safeDate(item.scheduled_start);
                  const count =
                    item.registered_count != null
                      ? (item.registered_count || 0) + (item.guest_count || 0)
                      : registered;
                  const cap = item.capacity || capacity;
                  return (
                    <div
                      key={item.id || item.event_date}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10">
                        <span className="text-[9px] font-black uppercase tracking-wider text-violet-300">
                          {start
                            ? new Intl.DateTimeFormat("en-US", {
                                timeZone: UNIVERSE_TIME_ZONE,
                                month: "short",
                              }).format(start)
                            : "TBD"}
                        </span>
                        <span className="text-lg font-black text-white">
                          {start
                            ? new Intl.DateTimeFormat("en-US", {
                                timeZone: UNIVERSE_TIME_ZONE,
                                day: "numeric",
                              }).format(start)
                            : "—"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">
                          {item.is_overflow ? "Friday Overflow Battle" : "Universe Showdown"}
                        </p>
                        <p className="text-xs text-slate-500">{formatMountainTime(start)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-violet-200">{count}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">/ {cap}</p>
                      </div>
                    </div>
                  );
                })}
                {!(dates.length || battles.length) ? (
                  <EmptyState
                    title="No dates scheduled"
                    description="The next configured Universe Showdown will appear here automatically."
                  />
                ) : null}
              </div>
            </div>
          </Panel>
        </section>

        {/* Guest invites */}
        <GuestInvitePanel mySignup={mySignup} onChanged={() => void load(true)} myId={user?.id} />

        {/* Quick links */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: Radio, title: "Battle Room", sub: "Live arena + queue", route: "/universe/live" },
            { icon: Calendar, title: "Full Calendar", sub: "All showdowns", route: "/universe/calendar" },
            { icon: History, title: "Battle History", sub: "Past results", route: "/universe/history" },
            { icon: Trophy, title: "Champions", sub: "Top fighters", route: "/universe/champions" },
          ].map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={() => navigate(action.route)}
              className="group relative min-h-[112px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-violet-400/35 hover:bg-violet-400/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl transition duration-300 group-hover:bg-violet-500/20" />
              <div className="relative flex h-full flex-col">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-violet-200 transition duration-300 group-hover:scale-110 group-hover:border-violet-400/30">
                  <action.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-black text-white">{action.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{action.sub}</p>
              </div>
            </button>
          ))}
        </section>

        {/* Coin access + Troll Ups */}
        <section className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
          <Panel>
            <div className="p-5 sm:p-6">
              <SectionTitle
                icon={Coins}
                title="Battle Coin Access"
                subtitle="Gifts fuel the score. Everyone in the room can gift — broadcasters and guests included."
              />
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/70">
                    Your Balance
                  </p>
                  <p className="mt-1 text-2xl font-black text-amber-200">
                    {formatCoins(balances?.troll_coins || 0)}
                  </p>
                </div>
                <Gift className="h-8 w-8 text-amber-300" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {QUICK_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => navigate("/coins")}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-400/25 hover:bg-amber-400/[0.06]"
                  >
                    <p className="font-black text-amber-200">{formatCoins(pkg.coins)}</p>
                    <p className="mt-1 text-xs text-slate-500">{pkg.label}</p>
                    <p className="mt-2 text-xs font-black text-emerald-300">${pkg.usdPrice.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="border-amber-400/20">
            <div className="p-5 sm:p-6">
              <SectionTitle
                icon={Zap}
                title="Universe Troll Ups"
                subtitle="Backend-randomized abilities. Viewers can't pick the result, duration, or winner."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { n: "Triple Gifts", d: "30s" },
                  { n: "Timer Troll", d: "Instant" },
                  { n: "Hidden Score", d: "30s" },
                  { n: "Turtle Mode", d: "Instant" },
                  { n: "Troll Mode", d: "20s" },
                  { n: "Officer Fee", d: "Instant" },
                  { n: "Scramble Score", d: "20s" },
                ].map((a) => (
                  <div
                    key={a.n}
                    className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.045] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Zap className="h-5 w-5 text-amber-300" />
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        {a.d}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-black text-white">{a.n}</h3>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-center text-xs leading-5 text-slate-500">
          Universe Showdown is separate from regular Mai Troll battles. LiveKit, gifting, wallets,
          chat, moderation, and realtime infrastructure are reused without breaking the regular
          battle system. Opponent identities are hidden until the official reveal.
        </div>
      </main>
    </div>
  );
}

