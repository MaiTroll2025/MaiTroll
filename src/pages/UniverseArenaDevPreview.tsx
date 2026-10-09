// ============================================================================
// DEV-ONLY PREVIEW — Universe Live Arena (fake data, no DB, no edits)
// Polished esports-broadcast mock matching the reference spec (v3).
// Route: /universe/dev-preview
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Gift,
  Zap,
  Timer,
  Users,
  Radio,
  Sparkles,
  ArrowLeft,
  Eye,
  Star,
  Coins,
  ShieldAlert,
  Siren,
  Mic,
  Video,
  Signal,
} from "lucide-react";
import { toast } from "sonner";
import DevArenaChat from "../components/universe/DevArenaChat";
import UniverseArenaBackground from "../components/universe/UniverseArenaBackground";

const TROLL_UPS = [
  { type: "triple_gifts", label: "Triple Gifts", desc: "Gifts count 3x for team score", dur: 30, color: "fuchsia", icon: Gift },
  { type: "timer_troll", label: "Timer Troll", desc: "Steal 30s from the clock", dur: 0, color: "sky", icon: Timer },
  { type: "hidden_challenger_score", label: "Hidden Score", desc: "Hide enemy score 30s", dur: 30, color: "violet", icon: Eye },
  { type: "turtle_mode", label: "Turtle Mode", desc: "Double remaining time", dur: 0, color: "emerald", icon: ShieldAlert },
  { type: "officer_fee", label: "Officer Fee", desc: "Cut enemy score 10%", dur: 0, color: "amber", icon: Siren },
  { type: "scramble_score", label: "Scramble", desc: "Scramble scores 20s", dur: 20, color: "rose", icon: Sparkles },
];

const fakeTeams = {
  blue: {
    name: "TEAM ALPHA",
    host: { username: "NeonReaper", score: 18420, gifts: 1240, quality: 98 },
    seats: [
      { username: "VoidTroll", gifts: 640, quality: 95 },
      { username: "PlasmaBANDIT", gifts: 410, quality: 88 },
      { username: "CrimsonWraith", gifts: 320, quality: 91 },
    ],
  },
  red: {
    name: "TEAM OMEGA",
    host: { username: "HyperSpecter", score: 16110, gifts: 980, quality: 96 },
    seats: [
      { username: "FrostNomad", gifts: 520, quality: 90 },
      { username: "AstroRazor", gifts: 470, quality: 93 },
      { username: "ToxicGlitch", gifts: 300, quality: 84 },
    ],
  },
};

const fakeQueue = [
  { id: "q1", username: "QuantumPhantom", coins: 1840, status: "next" },
  { id: "q2", username: "ShadowComet", coins: 1120, status: "waiting" },
  { id: "q3", username: "EmberSpecter", coins: 980, status: "waiting" },
  { id: "q4", username: "LunarDrifter", coins: 760, status: "waiting" },
  { id: "q5", username: "VaporBandit", coins: 540, status: "waiting" },
];

const colorMap: Record<string, { text: string; border: string; glow: string; bg: string; chip: string }> = {
  fuchsia: { text: "text-fuchsia-200", border: "border-fuchsia-400/50", glow: "shadow-[0_0_30px_rgba(232,121,249,0.55)]", bg: "from-fuchsia-600/20", chip: "bg-fuchsia-400/15" },
  sky: { text: "text-sky-200", border: "border-sky-400/50", glow: "shadow-[0_0_30px_rgba(56,189,248,0.55)]", bg: "from-sky-600/20", chip: "bg-sky-400/15" },
  violet: { text: "text-violet-200", border: "border-violet-400/50", glow: "shadow-[0_0_30px_rgba(167,139,250,0.55)]", bg: "from-violet-600/20", chip: "bg-violet-400/15" },
  emerald: { text: "text-emerald-200", border: "border-emerald-400/50", glow: "shadow-[0_0_30px_rgba(52,211,153,0.5)]", bg: "from-emerald-600/20", chip: "bg-emerald-400/15" },
  amber: { text: "text-amber-200", border: "border-amber-400/50", glow: "shadow-[0_0_30px_rgba(251,191,36,0.5)]", bg: "from-amber-600/20", chip: "bg-amber-400/15" },
  rose: { text: "text-rose-200", border: "border-rose-400/50", glow: "shadow-[0_0_30px_rgba(251,113,133,0.5)]", bg: "from-rose-600/20", chip: "bg-rose-400/15" },
};

