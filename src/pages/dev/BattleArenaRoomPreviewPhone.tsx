// ============================================================================
// MaiTroll Battle Arena — DEV VISUAL PREVIEW
// Premium green-vs-purple battle room concept. Mock visuals only:
// no LiveKit video, Supabase persistence, real gifting, or production chat.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { battleSound, initBattleAudio } from '../../lib/battleArenaSoundEngine';
import { battleHaptics } from '../../lib/battleArenaHaptics';
import {
  POWER_UPS, POWER_UP_POOL, SLOTS_PER_SIDE, randomPowerUp, POWER_UP_CONFIG,
  type PowerUpId, type Side,
} from '../../lib/battleArenaPowerUps';
import BattleArenaControls from './BattleArenaControls';
import {
  ArrowLeft, AudioLines, Crown, Flame, Gift,
  MessageCircle, Mic, MicOff, Send, ShieldCheck,
  Sparkles, Swords, Trophy, Users, Video, VideoOff, X, Zap,
} from 'lucide-react';

export type BattleSeatLike = string | {
  id?: string | number;
  userId?: string | number;
  user_id?: string | number;
  name?: string;
  username?: string;
  displayName?: string;
  display_name?: string;
  fullName?: string;
  userName?: string;
  user?: string | { id?: string | number; name?: string; username?: string; displayName?: string; display_name?: string };
  profile?: { name?: string; username?: string; displayName?: string; display_name?: string };
  participant?: { name?: string; username?: string; displayName?: string; display_name?: string };
  [key: string]: unknown;
};

export type BattleSeatGroups = {
  green?: BattleSeatLike[];
  purple?: BattleSeatLike[];
  challenger?: BattleSeatLike[];
  opponent?: BattleSeatLike[];
  teamGreen?: BattleSeatLike[];
  teamPurple?: BattleSeatLike[];
};

type RoomBattle = {
  id: string;
  challenger: string;
  opponent: string;
  scoreC: number;
  scoreO: number;
  viewers: number;
  mode: string;
  artC: string;
  artO: string;
  // Optional compatibility paths for seat data already attached to the battle object.
  greenSeats?: BattleSeatLike[];
  purpleSeats?: BattleSeatLike[];
  challengerSeats?: BattleSeatLike[];
  opponentSeats?: BattleSeatLike[];
  seats?: BattleSeatGroups | BattleSeatLike[];
  participants?: BattleSeatGroups | BattleSeatLike[];
  teamMembers?: BattleSeatGroups;
};

function getSeatName(seat: BattleSeatLike, fallbackIndex: number): string {
  if (typeof seat === 'string') return seat.trim() || `Seat ${fallbackIndex + 1}`;
  const user = seat.user && typeof seat.user === 'object' ? seat.user : undefined;
  const candidates = [
    seat.displayName, seat.display_name, seat.name, seat.username, seat.userName, seat.fullName,
    user?.displayName, user?.display_name, user?.name, user?.username,
    seat.profile?.displayName, seat.profile?.display_name, seat.profile?.name, seat.profile?.username,
    seat.participant?.displayName, seat.participant?.display_name, seat.participant?.name, seat.participant?.username,
  ];
  const found = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof found === 'string' ? found.trim() : `Seat ${fallbackIndex + 1}`;
}

function getSeatId(seat: BattleSeatLike, fallback: string): string {
  if (typeof seat === 'string') return seat;
  const id = seat.id ?? seat.userId ?? seat.user_id ?? (seat.user && typeof seat.user === 'object' ? seat.user.id : undefined);
  return id == null ? fallback : String(id);
}

function asSeatArray(value: unknown): BattleSeatLike[] {
  return Array.isArray(value) ? value.slice(0, 10) as BattleSeatLike[] : [];
}

function resolveBattleSeats(battle: RoomBattle, supplied?: BattleSeatGroups | BattleSeatLike[]) {
  const battleSeats = battle.seats;
  const battleParticipants = battle.participants;
  const suppliedGroups = supplied && !Array.isArray(supplied) ? supplied as BattleSeatGroups : undefined;
  const seatGroups = battleSeats && !Array.isArray(battleSeats) ? battleSeats as BattleSeatGroups : undefined;
  const participantGroups = battleParticipants && !Array.isArray(battleParticipants) ? battleParticipants as BattleSeatGroups : undefined;
  const teamMembers = battle.teamMembers;
  const suppliedList = Array.isArray(supplied) ? supplied : [];
  const participantList = Array.isArray(battleParticipants) ? battleParticipants : [];
  const genericList = Array.isArray(battleSeats) ? battleSeats : [];
  const isGreen = (seat: BattleSeatLike) => {
    if (typeof seat === 'string') return false;
    const value = String(seat.side ?? seat.team ?? seat.teamName ?? seat.position ?? '').toLowerCase();
    return ['green', 'challenger', 'left', 'team_green', 'team-green'].some((token) => value.includes(token));
  };
  const isPurple = (seat: BattleSeatLike) => {
    if (typeof seat === 'string') return false;
    const value = String(seat.side ?? seat.team ?? seat.teamName ?? seat.position ?? '').toLowerCase();
    return ['purple', 'opponent', 'right', 'team_purple', 'team-purple'].some((token) => value.includes(token));
  };
  const inferredGreen = [...suppliedList, ...participantList, ...genericList].filter(isGreen);
  const inferredPurple = [...suppliedList, ...participantList, ...genericList].filter(isPurple);
  const green = asSeatArray(suppliedGroups?.green ?? suppliedGroups?.challenger ?? suppliedGroups?.teamGreen ?? teamMembers?.green ?? teamMembers?.challenger ?? teamMembers?.teamGreen ?? seatGroups?.green ?? seatGroups?.challenger ?? seatGroups?.teamGreen ?? participantGroups?.green ?? participantGroups?.challenger ?? participantGroups?.teamGreen ?? battle.greenSeats ?? battle.challengerSeats ?? (inferredGreen.length ? inferredGreen : undefined));
  const purple = asSeatArray(suppliedGroups?.purple ?? suppliedGroups?.opponent ?? suppliedGroups?.teamPurple ?? teamMembers?.purple ?? teamMembers?.opponent ?? teamMembers?.teamPurple ?? seatGroups?.purple ?? seatGroups?.opponent ?? seatGroups?.teamPurple ?? participantGroups?.purple ?? participantGroups?.opponent ?? participantGroups?.teamPurple ?? battle.purpleSeats ?? battle.opponentSeats ?? (inferredPurple.length ? inferredPurple : undefined));
  // If the parent passes a plain array of unlabelled seat names, preserve order and split evenly
  // only when no side metadata is present. Explicitly tagged sides always take precedence.
  if (!green.length && !purple.length && (suppliedList.length || participantList.length || genericList.length)) {
    const unlabelled = [...suppliedList, ...participantList, ...genericList].filter((seat) => typeof seat === 'string' || (!isGreen(seat) && !isPurple(seat)));
    const midpoint = Math.ceil(unlabelled.length / 2);
    return { green: asSeatArray(unlabelled.slice(0, midpoint)), purple: asSeatArray(unlabelled.slice(midpoint)) };
  }
  return { green, purple };
}

const MOCK_CHAT = [
  { id: '1', user: 'trollfan_42', text: 'MAITROLL IS ON FIRE 🔥', side: 'left' },
  { id: '2', user: 'neonwatcher', text: 'PURPLE TEAM LOCK INNN 💜', side: 'right' },
  { id: '3', user: 'giftking', text: 'That comeback was CRAZY', side: 'left' },
  { id: '4', user: 'arena_mod', text: 'Keep it respectful. Let the battle cook.', side: 'system' },
  { id: '5', user: 'voidwalker', text: 'THIS SCORE IS TOO CLOSE 👀', side: 'right' },
  { id: '6', user: 'trollqueen', text: 'GREEN FIRE VS PURPLE FIRE ⚔️', side: 'left' },
];

const fmt = (n: number) => Math.max(0, Math.floor(n)).toLocaleString();

const MOCK_GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', cost: 10 },
  { id: 'fire', name: 'Fire', icon: '🔥', cost: 50 },
  { id: 'crown', name: 'Crown', icon: '👑', cost: 100 },
  { id: 'diamond', name: 'Diamond', icon: '💎', cost: 250 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', cost: 500 },
  { id: 'trophy', name: 'Trophy', icon: '🏆', cost: 1000 },
  { id: 'star', name: 'Star', icon: '⭐', cost: 75 },
  { id: 'heart', name: 'Heart', icon: '❤️', cost: 25 },
  { id: 'lightning', name: 'Bolt', icon: '⚡', cost: 300 },
  { id: 'dragon', name: 'Dragon', icon: '🐉', cost: 2000 },
];

