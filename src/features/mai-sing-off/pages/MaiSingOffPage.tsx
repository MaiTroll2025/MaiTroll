import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Coins,
  Crown,
  Gavel,
  Hash,
  Home,
  Loader2,
  Mic2,
  Play,
  Sparkles,
  Trophy,
  Tv,
  Users,
  Video,
  X,
} from 'lucide-react';

import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/lib/store';
import { useSingOffStore } from '../store/useSingOffStore';
import { useSingOffActions } from '../hooks/useSingOffActions';
import { useSingOffLiveKit } from '../hooks/useSingOffLiveKit';
import { SingOffChat } from '../components/SingOffChat';
import { ShowsLobby } from '../components/ShowsLobby';
import { ChampionshipLobby } from '../components/ChampionshipLobby';
import { RolesLobby } from '../components/RolesLobby';
import { StatisticsLobby } from '../components/StatisticsLobby';

type LobbyView = 'shows' | 'championship' | 'roles' | 'stats' | 'coins';

type ParticipantPosition =
  | 'challenger_a'
  | 'challenger_b'
  | 'host_stage'
  | 'host_judge'
  | 'judge_1'
  | 'judge_2'
  | 'judge_3'
  | 'judge_4'
  | 'ceo'
  | 'queue'
  | 'audience';

interface SingOffParticipantLike {
  id?: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  level?: number | null;
  troll_coins?: number | null;
  role?: string | null;
  position?: ParticipantPosition | string | null;
  livekit_identity?: string | null;
  is_publishing?: boolean;
  is_muted?: boolean;
  is_kicked?: boolean;
}