// Diamond wolf logo (SVG path) for team branding.
function WolfLogo({ side }: { side: "blue" | "red" }) {
  const fill = side === "blue" ? "#7dd3fc" : "#fda4af";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={fill} strokeWidth={1.6} strokeLinejoin="round">
      <path d="M3 10 L6 6 L9 9 L12 4 L15 9 L18 6 L21 10 L18 13 L18 20 L14 18 L12 20 L10 18 L6 20 L6 13 Z" />
    </svg>
  );
}

function CrystalDiamond({
  username,
  isHost,
  side,
  gifts,
  quality,
}: {
  username?: string;
  isHost?: boolean;
  side: "blue" | "red";
  gifts?: number;
  quality?: number;
}) {
  const sideTint = side === "blue" ? "from-sky-500/40 to-sky-950/40" : "from-rose-500/40 to-rose-950/40";
  const sideRing = side === "blue" ? "border-sky-200/80" : "border-rose-200/80";
  const sideGlow = side === "blue" ? "shadow-[0_0_50px_rgba(56,189,248,0.55)]" : "shadow-[0_0_50px_rgba(244,63,94,0.55)]";
  const live = side === "blue" ? "bg-sky-400" : "bg-rose-500";
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative flex aspect-square w-full items-center justify-center will-change-transform"
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="absolute top-0 left-0 h-1.5 w-1.5 rounded-full bg-white animate-[edgeRun_3s_linear_infinite] [box-shadow:0_0_10px_rgba(255,255,255,0.9)]" />
      </span>
      <span className="absolute left-2 top-2 h-1/3 w-1/3 rounded-full bg-white/25 blur-md" />
      <div
        className={`relative flex h-[88%] w-[92%] items-center justify-center overflow-hidden rounded-2xl border-2 ${sideRing} ${sideGlow} bg-gradient-to-br ${sideTint} backdrop-blur-md`}
      >
        {username ? (
          <div className="flex w-full flex-col items-center px-1 text-center">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/50 text-[12px] font-black text-white">
              {username.slice(0, 2).toUpperCase()}
              <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${live}`}>
                <Mic className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
            <p className="mt-1.5 truncate text-[11px] font-black leading-tight text-white">{username}</p>
            {isHost ? (
              <>
                <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-slate-200/80">
                  <Video className="h-3 w-3" /> LIVE
                </p>
                {typeof gifts === "number" ? (
                  <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-amber-200">
                    <Coins className="h-3 w-3" /> {gifts.toLocaleString()}
                  </p>
                ) : null}
                {typeof quality === "number" ? (
                  <p className="flex items-center gap-0.5 text-[9px] text-emerald-200">
                    <Signal className="h-3 w-3" /> {quality}%
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <span className="text-[9px] uppercase tracking-widest text-white/30">Open</span>
        )}
        {isHost ? (
          <Crown className="absolute -top-2 right-1 h-5 w-5 text-amber-300 [filter:drop-shadow(0_0_6px_rgba(251,191,36,0.8))]" />
        ) : null}
      </div>
      {isHost ? (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-[2px] text-[8px] font-black text-white animate-pulse">
          LIVE
        </span>
      ) : null}
    </motion.div>
  );
}

// Responsive diamond layout: host top, two seats middle, one seat bottom.
function ArenaSide({ side, team, onGift, triple }: any) {
  const isBlue = side === "blue";
  const header = isBlue ? "text-sky-200" : "text-rose-200";
  const headerGlow = isBlue
    ? "[text-shadow:0_0_26px_rgba(56,189,248,0.8)]"
    : "[text-shadow:0_0_26px_rgba(244,63,94,0.8)]";
  const ambient = isBlue
    ? "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.20),transparent_70%)] before:blur-2xl"
    : "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.20),transparent_70%)] before:blur-2xl";

  const seatClass =
    "w-full min-w-0 max-w-[clamp(92px,10vw,172px)] justify-self-center";

  return (
    <div
      className={`relative flex min-w-0 flex-col items-center gap-3 py-2 sm:gap-4 ${ambient} ${
        triple && side === "blue"
          ? "rounded-3xl ring-2 ring-amber-300/70 [box-shadow:0_0_40px_rgba(251,191,36,0.5)]"
          : ""
      }`}
    >
      <motion.div
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className={`flex max-w-full items-center justify-center gap-2 text-center text-lg font-black tracking-[0.12em] sm:text-2xl xl:text-3xl ${header} ${headerGlow}`}
      >
        <WolfLogo side={side} />
        <span className="truncate">{team.name}</span>
        <WolfLogo side={side} />
      </motion.div>

      <motion.div
        key={team.host.score}
        initial={{ scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 16 }}
        className={`text-3xl font-black tabular-nums sm:text-5xl xl:text-6xl ${header} ${headerGlow}`}
      >
        {team.host.score.toLocaleString()}
      </motion.div>

      <div className="grid w-full min-w-0 max-w-[520px] grid-cols-2 grid-rows-3 items-center justify-items-center gap-x-3 gap-y-2 px-1 sm:gap-x-5 sm:gap-y-3">
        <div className={`${seatClass} col-span-2 row-start-1`}>
          <CrystalDiamond
            username={team.host.username}
            isHost
            gifts={team.host.gifts}
            quality={team.host.quality}
            side={side}
          />
        </div>

        <div className={`${seatClass} col-start-1 row-start-2`}>
          <CrystalDiamond
            username={team.seats[0]?.username}
            gifts={team.seats[0]?.gifts}
            quality={team.seats[0]?.quality}
            side={side}
          />
        </div>

        <div className={`${seatClass} col-start-2 row-start-2`}>
          <CrystalDiamond
            username={team.seats[1]?.username}
            gifts={team.seats[1]?.gifts}
            quality={team.seats[1]?.quality}
            side={side}
          />
        </div>

        <div className={`${seatClass} col-span-2 row-start-3`}>
          <CrystalDiamond
            username={team.seats[2]?.username}
            gifts={team.seats[2]?.gifts}
            quality={team.seats[2]?.quality}
            side={side}
          />
        </div>
      </div>

      <button
        onClick={onGift}
        className={`group relative mt-1 flex items-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-black ${
          isBlue
            ? "bg-sky-500/20 hover:bg-sky-500/30"
            : "bg-rose-500/20 hover:bg-rose-500/30"
        }`}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Gift className="h-4 w-4" /> Gift {team.name}
      </button>
    </div>
  );
}

function CenterBeam() {
  return (
    <div className="pointer-events-none relative flex min-h-[120px] items-center justify-center lg:h-full lg:min-h-0">
      {/* full-height beam connecting top to bottom */}
      <span className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 bg-gradient-to-b from-sky-400 via-fuchsia-400 to-rose-400 opacity-80 blur-[3px] [box-shadow:0_0_40px_rgba(232,121,249,0.8)] animate-pulse" />
      <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/70 blur-[1px] animate-[beamSlide_3s_linear_infinite]" />
      {/* rising particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-fuchsia-200/80"
          style={{
            left: "50%",
            top: `${8 + i * 7}%`,
            animation: `beamSlide ${2 + (i % 3)}s linear ${i * 0.25}s infinite`,
            boxShadow: "0 0 8px rgba(232,121,249,0.9)",
          }}
        />
      ))}
      {/* centerpiece orb with rotating energy + pulsing ring + lightning */}
      <motion.div
        animate={{ scale: [1, 1.14, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-fuchsia-300/50 bg-black/70 [box-shadow:0_0_55px_rgba(232,121,249,0.7)] sm:h-32 sm:w-32"
      >
        <motion.span
          className="absolute inset-2 rounded-full border-2 border-fuchsia-300/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          style={{ borderStyle: "dashed" }}
        />
        <motion.span
          className="absolute inset-5 rounded-full border border-white/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <span className="absolute h-1 w-1 rounded-full bg-fuchsia-200 animate-ping" />
        <span className="text-5xl font-black text-fuchsia-200 [text-shadow:0_0_26px_rgba(232,121,249,0.95)] sm:text-6xl">VS</span>
      </motion.div>
      {/* lightning streaks */}
      <span className="absolute left-1/2 top-1/4 h-16 w-px -translate-x-1/2 rotate-12 bg-gradient-to-b from-transparent via-fuchsia-200/70 to-transparent animate-pulse" />
      <span className="absolute left-1/2 bottom-1/4 h-16 w-px -translate-x-1/2 -rotate-12 bg-gradient-to-t from-transparent via-fuchsia-200/70 to-transparent animate-pulse" />
    </div>
  );
}

function QueueSidebar({ queue, nextTurnSecs }: any) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
        <Users className="h-4 w-4 text-fuchsia-300" /> Battle Queue
      </div>
      <div className="mt-3 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-400/10 to-transparent p-3 text-center">
        <p className="text-[9px] uppercase tracking-widest text-slate-400">Next turn in</p>
        <motion.p
          key={nextTurnSecs}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="font-black tabular-nums text-fuchsia-200 text-2xl [text-shadow:0_0_16px_rgba(232,121,249,0.6)]"
        >
          {Math.floor(nextTurnSecs / 60)}:{String(nextTurnSecs % 60).padStart(2, "0")}
        </motion.p>
      </div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {queue.map((q: any, i: number) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              q.status === "next"
                ? "border-amber-400/40 bg-amber-400/10 [box-shadow:0_0_20px_rgba(245,158,11,0.25)]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                q.status === "next" ? "border-amber-300/50 bg-amber-400/20 text-amber-200" : "border-white/15 bg-black/30 text-slate-300"
              }`}
            >
              {q.status === "next" ? <Star className="h-4 w-4" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{q.username}</p>
              <p className="flex items-center gap-1 text-[10px] text-amber-300/80">
                <Coins className="h-3 w-3" /> {q.coins.toLocaleString()}
              </p>
            </div>
            {q.status === "next" ? (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">
                Up Next
              </span>
            ) : null}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
        {[
          { l: "In Battle", v: 2 },
          { l: "Queued", v: queue.length },
          { l: "Total", v: queue.length + 2 },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-white/[0.03] py-2">
            <p className="text-base font-black text-white">{s.v}</p>
            <p className="text-[8px] uppercase tracking-wider text-slate-500">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ feed }: any) {
  const meta: Record<string, { icon: any; cls: string }> = {
    gift: { icon: Gift, cls: "border-fuchsia-400/30 bg-fuchsia-400/5 text-fuchsia-200" },
    system: { icon: Radio, cls: "border-sky-400/30 bg-sky-400/5 text-sky-200" },
    ability: { icon: Zap, cls: "border-amber-400/30 bg-amber-400/5 text-amber-200" },
    reveal: { icon: Eye, cls: "border-violet-400/30 bg-violet-400/5 text-violet-200" },
  };
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
        <Radio className="h-4 w-4 text-fuchsia-300" /> Activity Feed
      </div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {feed.map((f: any) => {
            const m = meta[f.kind] || meta.system;
            const Icon = m.icon;
            return (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-2 rounded-2xl border p-2.5 ${m.cls}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-4 font-semibold">{f.text}</p>
                  <p className="text-[9px] text-slate-500">{f.time}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoundInfo({ roundNo }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
        <Timer className="h-4 w-4 text-fuchsia-300" /> Round {roundNo} of 3
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        {[
          ["Current Match", "ALPHA vs OMEGA"],
          ["Timer", "4:58"],
          ["Reveal Countdown", "0:30"],
          ["Match End", "7:05 PM MDT"],
          ["Min Duration", "3:00"],
          ["Max Duration", "10:00"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-xl bg-white/[0.03] px-3 py-2">
            <dt className="text-[9px] uppercase tracking-wider text-slate-500">{k}</dt>
            <dd className="font-black text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TrollUps({ onActivate, active }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
        <Zap className="h-4 w-4" /> Troll Ups
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TROLL_UPS.map((ab) => {
          const c = colorMap[ab.color];
          const Icon = ab.icon;
          const isActive = active.includes(ab.type);
          return (
            <motion.button
              key={ab.type}
              onClick={() => onActivate(ab)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              className={`relative flex flex-col gap-1 overflow-hidden rounded-2xl border ${c.border} ${c.glow} bg-gradient-to-br ${c.bg} to-black/40 p-3 text-left`}
            >
              <div className={`flex items-center gap-1.5 text-sm font-black ${c.text}`}>
                <Icon className="h-4 w-4" /> {ab.label}
              </div>
              <p className="text-[9px] leading-3 text-slate-300">{ab.desc}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-black text-white">
                  {ab.dur > 0 ? `${ab.dur}s` : "Instant"}
                </span>
                {isActive ? (
                  <span className="animate-pulse rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                    ACTIVE
                  </span>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function UniverseArenaDevPreview() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(fakeTeams);
  const [nextTurn, setNextTurn] = useState(42);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [effects, setEffects] = useState<Record<string, number>>({});
  const [timerOffset, setTimerOffset] = useState(0);
  const [feed, setFeed] = useState(() => [
    { id: "f1", kind: "gift", text: "VoidTroll sent 500 coins to Team Alpha", time: "0:04" },
    { id: "f2", kind: "system", text: "Round 1 of 3 started", time: "0:00" },
    { id: "f3", kind: "ability", text: "Triple Gifts activated on Team Alpha", time: "0:02" },
    { id: "f4", kind: "gift", text: "FrostNomad sent 250 coins to Team Omega", time: "0:06" },
    { id: "f5", kind: "reveal", text: "Opponent identities revealed", time: "0:01" },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setNextTurn((t) => (t > 0 ? t - 1 : 42));
      setTeams((prev) => ({
        ...prev,
        blue: { ...prev.blue, host: { ...prev.blue.host, score: prev.blue.host.score + Math.floor(Math.random() * 45) } },
        red: { ...prev.red, host: { ...prev.red.host, score: prev.red.host.score + Math.floor(Math.random() * 38) } },
      }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mountedAt = useRef(Date.now()).current;
  const baseTimer = 4 * 60 + 58 - (Math.floor(mountedAt / 1000) % 300);
  const timerLeft = Math.max(0, baseTimer + timerOffset);
  const roundNo = 1;
  const spectators = useMemo(() => 1240 + Math.floor((Date.now() / 2500) % 90), []);
  const lead = teams.blue.host.score - teams.red.host.score;
  const winner = lead >= 0 ? "blue" : "red";

  const nowMs = Date.now();
  const activeEffect = (type: string) => (effects[type] || 0) > nowMs;
  const hidden = activeEffect("hidden_challenger_score");
  const scramble = activeEffect("scramble_score");
  const triple = activeEffect("triple_gifts");
  const randScore = (seed: number) => Math.floor(8000 + ((Math.sin(seed + nowMs / 200) * 0.5 + 0.5) * 24000));

  const openGift = (side: string) => toast.info(`Gift target: ${side === "blue" ? "Team Alpha" : "Team Omega"}`);
  const activate = (ab: any) => {
    const dur = ab.dur > 0 ? ab.dur * 1000 : 6000;
    setEffects((prev) => ({ ...prev, [ab.type]: Date.now() + dur }));
    if (!abilities.includes(ab.type)) setAbilities((prev) => [...prev, ab.type]);
    setFeed((prev) => [{ id: `a${Date.now()}`, kind: "ability", text: `${ab.label} activated`, time: "now" }, ...prev].slice(0, 12));
    if (ab.type === "timer_troll") setTimerOffset((o) => Math.max(-(4 * 60 + 58), o - 30));
    if (ab.type === "turtle_mode") setTimerOffset((o) => o + 4 * 60);
    if (ab.type === "officer_fee") {
      setTeams((prev) => ({
        ...prev,
        red: { ...prev.red, host: { ...prev.red.host, score: Math.max(0, Math.round(prev.red.host.score * 0.9)) } },
      }));
    }
    toast.success(`Troll Up: ${ab.label}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <style>{`
        @keyframes beamSlide { 0% { transform: translate(-50%, -120%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, 120%); opacity: 0; } }
        @keyframes edgeRun { 0% { top:0; left:0; } 25% { top:0; left:100%; } 50% { top:100%; left:100%; } 75% { top:100%; left:0; } 100% { top:0; left:0; } }
      `}</style>

      {/* CINEMATIC LIVING SPACE BACKGROUND */}
      <UniverseArenaBackground />

      <div className="relative z-10 mx-auto max-w-[1600px] px-3 py-4 sm:px-5">
        {/* TOP HEADER */}
        <div className="rounded-3xl border border-white/10 bg-black/50 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/universe")} className="text-slate-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Sparkles className="h-5 w-5 text-fuchsia-300" />
              <div>
                <h1 className="text-base font-black leading-none sm:text-xl">Universe Battle</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Round {roundNo} of 3 · 7:00 PM MDT</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-2">
              <Timer className="h-5 w-5 text-rose-300" />
              <motion.span
                key={timerLeft}
                initial={{ scale: timerLeft < 10 ? 1.3 : 1 }}
                animate={{ scale: 1 }}
                className={`text-2xl font-black tabular-nums ${timerLeft < 10 ? "text-rose-300 animate-pulse [text-shadow:0_0_18px_rgba(239,68,68,0.9)]" : "text-white [text-shadow:0_0_14px_rgba(239,68,68,0.6)]"}`}
              >
                {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, "0")}
              </motion.span>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${winner === "blue" ? "bg-sky-500/15 [box-shadow:0_0_24px_rgba(56,189,248,0.4)]" : ""} ${triple ? "ring-2 ring-amber-300 [box-shadow:0_0_30px_rgba(251,191,36,0.7)]" : ""}`}>
                <span className="h-3 w-3 rounded-full bg-sky-400 [box-shadow:0_0_12px_rgba(56,189,248,0.9)]" />
                <motion.span key={teams.blue.host.score} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-sky-200 [text-shadow:0_0_16px_rgba(56,189,248,0.7)]">
                  {hidden ? "SCORE HIDDEN" : scramble ? randScore(1).toLocaleString() : teams.blue.host.score.toLocaleString()}
                </motion.span>
              </div>
              <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${winner === "red" ? "bg-rose-500/15 [box-shadow:0_0_24px_rgba(244,63,94,0.4)]" : ""}`}>
                <span className="h-3 w-3 rounded-full bg-rose-400 [box-shadow:0_0_12px_rgba(244,63,94,0.9)]" />
                <motion.span key={teams.red.host.score} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-rose-200 [text-shadow:0_0_16px_rgba(244,63,94,0.7)]">
                  {hidden ? "SCORE HIDDEN" : scramble ? randScore(2).toLocaleString() : teams.red.host.score.toLocaleString()}
                </motion.span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <Users className="h-4 w-4 text-slate-300" />
                <span className="font-black tabular-nums">{spectators.toLocaleString()}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">watching</span>
              </div>
            </div>
          </div>
        </div>

        {/* BODY: queue | arena | activity */}
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          <div className="relative min-w-0 2xl:h-[760px]">
            <QueueSidebar queue={fakeQueue} nextTurnSecs={nextTurn} />
          </div>

          <div className="min-w-0 space-y-3">
            {/* ARENA — dominant focal point */}
        <div className="relative grid min-w-0 grid-cols-1 items-stretch gap-6 overflow-hidden rounded-3xl border border-white/10 bg-black/15 p-4 backdrop-blur-md sm:p-6 lg:grid-cols-[minmax(0,1fr)_clamp(88px,9vw,132px)_minmax(0,1fr)] lg:gap-3 xl:p-8">
          <ArenaSide side="blue" team={teams.blue} onGift={() => openGift("blue")} triple={triple} />
          <CenterBeam />
          <ArenaSide side="red" team={teams.red} onGift={() => openGift("red")} />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <RoundInfo roundNo={roundNo} />
              <TrollUps onActivate={activate} active={abilities} />
            </div>
          </div>

          <div className="relative flex min-w-0 flex-col gap-3 2xl:h-[760px]">
            <div className="min-h-0 flex-1">
              <ActivityFeed feed={feed} />
            </div>
            <div className="min-h-0 flex-1">
              <DevArenaChat />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[11px] text-amber-200">
          <Sparkles className="h-4 w-4" />
          DEV PREVIEW — fake data, no Supabase calls. Polished esports-broadcast mock (v3).
          {abilities.length ? ` · Active Troll Ups: ${abilities.join(", ")}` : ""}
        </div>
      </div>
    </div>
  );
}