function FireEmbers({ side }: { side: 'green' | 'purple' }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${side === 'green' ? 'ember-green' : 'ember-purple'}`}>
      {Array.from({ length: 14 }, (_, i) => (
        <motion.i
          key={i}
          className="ember"
          style={{
            left: `${(i * 37 + 7) % 100}%`,
            bottom: `${(i * 19) % 42 - 8}%`,
            width: `${3 + (i % 3)}px`,
            height: `${9 + (i % 4) * 4}px`,
          }}
          animate={{ y: [0, -130 - (i % 4) * 25], x: [0, (i % 2 ? 1 : -1) * (8 + i % 5) , 0], opacity: [0, 0.9, 0] , scale: [0.6, 1, 0.2] }}
          transition={{ duration: 2.4 + (i % 5) * 0.55, repeat: Infinity, delay: (i % 7) * 0.35, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function FighterPanel({
  name, score, side, art, lead, losing, onMic, onVideo, micOn, videoOn, chaos, compact = false, onClick, selected = false,
}: {
  name: string; score: number; side: 'green' | 'purple'; art: string;
  lead: boolean; losing: boolean; onMic: () => void; onVideo: () => void; micOn: boolean; videoOn: boolean; chaos?: boolean; compact?: boolean; onClick?: () => void; selected?: boolean;
}) {
  const green = side === 'green';
  return (
    <motion.section
      layout
      onClick={onClick}
      className={`fighter-panel ${compact ? 'fighter-panel-compact' : ''} ${green ? 'fighter-green' : 'fighter-purple'} ${lead ? 'fighter-leading' : ''} ${chaos ? 'chaos-active' : ''} ${onClick ? 'cursor-pointer' : ''} ${selected ? 'ring-4 ring-inset ring-yellow-300' : ''}`}
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      <div className={`fighter-art ${art}`} />
      <div className="arena-rings" />
      <div className="arena-pylon left" />
      <div className="arena-pylon right" />
      <div className="fighter-vignette" />
      <FireEmbers side={side} />
      <div className="fighter-scanlines" />
      <div className="fighter-topline">
        <span className={`live-pill ${green ? 'live-green' : 'live-purple'}`}><span /> LIVE FIGHTER</span>
        {lead && <motion.span className="lead-pill" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.5, repeat: Infinity }}><Crown size={11} /> IN THE LEAD</motion.span>}
      </div>
      <div className="fighter-content">
        <motion.div
          className={`fighter-avatar ${green ? 'avatar-green' : 'avatar-purple'}`}
          animate={{ y: [0, -5, 0], boxShadow: green
            ? ['0 0 28px #5dff9a35, inset 0 0 25px #5dff9a12', '0 0 55px #5dff9a65, inset 0 0 30px #5dff9a20', '0 0 28px #5dff9a35, inset 0 0 25px #5dff9a12']
            : ['0 0 28px #c084fc35, inset 0 0 25px #c084fc12', '0 0 55px #c084fc65, inset 0 0 30px #c084fc20', '0 0 28px #c084fc35, inset 0 0 25px #c084fc12']
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="avatar-ring" />
          <span>{name.slice(0, 2).toUpperCase()}</span>
          <div className="avatar-status"><span /></div>
        </motion.div>
        <div className="fighter-nameplate">
          <span className={`fighter-side-label ${green ? 'text-green' : 'text-purple'}`}>{name}</span>
          <h2>{name}</h2>
          <div className="fighter-status-line"><ShieldCheck size={12} /> VERIFIED FIGHTER <span>•</span> MAITROLL ARENA</div>
        </div>
      </div>
      <div className="fighter-score-wrap">
        <div className="fighter-score-label"><span>POWER SCORE</span><span className={green ? 'text-green' : 'text-purple'}><Flame size={12} /> LIVE POINTS</span></div>
        <motion.div key={score} className={`fighter-score ${green ? 'score-green' : 'score-purple'}`} initial={{ scale: 1.08, y: 3 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.25 }}>{fmt(score)}</motion.div>
        <div className="fighter-score-caption">{green ? 'GREEN FIRE' : 'PURPLE FIRE'} <span>•</span> {lead ? 'DOMINATING' : 'FIGHTING BACK'}</div>
        {losing && (
          <motion.div className={`help-callout ${green ? 'help-green' : 'help-purple'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
            <span className="help-fire"><Flame size={12} /></span>
            <span><strong>HELP {name.toUpperCase()}</strong><small>Send power. Turn the battle.</small></span>
            <span className="help-arrow">↗</span>
          </motion.div>
        )}
      </div>
      <div className="fighter-bottom">
        <div className="fighter-tools">
          <button aria-label={micOn ? 'Mute microphone' : 'Enable microphone'} onClick={(e) => { e.stopPropagation(); onMic(); }} className={micOn ? 'tool-active' : ''}>{micOn ? <Mic size={14} /> : <MicOff size={14} />}</button>
          <button aria-label={videoOn ? 'Turn camera off' : 'Turn camera on'} onClick={(e) => { e.stopPropagation(); onVideo(); }} className={videoOn ? 'tool-active' : ''}>{videoOn ? <Video size={14} /> : <VideoOff size={14} />}</button>
        </div>
        <span className="fighter-side-tag">{green ? 'TEAM GREEN' : 'TEAM PURPLE'}</span>
      </div>
      {selected && <div className="absolute inset-0 pointer-events-none z-50 ring-4 ring-inset ring-yellow-300" />}
    </motion.section>
  );
}

function getSeatScore(seat: BattleSeatLike, index: number, side: 'green' | 'purple'): number {
  if (typeof seat !== 'string') {
    const candidates = [seat.score, seat.points, seat.totalScore, seat.battleScore, seat.giftScore, seat.value];
    const found = candidates.find((value) => typeof value === 'number' && Number.isFinite(value));
    if (typeof found === 'number') return found;
  }
  const base = side === 'green' ? 1200 : 1100;
  return base + index * 340;
}

function BattleSeatCard({ seat, index, side, chaos = false, onClick, teamName, selected = false, scoreBoost = 0 }: { seat: BattleSeatLike; index: number; side: 'green' | 'purple'; chaos?: boolean; onClick?: () => void; teamName?: string; selected?: boolean; scoreBoost?: number }) {
  const name = getSeatName(seat, index);
  const green = side === 'green';
  const score = getSeatScore(seat, index, side) + (scoreBoost || 0);
  return (
    <motion.section layout onClick={onClick} className={`seat-fighter-card ${green ? 'seat-fighter-green' : 'seat-fighter-purple'} ${chaos ? 'chaos-active' : ''} ${onClick ? 'cursor-pointer' : ''} ${selected ? 'ring-4 ring-inset ring-yellow-300' : ''}`} initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .3 }}>
      <div className="seat-card-top"><span className="seat-live-dot" /> <span>LIVE SEAT {index + 1}</span></div>
      <div className="seat-card-avatar">{name.slice(0, 2).toUpperCase()}</div>
      <div className="seat-card-name" title={name}>{name}</div>
      <div className="seat-card-score">{fmt(score)}</div>
      <div className="seat-card-team">{teamName || (green ? 'TEAM GREEN' : 'TEAM PURPLE')}</div>
    </motion.section>
  );
}