export default function MaiSingOffPage() {
  const user = useAuthStore((state) => state.user);

  const navigate = useNavigate();
  const location = useLocation();

  const { session, authority, participants, chatMessages } = useSingOffStore(
    useShallow((state) => ({
      session: state.session,
      authority: state.authority,
      participants: state.participants,
      chatMessages: state.chatMessages,
    })),
  );

  const actions = useSingOffActions();

  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const loadedSessionRef = useRef<string | null>(null);

  const [lobbyView, setLobbyView] = useState<LobbyView>('shows');
  const [mobilePanel, setMobilePanel] = useState<'stage' | 'chat' | 'queue'>('stage');

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const route = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const isRoot = segments[0] === 'mai-sing-off';
    const isLive = isRoot && segments[1] === 'live' && Boolean(segments[2]);
    return {
      isMaiSingOff: isRoot,
      inStage: isLive,
      sessionId: isLive && segments[2] ? segments[2] : null,
    };
  }, [location.pathname]);

  const { inStage, sessionId } = route;

  useEffect(() => {
    if (!inStage || !sessionId || !user?.id) return;
    if (loadedSessionRef.current === sessionId) return;
    loadedSessionRef.current = sessionId;

    let cancelled = false;

    const load = async () => {
      try {
        await actionsRef.current.loadSession(sessionId);
      } catch (error) {
        if (!cancelled) {
          console.error('[MaiSingOffPage] loadSession failed', error);
          loadedSessionRef.current = null;
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [inStage, sessionId, user?.id]);

  useEffect(() => {
    if (!inStage) {
      loadedSessionRef.current = null;
    }
  }, [inStage]);

  useEffect(() => {
    if (!inStage) return;
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [inStage, chatMessages]);

  /* Permissions (explicit authority hierarchy) */
  const profileRole = String((user as any)?.role ?? '').toLowerCase();

  const isCEO = authority?.isCEO === true || profileRole === 'ceo';
  const isAdmin = authority?.isAdmin === true || profileRole === 'admin';
  const isHost = authority?.isHost === true || authority?.canManageQueue === true;
  const isJudge = authority?.isJudge === true;
  const isModerator = authority?.isModerator === true || profileRole === 'moderator';

  const canStartShow = isCEO || isAdmin || authority?.canStartShow === true;
  const canEndShow = isCEO || authority?.canEndShow === true;
  const canModerate = isCEO || isAdmin || isModerator || authority?.canModerate === true;

  const blockedFromGlobalSingOffModeration = profileRole === 'broadcaster' || profileRole === 'broadofficer';
  const hasSingOffModeration = canModerate && !blockedFromGlobalSingOffModeration;

  /* LiveKit */
  const isPublisher = !!(
    session &&
    authority &&
    (authority.is_host || authority.is_judge || isCEO || isAdmin) &&
    session.status === 'active'
  );

  const livekit = useSingOffLiveKit({
    roomName: session?.room_name ?? '',
    userId: user?.id ?? '',
    userName: (user as any)?.display_name || 'User',
    mode: isPublisher ? 'singoff-publisher' : 'singoff-viewer',
    autoPublish: isPublisher,
    isAdmin: isCEO || isAdmin,
  });

  /* Stage participants */
  const typedParticipants = participants as SingOffParticipantLike[];

  const getPosition = useCallback(
    (position: ParticipantPosition) =>
      typedParticipants.find((participant) => participant.position === position) ?? null,
    [typedParticipants],
  );

  const challengerA = getPosition('challenger_a');
  const challengerB = getPosition('challenger_b');
  const hostStage = getPosition('host_stage');
  const hostJudge = getPosition('host_judge');
  const judge1 = getPosition('judge_1');
  const judge2 = getPosition('judge_2');
  const judge3 = getPosition('judge_3');
  const judge4 = getPosition('judge_4');
  const ceo = getPosition('ceo');
  const waitingQueue = typedParticipants.filter((participant) => participant.position === 'queue');

  const goBack = () => {
    navigate('/mai-sing-off');
  };

  const retrySession = () => {
    if (!sessionId) return;
    loadedSessionRef.current = null;
    void actionsRef.current.loadSession(sessionId);
  };

  const handleStartShow = async () => {
    if (!sessionId || !canStartShow) return;
    try {
      if (typeof actionsRef.current.startLiveShow === 'function') {
        await actionsRef.current.startLiveShow(sessionId);
      }
    } catch (error) {
      console.error('[MaiSingOffPage] start show failed', error);
    }
  };

  const handleEndShow = async () => {
    if (!sessionId || !canEndShow) return;
    const confirmed = window.confirm('End the current Mai Sing Off show?');
    if (!confirmed) return;
    try {
      if (typeof actionsRef.current.endLiveShow === 'function') {
        await actionsRef.current.endLiveShow(sessionId);
      }
    } catch (error) {
      console.error('[MaiSingOffPage] end show failed', error);
    }
  };

  if (!user) {
    return <SignedOutView onSignIn={() => navigate('/auth')} />;
  }

  if (!inStage) {
    return <UnderConstruction />;
  }

  /* ============ LIVE STAGE ============ */
  if (inStage) {
    if (!sessionId) {
      return (
        <StageError
          title="Invalid show"
          message="This Mai Sing Off show does not have a valid session ID."
          onBack={goBack}
        />
      );
    }

    if (!session) {
      return <StageLoading onBack={goBack} onRetry={retrySession} />;
    }

    return (
      <div className="min-h-screen bg-[#050509] text-white">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-3 py-3 backdrop-blur-xl md:px-5">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15">
                <Mic2 className="h-5 w-5 text-pink-400" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-black sm:text-base">
                  {session.title || 'Mai Sing Off'}
                </h1>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <span>Virtual Talent Show</span>
                  {session.status === 'active' && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-400">LIVE</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canStartShow && session.status !== 'active' && (
                <button
                  type="button"
                  onClick={handleStartShow}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black hover:bg-emerald-500 sm:text-sm"
                >
                  Start Show
                </button>
              )}

              {canEndShow && session.status === 'active' && (
                <button
                  type="button"
                  onClick={handleEndShow}
                  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500 sm:text-sm"
                >
                  End Show
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="sticky top-[65px] z-40 flex border-b border-white/10 bg-black/90 md:hidden">
          <MobileStageTab active={mobilePanel === 'stage'} icon={Tv} label="Stage" onClick={() => setMobilePanel('stage')} />
          <MobileStageTab active={mobilePanel === 'chat'} icon={Hash} label="Chat" onClick={() => setMobilePanel('chat')} />
          <MobileStageTab active={mobilePanel === 'queue'} icon={Users} label="Queue" onClick={() => setMobilePanel('queue')} />
        </div>

        <div className="mx-auto hidden max-w-[1800px] gap-4 p-4 md:grid md:grid-cols-[320px_minmax(0,1fr)_280px]">
          <div className="h-[calc(100vh-110px)] min-h-[520px]">
            <SingOffChat sessionId={session.id} />
          </div>

          <StageArea
            challengerA={challengerA}
            challengerB={challengerB}
            hostStage={hostStage}
            hostJudge={hostJudge}
            judge1={judge1}
            judge2={judge2}
            judge3={judge3}
            judge4={judge4}
            ceo={ceo}
            canModerate={hasSingOffModeration}
            livekit={livekit}
            actions={actionsRef.current}
            isHost={isHost || isCEO || isAdmin}
            isJudge={isJudge}
            myUserId={user.id}
          />

          <QueuePanel
            queue={waitingQueue}
            actions={actionsRef.current}
            canManage={Boolean(authority?.canManageQueue || isCEO || isHost || isAdmin)}
          />
        </div>

        <div className="md:hidden">
          {mobilePanel === 'stage' && (
            <div className="p-3">
              <StageArea
                challengerA={challengerA}
                challengerB={challengerB}
                hostStage={hostStage}
                hostJudge={hostJudge}
                judge1={judge1}
                judge2={judge2}
                judge3={judge3}
                judge4={judge4}
                ceo={ceo}
                canModerate={hasSingOffModeration}
                livekit={livekit}
                actions={actionsRef.current}
                isHost={isHost || isCEO || isAdmin}
                isJudge={isJudge}
                myUserId={user.id}
              />
            </div>
          )}

          {mobilePanel === 'chat' && (
            <div className="p-3">
              <SingOffChat sessionId={session.id} />
            </div>
          )}

          {mobilePanel === 'queue' && (
            <div className="p-3">
              <QueuePanel
                queue={waitingQueue}
                actions={actionsRef.current}
                canManage={Boolean(authority?.canManageQueue || isCEO || isHost || isAdmin)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ============ MAIN / LOBBY PAGE ============ */
  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* HERO — talent show stage lights */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/70 via-black to-pink-950/40" />

        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 15%, rgba(236,72,153,.5), transparent 35%), radial-gradient(circle at 50% 10%, rgba(147,51,234,.45), transparent 35%), radial-gradient(circle at 85% 20%, rgba(34,211,238,.35), transparent 35%), radial-gradient(circle at 30% 80%, rgba(250,204,21,.2), transparent 40%)',
          }}
        />

        {/* Spotlight cones */}
        <div className="absolute inset-0 flex justify-around opacity-25">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-full w-24 bg-gradient-to-b from-white/20 via-white/5 to-transparent"
              style={{
                clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)',
                animation: `spotlight ${6 + i * 2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400 to-transparent"
          style={{ animation: 'shine 4s linear infinite' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-pink-300">
                <Sparkles className="h-4 w-4" />
                Virtual Talent Show
              </div>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
                MAI{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  SING OFF
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Take the stage. Challenge another singer. Face the judges.
                Earn your place in Mai Sing Off history — now with scheduled shows,
                championship seasons, and grand prizes.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300/60">Your Balance</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-black text-yellow-300">
                  <Coins className="h-5 w-5" />
                  {Number((user as any)?.troll_coins ?? 0).toLocaleString()}
                </div>
              </div>

              {canStartShow && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-300">
                  <Crown className="h-4 w-4" />
                  Show Control Available
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-pink-500/10 to-transparent" />
      </section>

      {/* INTERNAL NAVIGATION */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2">
          <LobbyTab active={lobbyView === 'shows'} icon={Play} label="Shows" onClick={() => setLobbyView('shows')} />
          <LobbyTab active={lobbyView === 'championship'} icon={Trophy} label="Championship" onClick={() => setLobbyView('championship')} />
          <LobbyTab active={lobbyView === 'roles'} icon={Gavel} label="Judges & Hosts" onClick={() => setLobbyView('roles')} />
          <LobbyTab active={lobbyView === 'stats'} icon={BarChart3} label="Statistics" onClick={() => setLobbyView('stats')} />
          <LobbyTab active={lobbyView === 'coins'} icon={Coins} label="Coins" onClick={() => setLobbyView('coins')} />
        </div>
      </div>

      {/* LOBBY CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {lobbyView === 'shows' && <ShowsLobby />}
        {lobbyView === 'championship' && <ChampionshipLobby />}
        {lobbyView === 'roles' && <RolesLobby />}
        {lobbyView === 'stats' && <StatisticsLobby />}
        {lobbyView === 'coins' && <CoinView balance={Number((user as any)?.troll_coins ?? 0)} />}
      </main>

      <style>{`
        @keyframes spotlight {
          0%, 100% { opacity: 0.25; transform: rotate(0deg); }
          50% { opacity: 0.6; transform: rotate(3deg); }
        }
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes talent-orb-spin {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
          50% { transform: translate(-50%, -50%) rotate(180deg) scale(1.15); }
          100% { transform: translate(-50%, -50%) rotate(360deg) scale(1); }
        }
        @keyframes float-note {
          0%, 100% { transform: translateY(0) rotate(-6deg); opacity: 0.35; }
          50% { transform: translateY(-18px) rotate(8deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   LOBBY TAB
   ============================================================ */

function LobbyTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
        active ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-600/20' : 'text-white/55 hover:bg-white/5 hover:text-white',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ============================================================
   MAIN STAGE
   ============================================================ */

interface StageAreaProps {
  challengerA: SingOffParticipantLike | null;
  challengerB: SingOffParticipantLike | null;
  hostStage: SingOffParticipantLike | null;
  hostJudge: SingOffParticipantLike | null;
  judge1: SingOffParticipantLike | null;
  judge2: SingOffParticipantLike | null;
  judge3: SingOffParticipantLike | null;
  judge4: SingOffParticipantLike | null;
  ceo: SingOffParticipantLike | null;
  canModerate: boolean;
  livekit: any;
  actions: any;
  isHost: boolean;
  isJudge: boolean;
  myUserId: string;
}

function StageArea({
  challengerA,
  challengerB,
  hostStage,
  hostJudge,
  judge1,
  judge2,
  judge3,
  judge4,
  ceo,
  canModerate,
  livekit,
  actions,
  isHost,
  isJudge,
  myUserId,
}: StageAreaProps) {
  const mySeat = [
    challengerA,
    challengerB,
    hostStage,
    hostJudge,
    judge1,
    judge2,
    judge3,
    judge4,
    ceo,
  ].find((p) => p?.user_id === myUserId);

  const eligibleSeats = useMemo(() => {
    const seats: Array<{ position: string; label: string; occupied: boolean }> = [];

    const push = (position: string, label: string, occupied: boolean) =>
      seats.push({ position, label, occupied });

    const isMe = (p: SingOffParticipantLike | null) => p?.user_id === myUserId;

    // Hosts may take the host stage or host-judge seat.
    if (isHost) {
      push('host_stage', 'Host Stage', Boolean(hostStage) && !isMe(hostStage));
      push('host_judge', 'Host Judge', Boolean(hostJudge) && !isMe(hostJudge));
    }

    // Judges may take judge seats 1-4.
    if (isJudge) {
      push('judge_1', 'Judge 1', Boolean(judge1) && !isMe(judge1));
      push('judge_2', 'Judge 2', Boolean(judge2) && !isMe(judge2));
      push('judge_3', 'Judge 3', Boolean(judge3) && !isMe(judge3));
      push('judge_4', 'Judge 4', Boolean(judge4) && !isMe(judge4));
    }

    // Any challenger seat can be claimed by an audience member wanting to perform.
    push('challenger_a', 'Challenger A', Boolean(challengerA) && !isMe(challengerA));
    push('challenger_b', 'Challenger B', Boolean(challengerB) && !isMe(challengerB));

    return seats;
  }, [isHost, isJudge, challengerA, challengerB, hostStage, hostJudge, judge1, judge2, judge3, judge4, myUserId]);

  const handleClaimSeat = async (position: string) => {
    if (typeof actions.claimSeat === 'function') {
      await actions.claimSeat(position);
      return;
    }
    // Fallback: use assignPosition via actions
    if (typeof actions.assignPosition === 'function') {
      await actions.assignPosition(myUserId, position);
    }
  };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-b from-purple-950/30 via-black to-black p-3 shadow-[0_0_80px_rgba(147,51,234,.12)] sm:p-4">
      {/* Talent show glow orb + floating notes behind the stage */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              'conic-gradient(from 0deg, #ec4899, #a855f7, #22d3ee, #facc15, #ec4899)',
            animation: 'talent-orb-spin 14s linear infinite',
          }}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="absolute bottom-2 text-lg text-pink-300/40"
            style={{
              left: `${8 + i * 20}%`,
              animation: `float-note ${4 + i * 1.3}s ease-in-out ${i * 0.7}s infinite`,
            }}
          >
            🎵
          </span>
        ))}
      </div>

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">Main Stage</div>
          <h2 className="mt-1 text-xl font-black">Virtual Talent Show</h2>
        </div>
        <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">LIVE</div>
      </div>

      {livekit?.isConnected && (
        <div className="relative mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`h-2 w-2 rounded-full ${livekit.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            {livekit.isConnected ? 'Connected' : 'Disconnected'}
            {livekit.isPublishing && (
              <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">PUBLISHING</span>
            )}
          </div>

          {isHost || isJudge || mySeat ? (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => void livekit.toggleMic()}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/10"
              >
                {livekit.micEnabled ? 'Mute Mic' : 'Unmute Mic'}
              </button>
              <button
                type="button"
                onClick={() => void livekit.toggleCamera()}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/10"
              >
                {livekit.cameraEnabled ? 'Cam Off' : 'Cam On'}
              </button>
            </div>
          ) : (
            <span className="ml-auto text-[10px] text-white/35">Watch-only</span>
          )}
        </div>
      )}

      {/* Seat claim panel */}
      {!mySeat && eligibleSeats.length > 0 && (
        <div className="relative mb-4 rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-600/10 via-purple-600/10 to-cyan-600/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Mic2 className="h-3.5 w-3.5 text-pink-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
              Claim Your Seat to Perform
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {eligibleSeats.map((seat) => (
              <button
                key={seat.position}
                type="button"
                disabled={seat.occupied}
                onClick={() => void handleClaimSeat(seat.position)}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                  seat.occupied
                    ? 'cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/25'
                    : 'border border-pink-400/30 bg-pink-600/20 text-pink-300 hover:bg-pink-600/40'
                }`}
              >
                {seat.occupied ? `${seat.label} • Taken` : seat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mySeat && (
        <div className="relative mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">
          <span className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            You are on the stage — your seat: {String(mySeat.position).replace('_', ' ')}
          </span>
        </div>
      )}

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StageSquare
          title="CHALLENGER A"
          participant={challengerA}
          accent="pink"
          canModerate={canModerate}
          livekit={livekit}
          onKick={challengerA ? () => kickParticipant(actions, challengerA) : undefined}
        />

        <div>
          <StageSquare
            title="HOST"
            participant={hostStage}
            accent="purple"
            specialLabel="HOST"
            canModerate={canModerate}
            livekit={livekit}
          />

          {hostStage && (
            <div className="mx-auto mt-1 flex h-16 w-16 flex-col items-center">
              <div className="h-5 w-3 rounded-full bg-zinc-400" />
              <div className="h-9 w-1 bg-zinc-500" />
              <div className="h-1 w-12 rounded-full bg-zinc-500" />
            </div>
          )}
        </div>

        <StageSquare
          title="CHALLENGER B"
          participant={challengerB}
          accent="cyan"
          canModerate={canModerate}
          livekit={livekit}
          onKick={challengerB ? () => kickParticipant(actions, challengerB) : undefined}
        />
      </div>

      <div className="relative mt-7 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Gavel className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Judge Panel</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <JudgeSquare seat="Judge 1" participant={judge1} livekit={livekit} />
          <JudgeSquare seat="Judge 2" participant={judge2} livekit={livekit} />
          <JudgeSquare seat="Judge 3" participant={judge3} livekit={livekit} />
          <JudgeSquare seat="Judge 4" participant={judge4} livekit={livekit} />
          <JudgeSquare seat="CEO" participant={ceo} ceo livekit={livekit} />
        </div>

        {hostJudge && (
          <div className="mt-3 rounded-2xl border border-purple-400/20 bg-purple-500/5 p-3 text-sm text-purple-200">
            Host is currently seated with the judge panel.
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   SQUARE STAGE TILE
   ============================================================ */

function StageSquare({
  title,
  participant,
  accent,
  specialLabel,
  canModerate,
  livekit,
  onKick,
}: {
  title: string;
  participant: SingOffParticipantLike | null;
  accent: 'pink' | 'purple' | 'cyan';
  specialLabel?: string;
  canModerate?: boolean;
  livekit?: any;
  onKick?: () => void;
}) {
  const border = accent === 'pink' ? 'border-pink-500/40' : accent === 'cyan' ? 'border-cyan-500/40' : 'border-purple-500/40';

  const liveUser = livekit?.remoteUsers?.[participant?.livekit_identity || participant?.user_id || ''];

  return (
    <div className="min-w-0">
      <div className={`relative aspect-square w-full overflow-hidden rounded-2xl border-2 ${border} bg-zinc-950 shadow-xl`}>
        {participant ? (
          <>
            {liveUser?.videoTrack ? (
              <video
                ref={(node) => {
                  if (node && liveUser.videoTrack) liveUser.videoTrack.attach(node);
                }}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : participant.avatar_url ? (
              <img src={participant.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
                <Video className="h-10 w-10 text-white/15" />
              </div>
            )}

            {liveUser?.audioTrack && (
              <audio
                ref={(node) => {
                  if (node && liveUser.audioTrack) liveUser.audioTrack.attach(node);
                }}
                autoPlay
              />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-3 pt-10">
              <div className="truncate text-sm font-black">
                @{participant.username ?? participant.display_name ?? 'user'}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold text-white/55">
                <span>Level {participant.level ?? 0}</span>
                <span>•</span>
                <span className="text-yellow-300">{Number(participant.troll_coins ?? 0).toLocaleString()} coins</span>
              </div>
            </div>

            {liveUser?.isSpeaking && (
              <div className="absolute inset-x-0 top-2 flex justify-center">
                <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
                  Speaking
                </span>
              </div>
            )}

            {canModerate && onKick && (
              <button
                type="button"
                onClick={onKick}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg hover:bg-red-500"
                title="Kick challenger from Mai Sing Off"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/25">
            <Mic2 className="h-8 w-8" />
            <span className="text-xs font-bold">Seat Empty</span>
          </div>
        )}

        <div className="absolute left-2 top-2 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-wider">
          {specialLabel ?? title}
        </div>
      </div>

      <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{title}</div>
    </div>
  );
}

/* ============================================================
   JUDGE SQUARE
   ============================================================ */

function JudgeSquare({
  seat,
  participant,
  ceo = false,
  livekit,
}: {
  seat: string;
  participant: SingOffParticipantLike | null;
  ceo?: boolean;
  livekit?: any;
}) {
  const liveUser = livekit?.remoteUsers?.[participant?.livekit_identity || participant?.user_id || ''];

  return (
    <div>
      <div
        className={`relative aspect-square overflow-hidden rounded-2xl border ${
          ceo ? 'border-yellow-400/50 bg-yellow-500/5' : 'border-white/10 bg-zinc-950'
        }`}
      >
        {participant ? (
          <>
            {liveUser?.videoTrack ? (
              <video
                ref={(node) => {
                  if (node && liveUser.videoTrack) liveUser.videoTrack.attach(node);
                }}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : participant.avatar_url ? (
              <img src={participant.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                {ceo ? <Crown className="h-8 w-8 text-yellow-400" /> : <Gavel className="h-8 w-8 text-white/20" />}
              </div>
            )}

            {liveUser?.audioTrack && (
              <audio
                ref={(node) => {
                  if (node && liveUser.audioTrack) liveUser.audioTrack.attach(node);
                }}
                autoPlay
              />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-2 pt-8">
              <div className="truncate text-xs font-black">
                @{participant.username ?? participant.display_name ?? 'judge'}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
            {ceo ? <Crown className="h-7 w-7 text-yellow-500/30" /> : <Gavel className="h-7 w-7" />}
            <span className="text-[10px] font-bold">Empty</span>
          </div>
        )}
      </div>

      <div className={`mt-1 text-center text-[9px] font-black uppercase tracking-wider ${ceo ? 'text-yellow-400' : 'text-white/40'}`}>
        {seat}
      </div>
    </div>
  );
}

/* ============================================================
   QUEUE
   ============================================================ */

function QueuePanel({
  queue,
  actions,
  canManage,
}: {
  queue: SingOffParticipantLike[];
  actions: any;
  canManage: boolean;
}) {
  return (
    <aside className="h-fit overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
      <header className="border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-black">Performer Queue</span>
        </div>
        <div className="mt-1 text-xs text-white/35">{queue.length} waiting</div>
      </header>

      <div className="p-3">
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-white/30">
            Queue is empty.
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((participant, index) => (
              <div key={participant.id ?? participant.user_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/15 text-xs font-black text-pink-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black">@{participant.username ?? 'user'}</div>
                    <div className="text-[10px] text-white/35">Level {participant.level ?? 0}</div>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => callQueueSeat(actions, participant, 'challenger_a')}
                      className="rounded-lg bg-pink-600/20 px-2 py-2 text-[10px] font-black text-pink-300 hover:bg-pink-600/30"
                    >
                      ADD A
                    </button>
                    <button
                      type="button"
                      onClick={() => callQueueSeat(actions, participant, 'challenger_b')}
                      className="rounded-lg bg-cyan-600/20 px-2 py-2 text-[10px] font-black text-cyan-300 hover:bg-cyan-600/30"
                    >
                      ADD B
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ============================================================
   COINS
   ============================================================ */

function CoinView({ balance }: { balance: number }) {
  const [customAmount, setCustomAmount] = useState('');

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-black">Mai Sing Off Coins</h2>

      <div className="mt-5 rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-6">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300/60">Current Balance</div>
        <div className="mt-2 text-4xl font-black text-yellow-300">{balance.toLocaleString()} coins</div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-zinc-950 p-6">
        <label className="text-sm font-black">Custom Amount</label>
        <input
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="Enter Troll Coins"
          className="mt-3 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400/40"
        />
        <p className="mt-3 text-xs text-white/35">
          Connect this to the existing Mai Troll coin purchase backend. Do not calculate or trust purchase pricing from the browser.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   MOBILE TAB
   ============================================================ */

function MobileStageTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-xs font-black ${
        active ? 'border-b-2 border-pink-500 text-pink-400' : 'text-white/40'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ============================================================
   ERROR / LOADING / AUTH
   ============================================================ */

function SignedOutView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center">
        <Mic2 className="mx-auto h-10 w-10 text-pink-400" />
        <h1 className="mt-4 text-3xl font-black">Mai Sing Off</h1>
        <p className="mt-3 text-sm text-white/45">Sign in to enter the virtual talent show.</p>
        <button type="button" onClick={onSignIn} className="mt-6 w-full rounded-xl bg-pink-600 px-4 py-3 font-black hover:bg-pink-500">
          Sign In
        </button>
      </div>
    </div>
  );
}

function StageLoading({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-pink-400" />
        <h2 className="mt-5 text-lg font-black">Connecting to the stage...</h2>
        <p className="mt-2 text-sm text-white/40">Loading the virtual talent show.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={onBack} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
            Back
          </button>
          <button onClick={onRetry} className="rounded-xl bg-pink-600 px-3 py-2 text-sm font-bold">
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function StageError({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="max-w-lg rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-2 text-sm text-white/45">{message}</p>
        <button onClick={onBack} className="mt-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">
          Back to Mai Sing Off
        </button>
      </div>
    </div>
  );
}

function UnderConstruction() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06060a] p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pink-500/15">
          <Mic2 className="h-8 w-8 text-pink-400" />
        </div>
        <h1 className="mt-6 text-3xl font-black">Under Construction</h1>
        <p className="mt-3 text-sm text-white/45">
          Mai Sing Off is being upgraded. Check back soon for the new virtual talent show experience.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-3 text-sm font-black hover:bg-pink-500"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ACTION COMPATIBILITY HELPERS
   ============================================================ */

async function kickParticipant(actions: any, participant: SingOffParticipantLike) {
  const confirmed = window.confirm(`Kick @${participant.username ?? 'user'} from Mai Sing Off?`);
  if (!confirmed) return;

  if (typeof actions.kickUser === 'function') {
    await actions.kickUser(participant.user_id);
    return;
  }

  if (typeof actions.kickParticipant === 'function') {
    await actions.kickParticipant(participant.user_id);
  }
}

async function callQueueSeat(actions: any, participant: SingOffParticipantLike, position: 'challenger_a' | 'challenger_b') {
  if (typeof actions.callToStage === 'function') {
    await actions.callToStage(participant.user_id, position);
    return;
  }

  if (typeof actions.addToStage === 'function') {
    await actions.addToStage(participant.user_id, position);
    return;
  }

  if (typeof actions.assignPosition === 'function') {
    await actions.assignPosition(participant.user_id, position);
  }
}