export default function BattleArenaRoomPreviewPhone({
  battle,
  onClose,
  seats,
  greenSeats,
  purpleSeats,
}: {
  battle: RoomBattle;
  onClose: () => void;
  /** Pass the live seat collection from BroadcastPage here; grouped and flat arrays are supported. */
  seats?: BattleSeatGroups | BattleSeatLike[];
  greenSeats?: BattleSeatLike[];
  purpleSeats?: BattleSeatLike[];
}) {
  const [timeLeft, setTimeLeft] = useState(168);
  const [scoreC, setScoreC] = useState(battle.scoreC);
  const [scoreO, setScoreO] = useState(battle.scoreO);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatHighlight, setChatHighlight] = useState(false);
  const [chat, setChat] = useState(MOCK_CHAT);
  const [micC, setMicC] = useState(true);
  const [micO, setMicO] = useState(false);
  const [videoC, setVideoC] = useState(true);
  const [videoO, setVideoO] = useState(true);
  const [ultimateFlash, setUltimateFlash] = useState<Side | null>(null);
  const [powerSlots, setPowerSlots] = useState<{ green: PowerUpId[]; purple: PowerUpId[] }>({ green: [], purple: [] });
  const [activeEffects, setActiveEffects] = useState<{ green: { id: PowerUpId; expiresAt: number }[]; purple: { id: PowerUpId; expiresAt: number }[] }>({ green: [], purple: [] });
  const [mockBalance, setMockBalance] = useState<{ green: number; purple: number }>({ green: 1000, purple: 1000 });
  const [powerBar, setPowerBar] = useState<{ green: number; purple: number }>({ green: 0, purple: 0 });
  const [likes, setLikes] = useState<{ green: number; purple: number }>({ green: 0, purple: 0 });
  const [powerAnnounce, setPowerAnnounce] = useState<string>('');
  const [showPowerPanel, setShowPowerPanel] = useState<Side | null>(null);
  const [openBag, setOpenBag] = useState<Side | null>(null);
  const [selectedGift, setSelectedGift] = useState(MOCK_GIFTS[0]);
  const [arenaGifts, setArenaGifts] = useState<any[]>([]);
  const [selectedPower, setSelectedPower] = useState<PowerUpId | null>(null);
  const [fullSlotsMsg, setFullSlotsMsg] = useState<Side | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [round, setRound] = useState(1);
  const [seatCounts, setSeatCounts] = useState<{ green: number; purple: number }>({ green: 4, purple: 4 });
  const [viewAs, setViewAs] = useState<'green' | 'purple' | 'neutral'>('neutral');
  const [greenWins, setGreenWins] = useState(0);
  const [purpleWins, setPurpleWins] = useState(0);
  const [battleWinner, setBattleWinner] = useState<'green' | 'purple' | 'draw' | null>(null);
  const [rematchGreen, setRematchGreen] = useState(false);
  const [rematchPurple, setRematchPurple] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [seatScoreMap, setSeatScoreMap] = useState<Record<string, number>>({});
  const [suddenDeath, setSuddenDeath] = useState(false);
  useEffect(() => {
    if (rematchGreen && rematchPurple) {
      setSuddenDeath(true);
      setRematchGreen(false);
      setRematchPurple(false);
      setTimeLeft(60);
      setScoreC(0);
      setScoreO(0);
      setPowerBar({ green: 0, purple: 0 });
      setActiveEffects({ green: [], purple: [] });
      setChaosSide(null);
      clearCombat();
      window.setTimeout(() => startCombat(), 0);
    }
  }, [rematchGreen, rematchPurple]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.from('gift_items').select('*').order('coin_cost', { ascending: true });
        if (!active) return;
        if (data && data.length) {
          const mapped = data
            .filter((g: any) => !!g.video_url)
            .map((g: any) => ({
              id: g.id,
              name: (g.name || '').replace(/^gift_/, ''),
              icon: g.icon || '🎁',
              cost: g.coin_cost || g.value || 0,
              videoUrl: g.video_url,
            }));
          if (mapped.length) setArenaGifts(mapped);
        }
      } catch {
        // keep mock gifts
      }
    })();
    return () => { active = false; };
  }, []);
  const resolvedSeats = useMemo(() => {
    const grouped = resolveBattleSeats(battle, seats);
    return {
green: asSeatArray(greenSeats ?? grouped.green).filter((seat) => getSeatName(seat, 0).toLowerCase() !== battle.challenger.toLowerCase()).slice(0, 5),
       purple: asSeatArray(purpleSeats ?? grouped.purple).filter((seat) => getSeatName(seat, 0).toLowerCase() !== battle.opponent.toLowerCase()).slice(0, 5),
    };
  }, [battle, seats, greenSeats, purpleSeats]);
  const displaySeats = useMemo(() => ({
    green: resolvedSeats.green.length
      ? resolvedSeats.green
      : Array.from({ length: seatCounts.green }, (_, i) => `Green Seat ${i + 1}` as BattleSeatLike),
    purple: resolvedSeats.purple.length
      ? resolvedSeats.purple
      : Array.from({ length: seatCounts.purple }, (_, i) => `Purple Seat ${i + 1}` as BattleSeatLike),
  }), [resolvedSeats, seatCounts]);
  const greenSeatScoreTotal = useMemo(() => displaySeats.green.reduce((sum, seat, index) => sum + getSeatScore(seat, index, 'green') + (seatScoreMap[`green-${index}`] || 0), 0), [displaySeats.green, seatScoreMap]);
  const purpleSeatScoreTotal = useMemo(() => displaySeats.purple.reduce((sum, seat, index) => sum + getSeatScore(seat, index, 'purple') + (seatScoreMap[`purple-${index}`] || 0), 0), [displaySeats.purple, seatScoreMap]);
  const greenFighterCount = 1 + displaySeats.green.length;
  const purpleFighterCount = 1 + displaySeats.purple.length;
  const totalScoreC = scoreC + greenSeatScoreTotal;
  const totalScoreO = scoreO + purpleSeatScoreTotal;

  const activeEffectsRef = useRef(activeEffects);
  activeEffectsRef.current = activeEffects;
  const showWinnerRef = useRef(showWinner);
  showWinnerRef.current = showWinner;
  const [chaosSide, setChaosSide] = useState<Side | null>(null);
  const roundRef = useRef(round);
  roundRef.current = round;
  const greenWinsRef = useRef(greenWins);
  greenWinsRef.current = greenWins;
  const purpleWinsRef = useRef(purpleWins);
  purpleWinsRef.current = purpleWins;
  const scoreCRef = useRef(scoreC);
  scoreCRef.current = scoreC;
  const scoreORef = useRef(scoreO);
  scoreORef.current = scoreO;
  const greenSeatTotalRef = useRef(greenSeatScoreTotal);
  greenSeatTotalRef.current = greenSeatScoreTotal;
  const purpleSeatTotalRef = useRef(purpleSeatScoreTotal);
  purpleSeatTotalRef.current = purpleSeatScoreTotal;

  useEffect(() => {
    const t = window.setInterval(() => {
      const effects = [...activeEffectsRef.current.green, ...activeEffectsRef.current.purple];
      const turtleActive = effects.some((e) => e.id === 'turtle' && (e.expiresAt === 0 || e.expiresAt > Date.now()));
      const speedActive = effects.some((e) => e.id === 'speed' && (e.expiresAt === 0 || e.expiresAt > Date.now()));
      const step = (turtleActive || speedActive) ? 2 : 1;
      setTimeLeft((v) => {
        if (v <= step) {
          if (suddenDeath) {
            setScoreC(0); setScoreO(0); setPowerBar({ green: 0, purple: 0 }); setActiveEffects({ green: [], purple: [] }); setChaosSide(null); setSeatScoreMap({}); clearCombat(); window.setTimeout(() => startCombat(), 0); setSuddenDeath(false);
            return 168;
          }
const c = scoreCRef.current + greenSeatTotalRef.current;
           const o = scoreORef.current + purpleSeatTotalRef.current;
          let ng = greenWinsRef.current;
          let np = purpleWinsRef.current;
          if (c > o) ng += 1;
          else if (o > c) np += 1;
          setGreenWins(ng);
          setPurpleWins(np);
          const r = roundRef.current;
          if (ng >= 2 || np >= 2 || r >= 3) {
            setBattleWinner(ng > np ? 'green' : np > ng ? 'purple' : 'draw');
            setShowWinner(true);
            clearCombat();
            window.clearInterval(t);
            return 0;
          }
          setRound(r + 1);
          setScoreC(0);
          setScoreO(0);
          setActiveEffects({ green: [], purple: [] });
          setChaosSide(null);
          setSeatScoreMap({});
          clearCombat();
          // restart combat next tick
          window.setTimeout(() => startCombat(), 0);
          return 168;
        }
        return v - step;
      });
      // Small score ticks are preview-only, to demonstrate animated score updates.
      setScoreC((v) => v + Math.floor(Math.random() * 4));
      setScoreO((v) => v + Math.floor(Math.random() * 4));
      setPowerBar((prev) => ({ green: Math.min(500, prev.green + Math.max(5, Math.round(25 / roundRef.current))), purple: Math.min(500, prev.purple + Math.max(5, Math.round(25 / roundRef.current))) }));
    }, 1800);
    return () => window.clearInterval(t);
  }, []);

  const total = Math.max(1, totalScoreC + totalScoreO);
  const cPct = (totalScoreC / total) * 100;
  const oPct = 100 - cPct;
  const challengerLeads = totalScoreC >= totalScoreO;
  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, '0');
  const danger = timeLeft <= 15;
  const _leader = challengerLeads ? battle.challenger : battle.opponent;

  const momentum = useMemo(() => Math.abs(totalScoreC - totalScoreO) / total * 100, [totalScoreC, totalScoreO, total]);

  const sendChat = () => {
    const value = chatText.trim();
    if (!value) return;
    setChat((prev) => [...prev, { id: `${Date.now()}`, user: 'you', text: value, side: 'left' }]);
    setChatText('');
    setChatHighlight(true);
    window.setTimeout(() => setChatHighlight(false), 1200);
  };

  const sendGift = (target: string, giftCost = 250) => {
    const side: Side = target.startsWith('green') ? 'green' : 'purple';
    const baseGift = giftCost;
    const bonus = isActiveEffect(side, 'crown') ? Math.round(baseGift * 0.2) : 0;
    const isHost = target === side || target.endsWith('host');
    if (isHost) {
      if (side === 'green') setScoreC((v) => v + baseGift + bonus);
      else setScoreO((v) => v + baseGift + bonus);
    } else {
      setSeatScoreMap((prev) => ({ ...prev, [target]: (prev[target] || 0) + baseGift + bonus }));
    }
    setPowerBar((prev) => ({ ...prev, [side]: Math.min(500, prev[side] + Math.max(10, Math.round(50 / roundRef.current))) }));
    battleSound.play('gift');
    battleSound.play('score_up');
    battleHaptics.vibrate('gift');
    battleSound.announce('powerup_awarded', false);
    // gift-triggered random power-up
    if (Math.random() < POWER_UP_CONFIG.giftTriggerChance) {
      setPowerSlots((prev) => {
        if (prev[side].length >= SLOTS_PER_SIDE) {
          setFullSlotsMsg(side);
          window.setTimeout(() => setFullSlotsMsg(null), 2000);
          return prev;
        }
        const pu = randomPowerUp();
        setPowerAnnounce(`${side === 'green' ? battle.challenger : battle.opponent} received ${POWER_UPS[pu].name}`);
        window.setTimeout(() => setPowerAnnounce(''), 2500);
        battleSound.play('powerup_awarded');
        battleSound.announce('powerup_awarded', false);
        battleHaptics.vibrate('powerup_awarded');
        return { ...prev, [side]: [...prev[side], pu] };
      });
    }
  };

  const activatePower = (side: Side, index: number) => {
    const pu = powerSlots[side][index];
    if (!pu) return;
    // validate ultimate requires full meter
    if (pu === 'ultimate' && powerBar[side] < 500) {
      setPowerAnnounce(`${side === 'green' ? battle.challenger : battle.opponent} needs full power meter`);
      window.setTimeout(() => setPowerAnnounce(''), 2000);
      return;
    }
    // remove selected slot instance only
    setPowerSlots((prev) => ({
      ...prev,
      [side]: prev[side].filter((_, i) => i !== index),
    }));
    const def = POWER_UPS[pu];
    const expiresAt = def.duration > 0 ? Date.now() + def.duration * 1000 : 0;
    setActiveEffects((prev) => ({ ...prev, [side]: [...prev[side], { id: pu, expiresAt }] }));
    // apply effects
    if (pu === 'surge') {
      setPowerBar((prev) => ({ ...prev, [side]: Math.min(500, prev[side] + 100) }));
    }
    if (pu === 'tax') {
      if (side === 'green') setScoreC((v) => Math.max(0, v - 500)); else setScoreO((v) => Math.max(0, v - 500));
      battleSound.play('tax');
      battleSound.play('score_down');
    }
    if (pu === 'chaos') {
      const opp: Side = side === 'green' ? 'purple' : 'green';
      chaosUntil.current[opp] = Date.now() + 3000;
      setChaosSide(opp);
      window.setTimeout(() => { if (Date.now() >= chaosUntil.current[opp]) setChaosSide(null); }, 3000);
    }
    if (pu === 'ultimate') {
      setPowerBar((prev) => ({ ...prev, [side]: 0 }));
      if (side === 'green') setScoreC((v) => v + 1000); else setScoreO((v) => v + 1000);
      setUltimateFlash(side);
      window.setTimeout(() => setUltimateFlash(null), 1600);
    }
    const soundMap: Record<PowerUpId, any> = {
      turtle: 'turtle', speed: 'speed', overcharge: 'overcharge', shield: 'powerup_activated',
      crit: 'crit', surge: 'surge', chaos: 'chaos', ultimate: 'ultimate', crown: 'crown', tax: 'tax',
      ghost: undefined
    };
    battleSound.play(soundMap[pu]);
    const announceMap: Record<PowerUpId, any> = {
      turtle: 'turtle', speed: 'speed', overcharge: 'overcharge', shield: 'shield',
      crit: 'crit', surge: 'surge', chaos: 'chaos', ultimate: 'ultimate', crown: 'crown_booster', tax: 'tax',
      ghost: undefined
    };
    battleSound.announce(announceMap[pu], pu === 'ultimate');
    battleHaptics.vibrate(pu === 'ultimate' ? 'ultimate' : 'powerup_activated');
    setPowerAnnounce(`${side === 'green' ? battle.challenger : battle.opponent} activated ${def.name}`);
    window.setTimeout(() => setPowerAnnounce(''), 2500);
  };

  const tryActivate100 = (side: Side) => {
    if (mockBalance[side] < POWER_UP_CONFIG.activationCost) {
      setPowerAnnounce(`${side === 'green' ? battle.challenger : battle.opponent} cannot afford 100 coins`);
      window.setTimeout(() => setPowerAnnounce(''), 2000);
      return;
    }
    if (powerSlots[side].length >= SLOTS_PER_SIDE) {
      setFullSlotsMsg(side);
      window.setTimeout(() => setFullSlotsMsg(null), 2000);
      return;
    }
    setShowPowerPanel(side);
    setSelectedPower(null);
  };

  const resetDemo = () => {
    setScoreC(battle.scoreC); setScoreO(battle.scoreO); setTimeLeft(168); setShowWinner(false); setRound(1); setGreenWins(0); setPurpleWins(0); setBattleWinner(null); setPowerBar({ green: 0, purple: 0 }); setActiveEffects({ green: [], purple: [] }); setChaosSide(null); setSeatScoreMap({}); clearCombat(); window.setTimeout(() => startCombat(), 0);
  };

  const confirmPowerPanel = () => {
    if (!showPowerPanel || !selectedPower) return;
    const side = showPowerPanel;
    setMockBalance((prev) => ({ ...prev, [side]: prev[side] - POWER_UP_CONFIG.activationCost }));
    setPowerSlots((prev) => ({ ...prev, [side]: [...prev[side], selectedPower] }));
    setPowerAnnounce(`${side === 'green' ? battle.challenger : battle.opponent} purchased ${POWER_UPS[selectedPower].name}`);
    window.setTimeout(() => setPowerAnnounce(''), 2500);
    battleSound.play('powerup_awarded');
    battleHaptics.vibrate('powerup_awarded');
    setShowPowerPanel(null);
    setSelectedPower(null);
  };

  // expire timed effects
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      setActiveEffects((prev) => ({
        green: prev.green.filter((e) => e.expiresAt === 0 || e.expiresAt > now),
        purple: prev.purple.filter((e) => e.expiresAt === 0 || e.expiresAt > now),
      }));
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  // combat scheduling
  const attackTimers = useRef<{ green: number | null; purple: number | null }>({ green: null, purple: null });
  const chaosUntil = useRef<{ green: number; purple: number }>({ green: 0, purple: 0 });

  const clearCombat = () => {
    if (attackTimers.current.green) { window.clearTimeout(attackTimers.current.green); attackTimers.current.green = null; }
    if (attackTimers.current.purple) { window.clearTimeout(attackTimers.current.purple); attackTimers.current.purple = null; }
  };

  const consumeEffect = (side: Side, id: PowerUpId) => {
    setActiveEffects((prev) => {
      const arr = [...prev[side]];
      const idx = arr.findIndex((e) => e.id === id);
      if (idx >= 0) arr.splice(idx, 1);
      return { ...prev, [side]: arr };
    });
  };

  const ghostActive = (side: Side) => activeEffectsRef.current[side].some((e) => e.id === 'ghost' && (e.expiresAt === 0 || e.expiresAt > Date.now()));

  const isActiveEffect = (side: Side, id: PowerUpId) => {
    const now = Date.now();
    return activeEffectsRef.current[side].some((e) => e.id === id && (e.expiresAt === 0 || e.expiresAt > now));
  };

  const doAttack = (attacker: Side) => {
    if (showWinnerRef.current) return;
    const defender: Side = attacker === 'green' ? 'purple' : 'green';
    let damage = 50;
    if (isActiveEffect(attacker, 'overcharge')) damage *= 1.25;
    const crit = isActiveEffect(attacker, 'crit');
    if (crit) { damage *= 2; consumeEffect(attacker, 'crit'); }
    if (isActiveEffect(defender, 'turtle')) damage *= 0.4;
    let blocked = false;
    if (isActiveEffect(defender, 'shield') && damage > 0) { blocked = true; damage = 0; consumeEffect(defender, 'shield'); battleSound.play('shield_block'); battleHaptics.vibrate('shield_block'); }
    damage = Math.max(0, Math.round(damage));
    let earned = damage;
    if (damage > 0 && isActiveEffect(attacker, 'crown')) { earned += Math.round(damage * 0.2); }
    if (attacker === 'green') setScoreC((v) => v + earned); else setScoreO((v) => v + earned);
    if (blocked) {
      // no score
    } else if (damage > 0) {
      battleSound.play('hit');
      if (crit) { battleSound.play('crit'); battleSound.announce('crit', false); }
    }
    const speedActive = isActiveEffect(attacker, 'speed');
    const delay = speedActive ? 1333 : 2000;
    attackTimers.current[attacker] = window.setTimeout(() => doAttack(attacker), delay);
  };

  const startCombat = () => {
    clearCombat();
    attackTimers.current.green = window.setTimeout(() => doAttack('green'), 1000);
    attackTimers.current.purple = window.setTimeout(() => doAttack('purple'), 1500);
  };

  useEffect(() => { initBattleAudio(); }, []);
  useEffect(() => {
    startCombat();
    return () => clearCombat();
  }, []);

  // chaos pulse visual expiry
  // (handled where activated)

  return (
    <div className="mt-battle-root fixed inset-0 z-[70] flex flex-col overflow-hidden text-white">
      <style>{`
        .mt-battle-root{--green:#63ff9b;--green2:#0ee78b;--purple:#c084fc;--purple2:#8b5cf6;background:#05070b;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .mt-battle-root *{box-sizing:border-box}
        .mt-battle-root button svg{width:22px;height:22px}
        .mt-battle-root button{transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}
        .mt-battle-root button:active{transform:scale(.96)}
        .arena-grid{background-image:linear-gradient(#ffffff04 1px,transparent 1px),linear-gradient(90deg,#ffffff04 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(to bottom,black,transparent 92%)}
        .arena-glow{position:absolute;inset:-25%;pointer-events:none;filter:blur(72px);opacity:.3;background:radial-gradient(ellipse at 20% 45%,#16f28b 0%,transparent 30%),radial-gradient(ellipse at 80% 45%,#9b5cf6 0%,transparent 32%)}
        .arena-architecture{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:.72;background:radial-gradient(ellipse at 50% 57%,transparent 0 25%,#0008 58%,#000d 100%)}
        .arena-architecture:before{content:'';position:absolute;inset:0;background:repeating-conic-gradient(from 250deg at 50% 38%,#ffffff00 0deg 4deg,#ffffff0a 4.3deg 4.7deg,#ffffff00 5deg 10deg);mask-image:radial-gradient(ellipse at 50% 40%,black,transparent 70%)}
        .arena-architecture:after{content:'';position:absolute;left:10%;right:10%;top:0;height:58%;border:1px solid #ffffff0a;border-bottom:0;border-radius:48% 48% 0 0;box-shadow:0 0 0 20px #ffffff03,0 0 0 42px #ffffff02,inset 0 0 45px #ffffff03}
        .arena-floor{position:absolute;left:-8%;right:-8%;bottom:-5%;height:34%;pointer-events:none;background:linear-gradient(180deg,transparent,#030408b8 28%,#030408f5 100%),repeating-linear-gradient(90deg,transparent 0 10%,#ffffff05 10.2% 10.35%),repeating-linear-gradient(0deg,transparent 0 20%,#ffffff04 20.2% 20.5%);transform:perspective(280px) rotateX(35deg);transform-origin:bottom center;mask-image:linear-gradient(transparent,black 35%)}
        .arena-beam{position:absolute;top:-10%;height:76%;width:2px;opacity:.24;filter:blur(1px);transform-origin:top center;pointer-events:none;background:linear-gradient(180deg,transparent,#63ff9b,transparent)}
        .arena-beam.beam-purple{background:linear-gradient(180deg,transparent,#c084fc,transparent)}
        .arena-topbar{position:relative;z-index:10;display:flex;align-items:center;gap:12px;padding:12px clamp(12px,2.4vw,30px);border-bottom:1px solid #ffffff12;background:#05070bd9;backdrop-filter:blur(22px);flex-shrink:0}
        .mt-brand-mark{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#63ff9b,#9b5cf6);color:#05070b;box-shadow:0 0 28px #7bffb82a}
        .brand-word{font-weight:1000;font-size:13px;letter-spacing:.12em;line-height:1.1}.brand-sub{margin-top:4px;color:#ffffff57;font-size:9px;font-weight:800;letter-spacing:.2em}
        .top-chip{display:flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid #ffffff13;border-radius:12px;background:#ffffff06;color:#cbd1dc;font-size:11px;font-weight:800}
        .top-chip svg{color:#aeb8c7}.top-icon{display:flex;align-items:center;justify-content:center;width:35px;height:35px;border:1px solid #ffffff15;border-radius:11px;background:#ffffff06;color:#c8ced8}
        .arena-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px clamp(12px,2.4vw,30px) 12px;position:relative;z-index:2;flex-shrink:0}
        .eyebrow{display:flex;align-items:center;gap:7px;color:#9ba4b5;font-size:9px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}
        .arena-title{font-size:clamp(20px,2.7vw,31px);font-weight:1000;letter-spacing:-.055em;line-height:1.1;margin:5px 0 0}.arena-title em{font-style:normal;background:linear-gradient(90deg,#63ff9b 0%,#d7ffe5 45%,#c084fc 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
        .arena-tagline{color:#737d8d;font-size:10px;margin-top:6px}
        .timer-box{min-width:106px;padding:9px 14px;border:1px solid #ffffff16;border-radius:14px;background:#0b0e15;text-align:center;box-shadow:inset 0 1px #ffffff08}
        .timer-label{color:#7c8798;font-size:8px;font-weight:900;letter-spacing:.2em}.timer-value{font-variant-numeric:tabular-nums;font-size:23px;font-weight:1000;letter-spacing:.05em;margin-top:2px}
        .timer-danger{border-color:#fb718566;background:#fb718511;box-shadow:0 0 24px #fb71851a}        .timer-danger .timer-value{color:#ff9eaf;animation:timerPulse .75s infinite alternate}
        @keyframes timerPulse{to{ text-shadow:0 0 18px #fb7185; }}
        .chaos-active{animation:chaosShake .12s infinite;filter:hue-rotate(90deg) saturate(2) contrast(1.4)}
        @keyframes chaosShake{0%{transform:translate(0,0)}25%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0,0)}}
        .power-bar{width:120px;height:12px;border:1px solid #ffffff20;border-radius:999px;background:#0b0e15;overflow:hidden}
        .power-bar-fire{height:100%;border-radius:999px;transition:width .3s}
        .power-bar-fire.green{background:linear-gradient(90deg,#079e5d,#63ff9b);box-shadow:0 0 8px #63ff9b}
        .power-bar-fire.purple{background:linear-gradient(90deg,#7125cf,#c084fc);box-shadow:0 0 8px #c084fc}
        .power-bar-side{position:absolute;top:12px;bottom:12px;width:16px;background:#0b0e15;border:1px solid #ffffff20;border-radius:8px;overflow:visible;z-index:3}
.power-bar-side.left{left:-12px}
.power-bar-side.right{right:-12px}
        .power-bar-side .power-bar-fire.red{position:absolute;bottom:0;left:0;right:0;border-radius:0 0 7px 7px;background:linear-gradient(180deg,#fff1a0 0%,#ffb13b 12%,#f85725 45%,#ad1720 100%);box-shadow:0 0 7px #ff5b27,0 0 15px #f0442490;transition:height .3s}
        .power-bar-side .power-bar-fire.red:before,.power-bar-side .power-bar-fire.red:after{content:'';position:absolute;bottom:calc(100% - 2px);pointer-events:none;transform-origin:50% 100%;border-radius:54% 46% 48% 52% / 72% 70% 30% 28%}
        .power-bar-side .power-bar-fire.red:before{left:-5px;width:24px;height:24px;background:radial-gradient(ellipse at 48% 76%,#fff5a6 0 8%,#ffd34e 19%,#ff922e 39%,#f34b23 62%,rgba(226,48,29,0) 78%);filter:drop-shadow(0 0 4px #ff6329);animation:powerFlameFlicker .42s ease-in-out infinite alternate}
        .power-bar-side .power-bar-fire.red:after{left:0;width:14px;height:18px;background:radial-gradient(ellipse at 52% 78%,#fffde0 0 12%,#fff09a 27%,#ffc13c 51%,rgba(255,126,30,0) 78%);filter:drop-shadow(0 0 3px #ffd65a);animation:powerFlameFlicker .29s ease-in-out infinite alternate-reverse}
        @keyframes powerFlameFlicker{0%{transform:scale(.88,.9) rotate(-7deg);opacity:.82}45%{transform:scale(1.02,1.08) rotate(4deg);opacity:1}100%{transform:scale(.94,1.16) rotate(-2deg);opacity:.9}}
        @media(prefers-reduced-motion:reduce){.power-bar-side .power-bar-fire.red:before,.power-bar-side .power-bar-fire.red:after{animation:none}}
        .scoreboard{position:relative;z-index:2;margin:0 clamp(12px,2.4vw,30px) 13px;padding:12px clamp(12px,2.4vw,30px) 14px;border:1px solid #ffffff14;border-radius:18px;background:linear-gradient(110deg,#0a1511ed,#0c0d15ed 48%,#160d20ed);box-shadow:0 14px 45px #0007,inset 0 1px #ffffff09;flex-shrink:0}
        .score-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:0;min-height:48px}.score-side:first-child{padding-right:38px}.score-side.right{padding-left:38px}.score-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2}
        .score-side{display:flex;align-items:center;gap:9px;min-width:0;justify-content:space-between}.score-side.right{justify-content:space-between;text-align:right}
        .score-orb{width:10px;height:10px;border-radius:50%;flex-shrink:0}.score-orb.green{background:var(--green);box-shadow:0 0 14px #63ff9b}.score-orb.purple{background:var(--purple);box-shadow:0 0 14px #c084fc}
        .score-name{color:#d9e0e9;font-size:clamp(10px,1.1vw,13px);font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.score-number{font-size:clamp(18px,2.3vw,27px);font-weight:1000;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap}.score-number.green{color:#a8ffc6;text-shadow:0 0 19px #63ff9b40}.score-number.purple{color:#e3c3ff;text-shadow:0 0 19px #c084fc40}
        .score-vs{display:flex;align-items:center;justify-content:center;gap:7px;width:54px;text-align:center;color:#7b8493;font-size:9px;font-weight:1000;letter-spacing:.18em;white-space:nowrap;pointer-events:none}.score-vs:before,.score-vs:after{content:'';width:14px;height:1px;flex:0 0 14px;background:#ffffff23}
        .fire-track{position:relative;height:17px;margin-top:12px;border:1px solid #151923;border-radius:999px;background:linear-gradient(90deg,#16d879 0%,#16d879 50%,#963fea 50%,#963fea 100%);overflow:hidden;box-shadow:inset 0 1px 3px #0008}
        .fire-green{position:absolute;left:0;top:0;bottom:0;border-radius:999px 0 0 999px;background:linear-gradient(90deg,#079e5d 0%,#16d879 55%,#63ff9b 100%);box-shadow:0 0 12px #34f28b,0 0 27px #34f28b8a;transition:width .65s cubic-bezier(.22,1,.36,1)}
        .fire-purple{position:absolute;right:0;top:0;bottom:0;border-radius:0 999px 999px 0;background:linear-gradient(270deg,#7125cf 0%,#963fea 55%,#c084fc 100%);box-shadow:0 0 12px #b65cff,0 0 27px #a855f78a;transition:width .65s cubic-bezier(.22,1,.36,1)}
        .fire-track{isolation:isolate;border-color:#151923}
        .fire-track:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(99,255,155,.10),transparent 48%,rgba(192,132,252,.10));pointer-events:none;border-radius:inherit}
        .score-meta{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;color:#778293;font-size:8px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;min-height:12px}.score-meta>span:nth-child(2){position:absolute;left:50%;transform:translateX(-50%);text-align:center;white-space:nowrap;z-index:1}.score-meta>span:first-child{margin-right:auto;text-align:left}.score-meta>span:last-child{margin-left:auto;text-align:right}.score-meta .green-label{color:#73ffab}.score-meta .purple-label{color:#d5a3ff}
        .arena-body{position:relative;z-index:1;display:flex;flex:1;min-height:0;padding:0 clamp(12px,2.4vw,30px) 14px;gap:13px}
        .stage-column{position:relative;display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}
        .fighter-grid{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:11px;flex:1;min-height:230px}
        .team-fighter-grid{display:grid;grid-template-columns:repeat(var(--team-columns,1),minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:8px;min-width:0;min-height:230px;}
        .fighter-panel-compact .fighter-topline{top:8px;left:7px;right:7px;justify-content:center}
        .fighter-panel-compact .live-pill{font-size:6px;padding:4px 5px;letter-spacing:.04em}
        .fighter-panel-compact .lead-pill{display:none}
        .fighter-panel-compact .fighter-content{inset:15% 4% 27%}
        .fighter-panel-compact .fighter-avatar{width:clamp(34px,4.8vw,62px);height:clamp(34px,4.8vw,62px);border-radius:15px;font-size:clamp(15px,2vw,24px)}
        .fighter-panel-compact .avatar-ring{inset:-5px;border-radius:19px}
        .fighter-panel-compact .avatar-ring:after{inset:4px;border-radius:13px}
        .fighter-panel-compact .avatar-status{width:13px;height:13px;right:-4px;bottom:-4px}
        .fighter-panel-compact .avatar-status span{width:5px;height:5px}
        .fighter-panel-compact .fighter-nameplate{margin-top:9px}
        .fighter-panel-compact .fighter-side-label{font-size:6px;letter-spacing:.06em}
        .fighter-panel-compact .fighter-nameplate h2{font-size:clamp(10px,1.2vw,15px);margin:4px 0;overflow-wrap:anywhere}
        .fighter-panel-compact .fighter-status-line{font-size:5px;letter-spacing:0;gap:2px;flex-wrap:wrap}
        .fighter-panel-compact .fighter-status-line svg{width:9px;height:9px}
        .fighter-panel-compact .fighter-score-wrap{bottom:34px;left:5px;right:5px}
        .fighter-panel-compact .fighter-score-label{font-size:5px;letter-spacing:0}
        .fighter-panel-compact .fighter-score{font-size:clamp(16px,2.1vw,25px)}
        .fighter-panel-compact .fighter-score-caption{font-size:5px;letter-spacing:.02em}
        .fighter-panel-compact .help-callout{display:none}
        .fighter-panel-compact .fighter-bottom{left:5px;right:5px;bottom:5px;justify-content:center}
        .fighter-panel-compact .fighter-tools{display:none}
        .fighter-panel-compact .fighter-side-tag{font-size:5px;padding:4px 5px;letter-spacing:.05em}
        .seat-fighter-card{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(5px,1vh,10px);min-width:0;min-height:0;overflow:hidden;border:1px solid #ffffff18;border-radius:15px;background:radial-gradient(ellipse at 50% 25%,#ffffff0b,transparent 60%),#090d13;isolation:isolate}
        .seat-fighter-card:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(150deg,rgba(var(--seat-rgb),.12),transparent 50%,rgba(var(--seat-rgb),.07));}
        .seat-fighter-green{--seat-rgb:99,255,155;border-color:#63ff9b38}.seat-fighter-purple{--seat-rgb:192,132,252;border-color:#c084fc38}
        .seat-card-top{position:absolute;top:8px;left:7px;right:7px;display:flex;justify-content:center;align-items:center;gap:4px;color:#d9e0e9;font-size:clamp(5px,.55vw,8px);font-weight:1000;letter-spacing:.08em;white-space:nowrap}
        .seat-live-dot{width:5px;height:5px;border-radius:50%;background:#ff617e;box-shadow:0 0 8px #ff617e;flex-shrink:0}
        .seat-card-avatar{display:grid;place-items:center;width:clamp(32px,4.2vw,58px);aspect-ratio:1;border:1px solid rgba(var(--seat-rgb),.55);border-radius:clamp(10px,1vw,16px);background:rgba(var(--seat-rgb),.1);color:rgb(var(--seat-rgb));font-size:clamp(14px,1.8vw,23px);font-weight:1000;box-shadow:0 0 24px rgba(var(--seat-rgb),.08)}
        .seat-card-name{max-width:95%;padding:0 4px;color:#f1f5f9;font-size:clamp(9px,1vw,14px);font-weight:900;text-align:center;overflow-wrap:anywhere;line-height:1.2}
        .seat-card-score{color:#f1f5f9;font-size:clamp(11px,1.3vw,18px);font-weight:1000;text-align:center;font-variant-numeric:tabular-nums;text-shadow:0 0 12px rgba(var(--seat-rgb),.35)}
        .seat-card-team{color:rgb(var(--seat-rgb));font-size:clamp(5px,.55vw,8px);font-weight:1000;letter-spacing:.08em;text-align:center}
        .team-seat-count{display:flex;align-items:center;gap:5px;color:#b8c1cf;font-size:8px;font-weight:900;letter-spacing:.08em;padding:0 2px 6px;text-transform:uppercase}
        @media(max-width:800px){.team-fighter-grid{gap:6px;min-height:300px}.seat-fighter-card{border-radius:11px}.seat-card-top{top:6px;font-size:5px}.seat-card-avatar{width:clamp(27px,8vw,46px)}.seat-card-name{font-size:clamp(8px,2.4vw,12px)}.seat-card-team{font-size:5px}.fighter-panel-compact .fighter-avatar{width:clamp(28px,8vw,48px);height:clamp(28px,8vw,48px)}.fighter-panel-compact .fighter-nameplate h2{font-size:clamp(9px,2.2vw,13px)}.fighter-panel-compact .fighter-score-wrap{bottom:28px}.fighter-panel-compact .fighter-score{font-size:clamp(13px,4vw,22px)}.fighter-panel-compact .fighter-score-caption{display:none}.fighter-panel-compact .fighter-status-line{display:none}.fighter-panel-compact .fighter-content{inset:17% 3% 26%}}
        @media(max-width:800px){.team-fighter-grid{gap:4px}.seat-card-top{letter-spacing:0}.seat-card-team{letter-spacing:0}.fighter-panel-compact .fighter-nameplate h2{font-size:9px}.fighter-panel-compact .fighter-score-label{display:none}}
        .fighter-panel{position:relative;min-width:0;overflow:hidden;border-radius:19px;border:1px solid #ffffff18;background:#0b1015;isolation:isolate;box-shadow:0 18px 42px #0007,inset 0 1px #ffffff0a}
        .fighter-green{--fighter:#63ff9b;--fighter-rgb:99,255,155;border-color:#63ff9b30}.fighter-purple{--fighter:#c084fc;--fighter-rgb:192,132,252;border-color:#c084fc30}
        .fighter-leading{box-shadow:0 0 0 1px #ffffff0b,0 0 38px rgba(var(--fighter-rgb),.12),0 18px 42px #0008;transform:scale(1.02);border-width:2px}
        .fighter-art{position:absolute;inset:0;z-index:-4;opacity:.85;transform:scale(1.02)}
        .art-green{background:radial-gradient(ellipse at 48% 37%,#1e7548 0%,#123c29 23%,#0b1713 55%,#07090d 84%),linear-gradient(145deg,#143d2a,#080b10)}
        .art-purple{background:radial-gradient(ellipse at 52% 37%,#69308f 0%,#3a1b52 24%,#1a1023 56%,#07090d 84%),linear-gradient(145deg,#40205a,#080b10)}
        .fighter-panel .arena-rings{position:absolute;z-index:-2;left:50%;top:44%;width:min(78%,330px);aspect-ratio:1;transform:translate(-50%,-50%);border:1px solid rgba(var(--fighter-rgb),.18);border-radius:50%;box-shadow:0 0 0 16px rgba(var(--fighter-rgb),.025),0 0 0 38px rgba(var(--fighter-rgb),.025),inset 0 0 45px rgba(var(--fighter-rgb),.08);pointer-events:none}
        .fighter-panel .arena-rings:before,.fighter-panel .arena-rings:after{content:'';position:absolute;inset:12%;border:1px dashed rgba(var(--fighter-rgb),.19);border-radius:50%}
        .fighter-panel .arena-rings:after{inset:25%;border-style:solid;opacity:.5}
        .fighter-panel .arena-pylon{position:absolute;z-index:-1;top:7%;bottom:16%;width:8%;opacity:.55;background:linear-gradient(180deg,transparent,rgba(var(--fighter-rgb),.18),transparent);border-left:1px solid rgba(var(--fighter-rgb),.12);border-right:1px solid rgba(var(--fighter-rgb),.12);clip-path:polygon(25% 0,75% 0,100% 100%,0 100%)}
        .fighter-panel .arena-pylon.left{left:4%}.fighter-panel .arena-pylon.right{right:4%}
        .fighter-vignette{position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,#03060930 0%,transparent 24%,#0306090a 50%,#030609e8 100%)}
        .fighter-scanlines{position:absolute;inset:0;z-index:-1;opacity:.15;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 5px,#ffffff0c 6px)}
        .fighter-panel:before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(145deg,rgba(var(--fighter-rgb),.48),transparent 35%,transparent 70%,rgba(var(--fighter-rgb),.18));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:2}
        .fighter-panel:after{content:'';position:absolute;left:-25%;right:-25%;bottom:-38%;height:64%;background:radial-gradient(ellipse,rgba(var(--fighter-rgb),.15),transparent 68%);filter:blur(15px);pointer-events:none;z-index:-1}
        .ember{position:absolute;display:block;border-radius:70% 30% 65% 35%;background:var(--fighter);box-shadow:0 0 8px var(--fighter),0 0 16px rgba(var(--fighter-rgb),.65);filter:blur(.2px)}
        .ember-green{--fighter:#73ffab;--fighter-rgb:99,255,155}.ember-purple{--fighter:#d6a4ff;--fighter-rgb:192,132,252}
        .fighter-topline{position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:6px;z-index:3}
        .live-pill,.lead-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #ffffff20;background:#0306098c;backdrop-filter:blur(10px);border-radius:7px;padding:6px 8px;font-size:8px;font-weight:1000;letter-spacing:.13em}
        .live-pill span{width:5px;height:5px;border-radius:50%;background:#ff617e;box-shadow:0 0 9px #ff617e;animation:liveDot 1.2s infinite}
        @keyframes liveDot{50%{opacity:.3;transform:scale(.75)}}
        .live-green{color:#9dffc1}.live-purple{color:#e3c0ff}.lead-pill{color:#fff1a8;border-color:#ffe28d35;background:#35290d70;font-size:7px}.lead-pill svg{color:#ffe28d}
        .fighter-content{position:absolute;inset:18% 8% 30%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:1}
        .fighter-avatar{position:relative;display:flex;align-items:center;justify-content:center;width:clamp(76px,10vw,126px);height:clamp(76px,10vw,126px);border-radius:31px;border:1px solid rgba(var(--fighter-rgb),.8);background:linear-gradient(145deg,rgba(var(--fighter-rgb),.18),#070a0fe8 72%);color:var(--fighter);font-size:clamp(25px,3.5vw,43px);font-weight:1000;letter-spacing:-.08em;backdrop-filter:blur(9px);position:relative}
        .avatar-ring{position:absolute;inset:-9px;border:1px solid rgba(var(--fighter-rgb),.26);border-radius:37px;transform:rotate(8deg)}.avatar-ring:after{content:'';position:absolute;inset:6px;border:1px dashed rgba(var(--fighter-rgb),.3);border-radius:28px}
        .avatar-status{position:absolute;right:-5px;bottom:-5px;width:19px;height:19px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#07110b;border:1px solid rgba(var(--fighter-rgb),.8)}.avatar-status span{width:7px;height:7px;border-radius:50%;background:var(--fighter);box-shadow:0 0 10px var(--fighter)}
        .fighter-nameplate{margin-top:17px}.fighter-side-label{font-size:8px;font-weight:1000;letter-spacing:.2em}.text-green{color:#8dffb8}.text-purple{color:#dfb4ff}
        .fighter-nameplate h2{font-size:clamp(18px,2.2vw,27px);font-weight:1000;letter-spacing:-.055em;margin:5px 0 6px;line-height:1.05;text-shadow:0 3px 16px #0008;overflow-wrap:anywhere}
        .fighter-status-line{display:flex;align-items:center;justify-content:center;gap:5px;color:#b0b8c4;font-size:7px;font-weight:900;letter-spacing:.12em}.fighter-status-line svg{color:var(--fighter)}
        .fighter-score-wrap{position:absolute;bottom:51px;left:14px;right:14px;text-align:center;z-index:2}
        .help-callout{display:flex;align-items:center;gap:7px;margin:8px auto 0;max-width:220px;padding:7px 9px;border:1px solid rgba(var(--fighter-rgb),.38);border-radius:11px;background:linear-gradient(100deg,rgba(var(--fighter-rgb),.15),#05070bcf 72%);text-align:left;box-shadow:0 0 18px rgba(var(--fighter-rgb),.1);animation:helpPulse 2s ease-in-out infinite}
        .help-fire{display:grid;place-items:center;width:27px;height:27px;flex-shrink:0;border-radius:8px;background:rgba(var(--fighter-rgb),.13);color:var(--fighter)}
        .help-callout strong{display:block;color:var(--fighter);font-size:9px;font-weight:1000;letter-spacing:.07em;line-height:1.2}
        .help-callout small{display:block;margin-top:3px;color:#aeb8c5;font-size:7px;line-height:1.2}
        .help-arrow{margin-left:auto;color:var(--fighter);font-size:17px;font-weight:1000}
        @keyframes helpPulse{50%{box-shadow:0 0 24px rgba(var(--fighter-rgb),.18)}}
        .fighter-score-label{display:flex;align-items:center;justify-content:space-between;color:#a0a9b7;font-size:8px;font-weight:900;letter-spacing:.15em}.fighter-score-label span:last-child{display:flex;align-items:center;gap:4px}
        .fighter-score{font-size:clamp(28px,4.2vw,50px);font-weight:1000;letter-spacing:-.065em;line-height:1.2;font-variant-numeric:tabular-nums}
        .score-green{color:#a4ffc5;text-shadow:0 0 12px #63ff9b55,0 0 32px #63ff9b27}.score-purple{color:#e2c2ff;text-shadow:0 0 12px #c084fc55,0 0 32px #c084fc27}
        .fighter-score-caption{margin-top:1px;color:var(--fighter);font-size:8px;font-weight:1000;letter-spacing:.18em}.fighter-score-caption span{color:#687284;margin:0 5px}
        .fighter-bottom{position:absolute;left:12px;right:12px;bottom:11px;display:flex;align-items:center;justify-content:space-between;z-index:3}
        .fighter-tools{display:flex;gap:5px}.fighter-tools button{width:29px;height:29px;display:grid;place-items:center;border:1px solid #ffffff1a;border-radius:9px;background:#03060990;color:#c3ccd6;backdrop-filter:blur(10px)}.fighter-tools button.tool-active{border-color:rgba(var(--fighter-rgb),.42);color:var(--fighter);background:rgba(var(--fighter-rgb),.1)}
        .fighter-side-tag{padding:6px 8px;border-radius:7px;background:#03060980;border:1px solid rgba(var(--fighter-rgb),.2);color:var(--fighter);font-size:7px;font-weight:1000;letter-spacing:.16em}
        .vs-core{position:absolute;z-index:5;top:50%;left:50%;translate:-50% -50%;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border:1px solid #ffffff42;border-radius:50%;background:radial-gradient(circle at 35% 25%,#272b35,#080a0f 72%);box-shadow:0 0 0 5px #05070b85,0 0 28px #000,0 0 22px #b6a0ff18;transform:none;rotate:0}
        .vs-core:before{content:'';position:absolute;inset:-5px;border-radius:50%;border:1px solid #ffffff25;box-shadow:0 0 16px #c084fc18}
        .vs-core span{font-size:16px;font-style:italic;font-weight:1000;letter-spacing:-.08em;background:linear-gradient(90deg,#8dffb8,#dcb4ff);color:transparent;-webkit-background-clip:text;background-clip:text}
         .stage-controls{display:flex;align-items:center;justify-content:center;gap:8px;padding-top:12px;flex-shrink:0}
         .mai-baggy-available{animation:maiBaggyGlow 1.1s ease-in-out infinite alternate}
         @keyframes maiBaggyGlow{from{box-shadow:0 0 10px #00bfff,0 0 22px #00bfff55}to{box-shadow:0 0 18px #00bfff,0 0 38px #00bfff99}}
        .action-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid #ffffff1b;border-radius:12px;background:#ffffff08;color:#dbe2ec;font-size:10px;font-weight:1000;letter-spacing:.04em}
        .gift-btn{border:1px solid #b7ffcf50;background:linear-gradient(110deg,#63ff9b1c,#c084fc1c);color:#eafff0;box-shadow:0 0 26px #63ff9b0d}.gift-btn svg{color:#8dffb8}.gift-btn:hover{border-color:#b7ffcf90;box-shadow:0 0 28px #63ff9b20}
        .chat-btn{background:#11151d}.chat-btn svg{color:#d0b0ff}.chat-count{display:grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:5px;background:#ffffff13;font-size:8px}
        .side-chat{display:flex;flex-direction:column;width:290px;flex-shrink:0;min-height:0;overflow:hidden;border:1px solid #ffffff14;border-radius:18px;background:linear-gradient(180deg,#0d1119f5,#080a0ff5);box-shadow:0 18px 42px #0006}
        .chat-head{display:flex;align-items:center;gap:9px;padding:15px 14px;border-bottom:1px solid #ffffff10}.chat-head-icon{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:#b987ff16;border:1px solid #c084fc28;color:#d8aaff}.chat-title{font-size:10px;font-weight:1000;letter-spacing:.13em}.chat-subtitle{margin-top:3px;color:#758092;font-size:8px}.chat-live-dot{margin-left:auto;display:flex;align-items:center;gap:5px;color:#80ffad;font-size:8px;font-weight:1000;letter-spacing:.1em}.chat-live-dot span{width:5px;height:5px;border-radius:50%;background:#63ff9b;box-shadow:0 0 8px #63ff9b}
        .chat-messages{display:flex;flex:1;min-height:0;flex-direction:column;gap:9px;overflow:auto;padding:13px 11px;scrollbar-width:thin;scrollbar-color:#303644 transparent}
        .chat-message{border:1px solid #ffffff09;border-radius:12px;padding:9px 10px;background:#ffffff05;color:#d3d9e2;font-size:10px;line-height:1.5;overflow-wrap:anywhere}.chat-message.left{background:linear-gradient(110deg,#63ff9b0c,#ffffff03);border-color:#63ff9b14}.chat-message.right{background:linear-gradient(110deg,#c084fc0b,#ffffff03);border-color:#c084fc14}.chat-message.system{background:#ffffff04;color:#7e8999;font-size:9px;font-style:italic}
        .chat-user{display:block;margin-bottom:3px;color:#9dffbd;font-size:9px;font-weight:1000}.chat-message.right .chat-user{color:#dbb0ff}
        .chat-compose{display:flex;gap:7px;padding:11px;border-top:1px solid #ffffff10}.chat-compose input{min-width:0;flex:1;border:1px solid #ffffff12;border-radius:10px;background:#03060b;padding:11px 10px;color:white;font-size:10px;outline:none}.chat-compose input:focus{border-color:#c084fc66}.chat-compose button{display:grid;place-items:center;width:38px;border:1px solid #c084fc35;border-radius:10px;background:#c084fc17;color:#dfb5ff}
        .arena-footnote{display:flex;align-items:center;justify-content:center;gap:6px;color:#586374;font-size:8px;font-weight:800;letter-spacing:.12em;padding-top:8px}.arena-footnote svg{color:#8c9aac}
        .winner-overlay{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:#020408c9;backdrop-filter:blur(12px);padding:20px}.winner-card{max-width:420px;width:100%;text-align:center;border:1px solid #ffffff25;border-radius:24px;padding:30px;background:radial-gradient(ellipse at top,#c084fc16,transparent 60%),#0b0e15;box-shadow:0 0 90px #a855f722}.winner-trophy{display:inline-grid;place-items:center;width:70px;height:70px;border:1px solid #ffe38a45;border-radius:23px;background:#ffe38a12;color:#ffe38a;box-shadow:0 0 35px #ffe38a17}.winner-card h2{font-size:27px;font-weight:1000;letter-spacing:-.05em;margin:18px 0 6px}.winner-card p{color:#8993a3;font-size:12px;line-height:1.6}.winner-name{font-size:19px;font-weight:1000;background:linear-gradient(90deg,#8dffb8,#d8b0ff);color:transparent;-webkit-background-clip:text;background-clip:text}
        .gift-flash{position:absolute;inset:0;z-index:20;display:grid;place-items:center;pointer-events:none;background:radial-gradient(ellipse at center,#63ff9b22,transparent 60%)}.gift-flash span{font-size:clamp(35px,7vw,75px);font-weight:1000;letter-spacing:-.06em;color:#b9ffd0;text-shadow:0 0 40px #63ff9b;transform:rotate(-7deg)}
        .mobile-chat-sheet{position:absolute;inset:0;z-index:25;display:flex;flex-direction:column;background:#080b12;border:1px solid #ffffff20;border-radius:18px;overflow:hidden}
        @media(max-width:800px){.side-chat{width:255px}.fighter-content{inset-bottom:32%}.fighter-score-wrap{bottom:54px}.fighter-status-line{letter-spacing:.04em}}
        @media(max-width:800px){.arena-topbar{padding:10px 12px}.top-chip.hide-mobile{display:none}.arena-heading{padding:13px 12px 10px}.arena-body{padding:0 12px 12px;display:block;overflow:auto}.stage-column{min-height:0;height:100%}.fighter-grid{min-height:330px;gap:7px}.fighter-panel{border-radius:14px}.fighter-topline{top:8px;left:7px;right:7px}.live-pill,.lead-pill{padding:5px 6px;font-size:6px;letter-spacing:.07em}.fighter-content{inset:17% 4% 34%}.fighter-avatar{width:clamp(62px,15vw,95px);height:clamp(62px,15vw,95px);border-radius:22px}.avatar-ring{border-radius:28px}.avatar-ring:after{border-radius:20px}.fighter-nameplate{margin-top:12px}.fighter-nameplate h2{font-size:clamp(15px,3.8vw,22px)}.fighter-side-label{font-size:6px;letter-spacing:.1em}.fighter-status-line{font-size:6px;gap:3px}.fighter-score-wrap{left:8px;right:8px;bottom:48px}.help-callout{max-width:180px;margin-top:5px;padding:5px 6px;gap:5px}.help-fire{width:22px;height:22px}.help-callout strong{font-size:7px}.help-callout small{font-size:6px}.help-arrow{font-size:13px}.fighter-score-label{font-size:6px;letter-spacing:.07em}.fighter-score{font-size:clamp(23px,6vw,38px)}.fighter-score-caption{font-size:6px;letter-spacing:.1em}.fighter-bottom{left:7px;right:7px;bottom:7px}.fighter-tools button{width:25px;height:25px}.fighter-side-tag{padding:5px 6px;font-size:6px}.vs-core{width:43px;height:43px;border-radius:14px}.vs-core span{font-size:14px}.scoreboard{margin:0 12px 10px;padding:10px 11px 11px;border-radius:14px}.score-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;min-height:40px}.score-side:first-child{padding-right:25px}.score-side.right{padding-left:25px}.score-vs{width:38px;gap:3px;font-size:7px}.score-vs:before,.score-vs:after{width:7px;flex-basis:7px}.score-side{gap:6px}.score-name{max-width:26vw;font-size:9px}.score-number{font-size:clamp(15px,4vw,22px)}.score-orb{width:7px;height:7px}.score-vs{font-size:7px;gap:4px}.score-vs:before,.score-vs:after{width:8px}.fire-track{height:13px;margin-top:10px}.score-meta{gap:5px;font-size:6px;letter-spacing:.07em}.score-meta>span:nth-child(2){white-space:normal;max-width:42%;width:max-content}.score-meta>span:first-child,.score-meta>span:last-child{max-width:31%;line-height:1.25}.side-chat{display:none}.stage-controls{padding-top:9px}.action-btn{min-height:37px;padding:0 12px;font-size:9px}.arena-footnote{font-size:7px}.timer-box{min-width:80px;padding:7px 9px}.timer-value{font-size:19px}.arena-title{font-size:22px}.arena-tagline{font-size:9px}}
        @media(max-width:800px){.brand-sub{letter-spacing:.12em;font-size:8px}.mt-brand-mark{width:33px;height:33px}.arena-heading{gap:8px}.arena-title{font-size:19px}.timer-box{min-width:70px}.scoreboard{padding:9px 8px}.score-side{gap:4px}.score-name{max-width:23vw}.fighter-status-line{font-size:5px}.fighter-content{inset-bottom:35%}.fighter-score-label span:last-child{gap:2px}.fighter-score-caption{letter-spacing:.04em}}
        @media(prefers-reduced-motion:reduce){.mt-battle-root *, .mt-battle-root *:before,.mt-battle-root *:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
      `}</style>

      <div className="arena-glow" />
      <div className="arena-grid absolute inset-0 pointer-events-none" />
      <div className="arena-architecture" />
      <div className="arena-floor" />
      <div className="arena-beam" style={{ left: '18%', transform: 'rotate(12deg)' }} />
      <div className="arena-beam beam-purple" style={{ right: '18%', transform: 'rotate(-12deg)' }} />

      <header className="arena-topbar">
        <button aria-label="Leave battle room" onClick={onClose} className="top-icon hover:border-white/30 hover:bg-white/10" style={{ color: '#ffffff', width: 60, height: 44, gap: 4 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg><span style={{ fontSize: 11, fontWeight: 900 }}>BACK</span></button>
        <div className="mt-brand-mark"><Swords size={19} strokeWidth={2.8} /></div>
        <div>
          <div className="brand-word">MAITROLL <span style={{ color: '#8dffb8' }}>ARENA</span></div>
          <div className="brand-sub">POWERED BY TROLL CITY</div>
        </div>
        <div className="ml-3 hidden sm:block h-7 w-px bg-white/10" />
        <div className="hidden sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setChatOpen(true)} className="top-icon" aria-label="Open chat"><MessageCircle size={15} /></button>
            <div className="top-chip hide-mobile"><Users size={13} /><span>{fmt(battle.viewers)}</span><span className="text-white/35">WATCHING</span></div>
          <div className={`timer-box ${danger ? 'timer-danger' : ''}`}>
            <div className="timer-label">{timeLeft === 0 ? 'FINAL SCORE' : 'TIME REMAINING'}</div>
            <div className="timer-value">{mm}:{ss}</div>
          </div>

        </div>
      </header>

      <div className="arena-heading" />

      <main className="arena-body">
        <div className="stage-column">
          <div className="power-bar-side left"><div className="power-bar-fire red" style={{ height: `${(powerBar.green/500)*100}%` }} /></div>
          <div className="power-bar-side right"><div className="power-bar-fire red" style={{ height: `${(powerBar.purple/500)*100}%` }} /></div>
          <section className="scoreboard">
            <div className="score-row">
              <div className="score-side">
                <span className="score-orb green" />
                <div className="min-w-0"><div className="score-name">{battle.challenger}</div><div className="score-number green">{ghostActive('green') && viewAs !== 'green' && viewAs !== 'neutral' ? '???' : fmt(totalScoreC)}</div></div>
              </div>
              <div className="score-vs">VS</div>
              <div className="score-side right">
                <div className="min-w-0"><div className="score-name">{battle.opponent}</div><div className="score-number purple">{ghostActive('purple') && viewAs !== 'purple' && viewAs !== 'neutral' ? '???' : fmt(totalScoreO)}</div></div>
                <span className="score-orb purple" />
              </div>
            </div>
            <div className="fire-track" aria-label={`Score balance: ${Math.round(cPct)} percent green, ${Math.round(oPct)} percent purple`}>
              <motion.div className="fire-green" animate={{ width: `${cPct}%` }} transition={{ type: 'spring', stiffness: 80, damping: 17 }} />
              <motion.div className="fire-purple" animate={{ width: `${oPct}%` }} transition={{ type: 'spring', stiffness: 80, damping: 17 }} />
            </div>
            <div className="score-meta"><span className="green-label">◈ GREEN FIRE · {Math.round(cPct)}%</span><span>POWER METER <span className="text-white/20">/</span> {momentum < 5 ? 'NECK & NECK' : momentum < 15 ? 'CLOSE COMBAT' : 'MOMENTUM SHIFT'}</span><span className="purple-label">PURPLE FIRE · {Math.round(oPct)}% ◈</span></div>
          </section>
          <div className="flex items-center justify-between gap-3 px-1 pb-2 text-[10px] font-bold">
            <div className="flex items-center gap-2">
              <span className="text-[#8dffb8]">GREEN POWER {powerBar.green}/500</span>
              <button onClick={() => { setPowerBar((p) => ({ ...p, green: Math.min(500, p.green + Math.max(1, Math.round(10 / roundRef.current))) })); setLikes((p) => ({ ...p, green: p.green + 10 })); }} className="action-btn text-[9px]">LIKE GREEN</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#d8aaff]">PURPLE POWER {powerBar.purple}/500</span>
              <button onClick={() => { setPowerBar((p) => ({ ...p, purple: Math.min(500, p.purple + Math.max(1, Math.round(10 / roundRef.current))) })); setLikes((p) => ({ ...p, purple: p.purple + 10 })); }} className="action-btn text-[9px]">LIKE PURPLE</button>
            </div>
          </div>
          <div className="fighter-grid">
            <div className="team-fighter-grid" style={{ ['--team-columns' as any]: (1) }} aria-label={`Green team: ${greenFighterCount} fighter${greenFighterCount === 1 ? '' : 's'}`}>
              <FighterPanel
                name={battle.challenger} score={scoreC} side="green" art="art-green" lead={challengerLeads} losing={!challengerLeads}
                onMic={() => setMicC(v => !v)} onVideo={() => setVideoC(v => !v)} micOn={micC} videoOn={videoC} chaos={chaosSide === 'green'} compact={greenFighterCount > 1}
                onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); if (next.has('green-host')) next.delete('green-host'); else next.add('green-host'); return next; })}
                selected={selectedSeats.has('green-host') || [...selectedSeats].some((key) => key.startsWith('green-'))}
              />
              {displaySeats.green.map((seat, index) => <BattleSeatCard key={getSeatId(seat, `green-seat-${index}`)} seat={seat} index={index} side="green" chaos={chaosSide === 'green'} onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); const key = `green-${index}`; if (next.has(key)) next.delete(key); else next.add(key); return next; })} selected={selectedSeats.has(`green-${index}`)} teamName={battle.challenger} scoreBoost={seatScoreMap[`green-${index}`]} />)}
              {Array.from({ length: Math.max(0, seatCounts.green - displaySeats.green.length) }).map((_, i) => (
                <div key={`green-open-${i}`} className="seat-fighter-card border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/60 cursor-pointer" onClick={() => setSeatCounts((p) => ({ ...p, green: Math.min(5, p.green + 1) }))}>
                  <div className="text-2xl font-black">+</div>
                  <div className="grid grid-cols-2 gap-1">
                    {Array.from({ length: 4 }).map((_, j) => <div key={j} className="w-5 h-5 rounded-full border border-dashed border-white/30 flex items-center justify-center text-[10px]">+</div>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="team-fighter-grid" style={{ ['--team-columns' as any]: (1) }} aria-label={`Purple team: ${purpleFighterCount} fighter${purpleFighterCount === 1 ? '' : 's'}`}>
              <FighterPanel
                name={battle.opponent} score={scoreO} side="purple" art="art-purple" lead={!challengerLeads} losing={challengerLeads}
                onMic={() => setMicO(v => !v)} onVideo={() => setVideoO(v => !v)} micOn={micO} videoOn={videoO} chaos={chaosSide === 'purple'} compact={purpleFighterCount > 1}
                onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); if (next.has('purple-host')) next.delete('purple-host'); else next.add('purple-host'); return next; })}
                selected={selectedSeats.has('purple-host') || [...selectedSeats].some((key) => key.startsWith('purple-'))}
              />
              {displaySeats.purple.map((seat, index) => <BattleSeatCard key={getSeatId(seat, `purple-seat-${index}`)} seat={seat} index={index} side="purple" chaos={chaosSide === 'purple'} onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); const key = `purple-${index}`; if (next.has(key)) next.delete(key); else next.add(key); return next; })} selected={selectedSeats.has(`purple-${index}`)} teamName={battle.opponent} scoreBoost={seatScoreMap[`purple-${index}`]} />)}
              {Array.from({ length: Math.max(0, seatCounts.purple - displaySeats.purple.length) }).map((_, i) => (
                <div key={`purple-open-${i}`} className="seat-fighter-card border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/60 cursor-pointer" onClick={() => setSeatCounts((p) => ({ ...p, purple: Math.min(5, p.purple + 1) }))}>
                  <div className="text-2xl font-black">+</div>
                  <div className="grid grid-cols-2 gap-1">
                    {Array.from({ length: 4 }).map((_, j) => <div key={j} className="w-5 h-5 rounded-full border border-dashed border-white/30 flex items-center justify-center text-[10px]">+</div>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="vs-core"><span>VS</span></div>
            <AnimatePresence>{ultimateFlash && <motion.div className="gift-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.span initial={{ scale: .5 }} animate={{ scale: [0.8, 1.2, 1] }} exit={{ scale: .7, opacity: 0 }} style={{ color: ultimateFlash === 'green' ? '#8dffb8' : '#d8aaff' }}>ULTIMATE! ⚡</motion.span></motion.div>}</AnimatePresence>
          </div>
          <div className="flex gap-2 pb-1">
            <button onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); displaySeats.green.forEach((_, i) => next.add(`green-${i}`)); next.add('green-host'); return next; })} className="action-btn text-[9px]">SELECT ALL GREEN</button>
            <button onClick={() => setSelectedSeats((prev) => { const next = new Set(prev); displaySeats.purple.forEach((_, i) => next.add(`purple-${i}`)); next.add('purple-host'); return next; })} className="action-btn text-[9px]">SELECT ALL PURPLE</button>
            <button onClick={() => setSelectedSeats(new Set())} className="action-btn text-[9px]">CLEAR</button>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="overflow-x-auto pb-1">
              <div className="grid grid-rows-2 grid-flow-col gap-2 auto-cols-max">
                {arenaGifts.map((gift) => (
                  <button key={`green-${gift.id}`} onClick={() => { setSelectedGift(gift); const targets = [...selectedSeats].filter((key) => key.startsWith('green')); if (targets.length) targets.forEach((target) => sendGift(target, gift.cost)); else sendGift('green', gift.cost); }} className="action-btn text-[9px] whitespace-nowrap flex-col gap-1 py-2">
                    <span className="text-3xl">{gift.icon}</span>
                    <span className="text-[#8dffb8]">{gift.cost}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="grid grid-rows-2 grid-flow-col gap-2 auto-cols-max">
                {arenaGifts.map((gift) => (
                  <button key={`purple-${gift.id}`} onClick={() => { setSelectedGift(gift); const targets = [...selectedSeats].filter((key) => key.startsWith('purple')); if (targets.length) targets.forEach((target) => sendGift(target, gift.cost)); else sendGift('purple', gift.cost); }} className="action-btn text-[9px] whitespace-nowrap flex-col gap-1 py-2">
                    <span className="text-3xl">{gift.icon}</span>
                    <span className="text-[#d8aaff]">{gift.cost}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <BattleArenaControls
            greenFighterCount={greenFighterCount}
            purpleFighterCount={purpleFighterCount}
            hasSeats={displaySeats.green.length > 0 || displaySeats.purple.length > 0}
            seatCounts={seatCounts}
            setSeatCounts={setSeatCounts}
            powerBar={powerBar}
            setPowerBar={setPowerBar}
            setLikes={setLikes}
            powerSlots={powerSlots}
            openBag={openBag}
            setOpenBag={setOpenBag}
            powerAnnounce={powerAnnounce}
            fullSlotsMsg={fullSlotsMsg}
            onSendGift={sendGift}
            onTryActivate={tryActivate100}
            onActivatePower={activatePower}
            onReset={resetDemo}
            onForfeit={() => { setBattleWinner(viewAs === 'green' ? 'purple' : 'green'); setShowWinner(true); clearCombat(); }}
            onRematchVote={(side) => { if (side === 'green') setRematchGreen(true); else setRematchPurple(true); }}
          />
        </div>

        <aside className="side-chat">
          <div className="chat-head">
            <div className="chat-head-icon"><MessageCircle size={15} /></div>
            <div><div className="chat-title">THE CROWD</div><div className="chat-subtitle">The city is watching</div></div>
            <div className="chat-live-dot"><span /> LIVE</div>
          </div>
          <div className="chat-messages">
            <AnimatePresence initial={false}>
              {chat.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`chat-message ${m.side}`}>
                  {m.side !== 'system' && <span className="chat-user">{m.user}</span>}
                  {m.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); sendChat(); }}>
            <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Hype up your fighter…" aria-label="Write a chat message" />
            <button type="submit" aria-label="Send chat message"><Send size={14} /></button>
          </form>
        </aside>
      </main>

      <AnimatePresence>
        {chatOpen && (
          <motion.div className={`mobile-chat-sheet sm:hidden ${chatHighlight ? 'ring-2 ring-yellow-300' : ''}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="chat-head">
              <div className="chat-head-icon"><MessageCircle size={15} /></div>
              <div><div className="chat-title">THE CROWD</div><div className="chat-subtitle">Live battle chat · demo</div></div>
              <button aria-label="Close chat" onClick={() => setChatOpen(false)} className="ml-auto top-icon"><X size={15} /></button>
            </div>
            <div className="chat-messages">
              {chat.map((m) => <div key={m.id} className={`chat-message ${m.side}`}>{m.side !== 'system' && <span className="chat-user">{m.user}</span>}{m.text}</div>)}
            </div>
            <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); sendChat(); }}>
              <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Hype up your fighter…" aria-label="Write a chat message" />
              <button type="submit" aria-label="Send chat message"><Send size={14} /></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPowerPanel && (
          <motion.div className="winner-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="winner-card" initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }}>
              <div className="eyebrow justify-center">CHOOSE POWER-UP</div>
              <h2 className="mt-3">{showPowerPanel === 'green' ? 'GREEN' : 'PURPLE'} SIDE</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {POWER_UP_POOL.map((pu) => {
                  const def = POWER_UPS[pu];
                  const Icon = def.icon;
                  return (
                    <button
                      key={pu}
                      onClick={() => setSelectedPower(pu)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs ${selectedPower === pu ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03]'}`}
                    >
                      <Icon size={24} />
                      <div>
                        <div className="font-bold">{def.name}</div>
                        <div className="text-[9px] text-white/40">{def.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setShowPowerPanel(null); setSelectedPower(null); }} className="action-btn flex-1">CANCEL</button>
                <button onClick={confirmPowerPanel} disabled={!selectedPower} className="action-btn gift-btn flex-1">CONFIRM</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWinner && (
          <motion.div className="winner-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="winner-card" initial={{ opacity: 0, y: 25, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 190, damping: 20 }}>
              <div className="winner-trophy"><Trophy size={31} /></div>
              <div className="eyebrow justify-center mt-5"><Flame size={13} /> THE ARENA HAS SPOKEN <Flame size={13} /></div>
              <h2>BATTLE COMPLETE</h2>
              <div className="winner-name">{battleWinner === 'green' ? battle.challenger : battleWinner === 'purple' ? battle.opponent : 'DRAW'}</div>
              <p>Round wins: {battle.challenger} {greenWins} - {purpleWins} {battle.opponent}. Preview only.</p>
              <button onClick={() => { setShowWinner(false); setTimeLeft(168); setRound(1); setGreenWins(0); setPurpleWins(0); setBattleWinner(null); setScoreC(0); setScoreO(0); setPowerBar({ green: 0, purple: 0 }); setActiveEffects({ green: [], purple: [] }); setChaosSide(null); clearCombat(); window.setTimeout(() => startCombat(), 0); }} className="action-btn gift-btn mt-5 w-full"><Zap size={15} /> RUN IT BACK</button>
              <button onClick={onClose} className="action-btn mt-2 w-full">LEAVE ARENA</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
