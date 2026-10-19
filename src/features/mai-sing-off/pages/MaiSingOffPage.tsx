import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { ArrowLeft, BarChart3, Coins, Crown, Gavel, Gem, Hash, Loader2, Mic2, Play, Sparkles, Trophy, Tv, Users, Video, X } from 'lucide-react';

import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/lib/store';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { Track } from 'livekit-client';
import { useSingOffStore } from '../store/useSingOffStore';
import { useSingOffActions } from '../hooks/useSingOffActions';
import { useSingOffRealtime } from '../hooks/useSingOffRealtime';
import { SingOffChat } from '../components/SingOffChat';
import { ShowsLobby } from '../components/ShowsLobby';
import { ChampionshipLobby } from '../components/ChampionshipLobby';
import { RolesLobby } from '../components/RolesLobby';
import { StatisticsLobby } from '../components/StatisticsLobby';
import type { SingOffDecision, SingOffRound } from '../types';
import { toast } from 'sonner';

type LobbyView = 'shows' | 'championship' | 'roles' | 'stats';

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
  can_publish?: boolean;
  is_publishing?: boolean;
  is_muted?: boolean;
  is_kicked?: boolean;
}

interface SingOffRemoteMediaUser {
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isSpeaking: boolean;
}

function attachMediaTrack(element: HTMLMediaElement | null, track: MediaStreamTrack | null) {
  if (!element) return;
  element.srcObject = track ? new MediaStream([track]) : null;
}

export default function MaiSingOffPage() {
  const user = useAuthStore((state) => state.user);

  const navigate = useNavigate();
  const location = useLocation();

  const { session, authority, participants, chatMessages, currentRound, rounds, decisions } = useSingOffStore(
    useShallow((state) => ({
      session: state.session,
      authority: state.authority,
      participants: state.participants,
      chatMessages: state.chatMessages,
      currentRound: state.currentRound,
      rounds: state.rounds,
      decisions: state.decisions,
    })),
  );

  const actions = useSingOffActions();

  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const loadedSessionRef = useRef<string | null>(null);
  const ceoAutoClaimedSessionRef = useRef<string | null>(null);

  const [lobbyView, setLobbyView] = useState<LobbyView>('shows');
  const [mobilePanel, setMobilePanel] = useState<'stage' | 'chat' | 'queue'>('stage');
  const [mediaMicEnabled, setMediaMicEnabled] = useState(true);
  const [mediaCameraEnabled, setMediaCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

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
  const isAdmin = authority?.is_admin === true || authority?.isAdmin === true || profileRole === 'admin';
  const isHost = authority?.isHost === true || authority?.canManageQueue === true || isCEO || isAdmin;
  const isJudge = authority?.isJudge === true;
  const isModerator = authority?.isModerator === true || profileRole === 'moderator';

  const canStartShow = isCEO || isAdmin || authority?.canStartShow === true;
  const canEndShow = isCEO || authority?.canEndShow === true;
  const canModerate = isCEO || isAdmin || isModerator || authority?.canModerate === true;

  const blockedFromGlobalSingOffModeration = profileRole === 'broadcaster' || profileRole === 'broadofficer';
  const hasSingOffModeration = canModerate && !blockedFromGlobalSingOffModeration;

  const typedParticipants = participants as SingOffParticipantLike[];

  const myLiveSeat = typedParticipants.find((participant) =>
    participant.user_id === user?.id && participant.can_publish && participant.position,
  );
  const isPublisher = Boolean(session?.status === 'active' && myLiveSeat);

  const {
    isConnected: mediaConnected,
    isPublishing: mediaPublishing,
    remoteUsers: liveKitRemoteUsers,
    localVideoTrack,
    localAudioTrack,
    error: liveKitError,
    joinAsAudience,
    leaveRoom,
    setMicEnabled,
    setCameraEnabled,
  } = useLiveKitRoom({
    roomId: session?.room_name ?? '',
    roomType: 'singoff',
    role: isPublisher ? 'publisher' : 'viewer',
    identity: user?.id ?? '',
    userName: (user as any)?.display_name || 'User',
  });
  const mediaSessionId = session?.id;
  const mediaRoomName = session?.room_name;
  const isShowActive = session?.status === 'active';
  useSingOffRealtime(sessionId, user?.id);

  const connectAndPublish = useCallback(async () => {
    if (!mediaRoomName || !mediaSessionId || !user?.id) {
      setMediaError('The show room is not ready yet.');
      return false;
    }
    if (mediaConnected && mediaPublishing) return true;

    setMediaError(null);
    await leaveRoom();
    const call = await joinAsAudience({
      userId: user.id,
      streamId: mediaSessionId,
      roomName: mediaRoomName,
      publishCapable: true,
    });
    if (!call || typeof call === 'string') {
      if (typeof call === 'string') setMediaError(call);
      return false;
    }
    setMediaMicEnabled(true);
    setMediaCameraEnabled(true);
    return true;
  }, [joinAsAudience, leaveRoom, mediaConnected, mediaPublishing, mediaRoomName, mediaSessionId, user?.id]);

  /* Stage participants */
  useEffect(() => {
    if (!isShowActive || isPublisher || !user?.id) return;
    let cancelled = false;
    setMediaError(null);
    void joinAsAudience(user.id).then((result) => {
      if (cancelled) return;
      if (typeof result === 'string') setMediaError(result);
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error('[MaiSingOffPage] LiveKit viewer join failed', error);
      setMediaError('Could not connect to the LiveKit show.');
    });
    return () => {
      cancelled = true;
      void leaveRoom();
    };
  }, [isPublisher, isShowActive, joinAsAudience, leaveRoom, user?.id]);

  const toggleMicrophone = useCallback(async () => {
    const nextEnabled = !mediaMicEnabled;
    const succeeded = await setMicEnabled(nextEnabled);
    if (!succeeded) {
      const message = 'Could not change your microphone state.';
      setMediaError(message);
      toast.error(message);
      return;
    }
    setMediaMicEnabled(nextEnabled);
  }, [mediaMicEnabled, setMicEnabled]);

  const toggleCamera = useCallback(async () => {
    const nextEnabled = !mediaCameraEnabled;
    const succeeded = await setCameraEnabled(nextEnabled);
    if (!succeeded) {
      const message = 'Could not change your camera state.';
      setMediaError(message);
      toast.error(message);
      return;
    }
    setMediaCameraEnabled(nextEnabled);
  }, [mediaCameraEnabled, setCameraEnabled]);

  const remoteMediaUsers = useMemo(() => {
    const users: Record<string, SingOffRemoteMediaUser> = {};
    liveKitRemoteUsers.forEach((participant) => {
      const videoPub = participant.getTrackPublication?.(Track.Source.Camera);
      const audioPub = participant.getTrackPublication?.(Track.Source.Microphone);
      users[participant.identity] = {
        videoTrack: (videoPub?.track as unknown as MediaStreamTrack | null) ?? null,
        audioTrack: (audioPub?.track as unknown as MediaStreamTrack | null) ?? null,
        isSpeaking: false,
      };
    });
    if (user?.id) {
      users[user.id] = {
        videoTrack: (localVideoTrack as unknown as MediaStreamTrack | null) ?? null,
        audioTrack: (localAudioTrack as unknown as MediaStreamTrack | null) ?? null,
        isSpeaking: false,
      };
    }
    return users;
  }, [liveKitRemoteUsers, localAudioTrack, localVideoTrack, user?.id]);

  const singOffMedia = useMemo(() => ({
    isConnected: mediaConnected,
    isPublishing: mediaPublishing,
    remoteUsers: remoteMediaUsers,
    micEnabled: mediaMicEnabled,
    cameraEnabled: mediaCameraEnabled,
    error: mediaError || liveKitError,
    connect: connectAndPublish,
    toggleMic: toggleMicrophone,
    toggleCamera,
  }), [connectAndPublish, liveKitError, mediaCameraEnabled, mediaConnected, mediaError, mediaMicEnabled, mediaPublishing, remoteMediaUsers, toggleCamera, toggleMicrophone]);

  const latestRoundWinnerId = [...rounds]
    .filter((round) => round.status === 'completed' && round.winner_id)
    .sort((a, b) => b.round_number - a.round_number)[0]?.winner_id ?? null;

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

  useEffect(() => {
    if (
      session?.status !== 'active' ||
      !session.id ||
      !user?.id ||
      !(isCEO || isAdmin) ||
      ceo?.user_id === user.id ||
      (ceo && ceo.user_id !== user.id) ||
      ceoAutoClaimedSessionRef.current === session.id
    ) {
      return;
    }

    ceoAutoClaimedSessionRef.current = session.id;
    void actionsRef.current.claimCeoSeat?.();
  }, [ceo, isAdmin, isCEO, session?.id, session?.status, user?.id]);

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
    const confirmed = window.confirm('End the current Mai Talent Show show?');
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

  /* ============ MAIN / LOBBY PAGE ============ */
  if (inStage) {
    if (!sessionId) {
      return (
        <StageError
          title="Invalid show"
          message="This Mai Talent Show show does not have a valid session ID."
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
                  {session.title || 'Mai Talent Show'}
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

        <div className="hidden w-full max-w-none gap-4 p-3 md:grid md:grid-cols-[minmax(280px,22vw)_minmax(0,1fr)_minmax(240px,19vw)] xl:gap-5 xl:p-5">
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
            media={singOffMedia}
            actions={actionsRef.current}
            isHost={isHost || isCEO || isAdmin}
            canForceHost={isCEO || isAdmin}
            canClaimCeoSeat={isCEO || isAdmin}
            isJudge={isJudge}
            isJudgeEligible={authority?.is_judge_eligible === true}
            currentRound={currentRound}
            decisions={decisions}
            latestRoundWinnerId={latestRoundWinnerId}
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
                media={singOffMedia}
                actions={actionsRef.current}
                isHost={isHost || isCEO || isAdmin}
                canForceHost={isCEO || isAdmin}
                canClaimCeoSeat={isCEO || isAdmin}
                isJudge={isJudge}
                isJudgeEligible={authority?.is_judge_eligible === true}
                currentRound={currentRound}
                decisions={decisions}
                latestRoundWinnerId={latestRoundWinnerId}
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
                Earn your place in Mai Talent Show history — now with scheduled shows,
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
        </div>
      </div>

      {/* LOBBY CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {lobbyView === 'shows' && <ShowsLobby />}
        {lobbyView === 'championship' && <ChampionshipLobby />}
        {lobbyView === 'roles' && <RolesLobby />}
        {lobbyView === 'stats' && <StatisticsLobby />}
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
  media: any;
  actions: any;
  isHost: boolean;
  canForceHost: boolean;
  canClaimCeoSeat: boolean;
  isJudge: boolean;
  isJudgeEligible: boolean;
  currentRound: SingOffRound | null;
  decisions: SingOffDecision[];
  latestRoundWinnerId: string | null;
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
  media,
  actions,
  isHost,
  canForceHost,
  canClaimCeoSeat,
  isJudge,
  isJudgeEligible,
  currentRound,
  decisions,
  latestRoundWinnerId,
  myUserId,
}: StageAreaProps) {
  const [selectedSeatPosition, setSelectedSeatPosition] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [participantNote, setParticipantNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const mySeats = [
    challengerA,
    challengerB,
    hostStage,
    hostJudge,
    judge1,
    judge2,
    judge3,
    judge4,
    ceo,
  ].filter((p) => p?.user_id === myUserId);
  const mySeat = mySeats[0] ?? null;
  const selectedMySeat = mySeats.find((p) => p?.position === selectedSeatPosition);
  const hasSelectedMySeat = Boolean(selectedMySeat);
  const selectedParticipant = [challengerA, challengerB].find(
    (participant) => participant?.user_id === selectedParticipantId,
  ) ?? null;
  const selectedParticipantUserId = selectedParticipant?.user_id;
  const loadParticipantNote = actions.loadParticipantNote;

  const connectAndPublish = async () => {
    if (media?.isConnected && media?.isPublishing) return;
    await media?.connect?.();
  };

  const selectMySeat = (participant: SingOffParticipantLike | null) =>
    participant?.user_id === myUserId
      ? () => {
          const willSelect = selectedSeatPosition !== participant.position;
          setSelectedSeatPosition(willSelect ? participant.position ?? null : null);
          if (willSelect && participant.can_publish) void connectAndPublish();
        }
      : undefined;

  const selectParticipant = (participant: SingOffParticipantLike | null) =>
    participant ? () => setSelectedParticipantId(participant.user_id) : undefined;

  const canReviewParticipant = Boolean(
    canForceHost ||
    (selectedMySeat &&
      ['host', 'host_judge', 'judge', 'ceo_judge'].includes(String(selectedMySeat.role))),
  );

  useEffect(() => {
    if (!selectedParticipantUserId || !canReviewParticipant || typeof loadParticipantNote !== 'function') {
      setParticipantNote('');
      setNoteError(null);
      setNoteLoading(false);
      return;
    }

    let cancelled = false;
    setNoteLoading(true);
    setNoteError(null);
    void loadParticipantNote(selectedParticipantUserId)
      .then((result: { success: boolean; note?: string; error?: string }) => {
        if (cancelled) return;
        if (!result.success) {
          setNoteError(result.error || 'Could not load the private note.');
          return;
        }
        setParticipantNote(result.note ?? '');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[MaiSingOffPage] participant note load failed', error);
        setNoteError('Could not load the private note.');
      })
      .finally(() => {
        if (!cancelled) setNoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewParticipant, loadParticipantNote, selectedParticipantUserId]);

  const handleClaimSeat = async (position: string) => {
    if (position === 'ceo') {
      await actions.claimCeoSeat?.();
      return;
    }
    if (position.startsWith('judge_')) {
      await actions.claimJudgeSeat?.(position);
      return;
    }
    if (typeof actions.claimSeat === 'function') {
      await actions.claimSeat(position);
      return;
    }
    // Fallback: use assignPosition via actions
    if (typeof actions.assignPosition === 'function') {
      await actions.assignPosition(myUserId, position);
    }
  };

  const moveHostTo = (position: 'host_stage' | 'host_judge') => {
    if (canForceHost) {
      void handleClaimSeat(position);
      return;
    }
    void actions.moveHost?.(position);
  };

  const myHostPosition = hostStage?.user_id === myUserId
    ? 'host_stage'
    : hostJudge?.user_id === myUserId
      ? 'host_judge'
      : null;

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

      {(media?.isConnected || hasSelectedMySeat || media?.error) && (
        <div className="relative mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`h-2 w-2 rounded-full ${media.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            {media?.isConnected ? 'Connected to LiveKit' : 'Connecting to LiveKit'}
            {media.isPublishing && (
              <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">PUBLISHING</span>
            )}
          </div>

          {hasSelectedMySeat && media?.isConnected ? (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => void media.toggleMic()}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/10"
              >
                {media.micEnabled ? 'Mute Mic' : 'Unmute Mic'}
              </button>
              <button
                type="button"
                onClick={() => void media.toggleCamera()}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/10"
              >
                {media.cameraEnabled ? 'Cam Off' : 'Cam On'}
              </button>
            </div>
          ) : (
            <span className="ml-auto text-[10px] text-white/35">
              {hasSelectedMySeat ? 'Seat controls will be available when connected' : mySeat ? 'Click your seat to open controls' : 'Watch-only'}
            </span>
          )}
          {media?.error && <span role="alert" className="w-full text-xs text-red-300">{media.error}</span>}
        </div>
      )}

      {canForceHost && !myHostPosition && (
        <div className="relative mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-purple-300/25 bg-purple-500/10 p-3">
          <span className="mr-auto text-xs font-bold text-purple-100">Admin host controls</span>
          <button
            type="button"
            disabled={Boolean(hostStage && hostStage.user_id !== myUserId)}
            onClick={() => moveHostTo('host_stage')}
            className="rounded-lg border border-purple-200/30 bg-purple-500/20 px-3 py-2 text-[10px] font-black text-purple-100 transition hover:bg-purple-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {hostStage && hostStage.user_id !== myUserId ? 'Host Stage Occupied' : 'Take Host Stage'}
          </button>
          <button
            type="button"
            disabled={Boolean(hostJudge && hostJudge.user_id !== myUserId)}
            onClick={() => moveHostTo('host_judge')}
            className="rounded-lg border border-cyan-200/30 bg-cyan-500/15 px-3 py-2 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {hostJudge && hostJudge.user_id !== myUserId ? 'Host Judge Seat Occupied' : 'Sit with Judges'}
          </button>
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
          media={media}
          onEnterSeat={!mySeat && !challengerA ? () => void handleClaimSeat('challenger_a') : undefined}
          onSelectSeat={selectMySeat(challengerA)}
          onSelectParticipant={selectParticipant(challengerA)}
          isSelected={(selectedSeatPosition === challengerA?.position && challengerA?.user_id === myUserId) || selectedParticipantId === challengerA?.user_id}
          isWinner={Boolean(challengerA && (currentRound?.winner_id ?? latestRoundWinnerId) === challengerA.user_id)}
          onKick={challengerA ? () => kickParticipant(actions, challengerA) : undefined}
        />

        <div className="min-w-0">
          <StageSquare
            title="HOST"
            participant={hostStage}
            accent="purple"
            specialLabel="HOST"
            canModerate={canModerate}
            media={media}
            onEnterSeat={!mySeat && !hostStage && isHost ? () => moveHostTo('host_stage') : undefined}
            onSelectSeat={selectMySeat(hostStage)}
            isSelected={selectedSeatPosition === hostStage?.position && hostStage?.user_id === myUserId}
            emptyActionLabel="Click to take host stage"
          />
          {hostStage && myUserId === hostStage.user_id && (
            <button
              type="button"
              disabled={Boolean(hostJudge && hostJudge.user_id !== myUserId)}
              onClick={() => moveHostTo('host_judge')}
              className="mt-2 w-full rounded-xl border border-purple-300/30 bg-purple-500/15 px-3 py-2 text-xs font-black text-purple-100 transition hover:border-purple-200/60 hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hostJudge && hostJudge.user_id !== myUserId ? 'Host Judge Seat Occupied' : 'Sit with Judges'}
            </button>
          )}
        </div>

        <StageSquare
          title="CHALLENGER B"
          participant={challengerB}
          accent="cyan"
          canModerate={canModerate}
          media={media}
          onEnterSeat={!mySeat && !challengerB ? () => void handleClaimSeat('challenger_b') : undefined}
          onSelectSeat={selectMySeat(challengerB)}
          onSelectParticipant={selectParticipant(challengerB)}
          isSelected={(selectedSeatPosition === challengerB?.position && challengerB?.user_id === myUserId) || selectedParticipantId === challengerB?.user_id}
          isWinner={Boolean(challengerB && (currentRound?.winner_id ?? latestRoundWinnerId) === challengerB.user_id)}
          onKick={challengerB ? () => kickParticipant(actions, challengerB) : undefined}
        />
      </div>

      <div className="relative mt-7 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Gavel className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Judge Panel</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <JudgeSquare seat="Judge 1" participant={judge1} media={media} isSelected={selectedSeatPosition === judge1?.position && judge1?.user_id === myUserId} onSelectSeat={selectMySeat(judge1)} onEnterSeat={!mySeat && !judge1 && (isJudge || isJudgeEligible) ? () => void handleClaimSeat('judge_1') : undefined} />
          <JudgeSquare seat="Judge 2" participant={judge2} media={media} isSelected={selectedSeatPosition === judge2?.position && judge2?.user_id === myUserId} onSelectSeat={selectMySeat(judge2)} onEnterSeat={!mySeat && !judge2 && (isJudge || isJudgeEligible) ? () => void handleClaimSeat('judge_2') : undefined} />
          <JudgeSquare seat="Judge 3" participant={judge3} media={media} isSelected={selectedSeatPosition === judge3?.position && judge3?.user_id === myUserId} onSelectSeat={selectMySeat(judge3)} onEnterSeat={!mySeat && !judge3 && (isJudge || isJudgeEligible) ? () => void handleClaimSeat('judge_3') : undefined} />
          <JudgeSquare seat="Judge 4" participant={judge4} media={media} isSelected={selectedSeatPosition === judge4?.position && judge4?.user_id === myUserId} onSelectSeat={selectMySeat(judge4)} onEnterSeat={!mySeat && !judge4 && (isJudge || isJudgeEligible) ? () => void handleClaimSeat('judge_4') : undefined} />
          <JudgeSquare seat="CEO" participant={ceo} ceo media={media} isSelected={selectedSeatPosition === ceo?.position && ceo?.user_id === myUserId} onSelectSeat={selectMySeat(ceo)} onEnterSeat={!mySeat && !ceo && canClaimCeoSeat ? () => void handleClaimSeat('ceo') : undefined} />
          <JudgeSquare
            seat="Host"
            participant={hostJudge}
            media={media}
            isSelected={selectedSeatPosition === hostJudge?.position && hostJudge?.user_id === myUserId}
            onSelectSeat={selectMySeat(hostJudge)}
            onEnterSeat={!mySeat && !hostJudge && isHost ? () => moveHostTo('host_judge') : undefined}
            onHostSpeak={myUserId === hostJudge?.user_id || (canForceHost && Boolean(hostJudge)) ? () => moveHostTo('host_stage') : undefined}
          />
        </div>
      </div>

      {selectedParticipant && (
        <ParticipantOptions
          participant={selectedParticipant}
          selectedSeat={selectedMySeat ?? null}
          canReviewParticipant={canReviewParticipant}
          currentRound={currentRound}
          decisions={decisions}
          myUserId={myUserId}
          note={participantNote}
          noteLoading={noteLoading}
          noteSaving={noteSaving}
          noteError={noteError}
          onNoteChange={setParticipantNote}
          onSaveNote={async () => {
            if (!selectedParticipant || typeof actions.saveParticipantNote !== 'function') return;
            setNoteSaving(true);
            setNoteError(null);
            try {
              const result = await actions.saveParticipantNote(selectedParticipant.user_id, participantNote);
              if (!result?.success) setNoteError(result?.error || 'Could not save the private note.');
            } catch (error) {
              console.error('[MaiSingOffPage] participant note save failed', error);
              setNoteError('Could not save the private note.');
            } finally {
              setNoteSaving(false);
            }
          }}
          onVote={(vote, maiWinner) => {
            void actions.submitDecision?.(selectedParticipant.user_id, vote, maiWinner);
          }}
        />
      )}
    </section>
  );
}

function ParticipantOptions({
  participant,
  selectedSeat,
  canReviewParticipant,
  currentRound,
  decisions,
  myUserId,
  note,
  noteLoading,
  noteSaving,
  noteError,
  onNoteChange,
  onSaveNote,
  onVote,
}: {
  participant: SingOffParticipantLike;
  selectedSeat: SingOffParticipantLike | null;
  canReviewParticipant: boolean;
  currentRound: SingOffRound | null;
  decisions: SingOffDecision[];
  myUserId: string;
  note: string;
  noteLoading: boolean;
  noteSaving: boolean;
  noteError: string | null;
  onNoteChange: (note: string) => void;
  onSaveNote: () => void;
  onVote: (vote: 'yes' | 'no', maiWinner: boolean) => void;
}) {
  const validJudgeSeat = Boolean(
    selectedSeat &&
    ['judge_1', 'judge_2', 'judge_3', 'judge_4', 'host_judge', 'ceo'].includes(String(selectedSeat.position)) &&
    ['judge', 'host_judge', 'ceo_judge'].includes(String(selectedSeat.role)),
  );
  const isContestantInRound = Boolean(
    currentRound?.status === 'active' &&
    [currentRound.challenger_a_id, currentRound.challenger_b_id].includes(participant.user_id),
  );
  const vote = decisions.find(
    (decision) => decision.judge_id === myUserId && decision.challenger_id === participant.user_id,
  );
  const existingMaiWinner = decisions.some(
    (decision) => decision.decision === 'mai_winner' && decision.challenger_id !== participant.user_id,
  );

  return (
    <section className="relative mt-5 rounded-2xl border border-white/10 bg-black/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-black">Participant options: @{participant.username ?? participant.display_name ?? 'performer'}</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-white/65">Private participant note</div>
          {canReviewParticipant ? (
            <>
              <textarea
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                maxLength={2000}
                disabled={noteLoading || noteSaving}
                rows={4}
                placeholder="Notes are private to your account and saved on the server."
                className="w-full resize-y rounded-lg border border-white/10 bg-black/50 p-3 text-sm text-white outline-none focus:border-purple-300/50 disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-white/40">{note.length}/2000 · private to you</span>
                <button
                  type="button"
                  onClick={onSaveNote}
                  disabled={noteLoading || noteSaving || note.length > 2000}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {noteLoading ? 'Loading…' : noteSaving ? 'Saving…' : 'Save note'}
                </button>
              </div>
              {noteError && <p role="alert" className="mt-2 text-xs text-red-300">{noteError}</p>}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-white/45">
              Select your judge or host seat to view and save your private note for this participant.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-white/65">Judge vote</div>
          {validJudgeSeat && isContestantInRound ? (
            <>
              <p className="mb-3 text-xs text-white/45">
                {vote ? `Your current vote: ${vote.decision.replace('_', ' ')}` : 'Choose yes or no for this active round.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['yes', 'no'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={vote?.decision === choice}
                    onClick={() => onVote(choice, false)}
                    className={`rounded-lg border px-4 py-2 text-xs font-black uppercase ${
                      vote?.decision === choice
                        ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-200'
                        : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    {choice}
                  </button>
                ))}
                {selectedSeat?.position === 'ceo' && (
                  <button
                    type="button"
                    disabled={existingMaiWinner}
                    onClick={() => onVote('yes', true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300/40 bg-yellow-500/15 px-3 py-2 text-xs font-black text-yellow-200 hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Gem className="h-3.5 w-3.5" />
                    {existingMaiWinner ? 'Winner already declared' : 'Award Mai Winner'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-white/45">
              Voting is available to an assigned judge seat when this participant is competing in an active round.
            </p>
          )}
        </div>
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
  media,
  onEnterSeat,
  onSelectSeat,
  onSelectParticipant,
  isSelected = false,
  isWinner = false,
  emptyActionLabel,
  onKick,
}: {
  title: string;
  participant: SingOffParticipantLike | null;
  accent: 'pink' | 'purple' | 'cyan';
  specialLabel?: string;
  canModerate?: boolean;
  media?: any;
  onEnterSeat?: () => void;
  onSelectSeat?: () => void;
  onSelectParticipant?: () => void;
  isSelected?: boolean;
  isWinner?: boolean;
  emptyActionLabel?: string;
  onKick?: () => void;
}) {
  const accentStyles = {
    pink: {
      border: 'border-pink-300/70',
      glow: 'shadow-[0_0_32px_rgba(236,72,153,0.24)]',
      badge: 'border-pink-200/40 bg-pink-500/20 text-pink-100',
      empty: 'from-pink-950/40 via-zinc-950 to-black',
    },
    purple: {
      border: 'border-purple-300/70',
      glow: 'shadow-[0_0_32px_rgba(168,85,247,0.22)]',
      badge: 'border-purple-200/40 bg-purple-500/20 text-purple-100',
      empty: 'from-purple-950/40 via-zinc-950 to-black',
    },
    cyan: {
      border: 'border-cyan-300/70',
      glow: 'shadow-[0_0_32px_rgba(34,211,238,0.22)]',
      badge: 'border-cyan-200/40 bg-cyan-500/20 text-cyan-100',
      empty: 'from-cyan-950/40 via-zinc-950 to-black',
    },
  }[accent];

  const liveUser = media?.remoteUsers?.[participant?.user_id || ''];
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => attachMediaTrack(node, liveUser?.videoTrack ?? null),
    [liveUser?.videoTrack],
  );
  const audioRef = useCallback(
    (node: HTMLAudioElement | null) => attachMediaTrack(node, liveUser?.audioTrack ?? null),
    [liveUser?.audioTrack],
  );

  return (
    <div className="min-w-0">
      <div
        role={onEnterSeat || onSelectSeat || onSelectParticipant ? 'button' : undefined}
        tabIndex={onEnterSeat || onSelectSeat || onSelectParticipant ? 0 : undefined}
        aria-label={onEnterSeat
          ? `${title} seat available. ${emptyActionLabel ?? 'Click to enter seat'}`
          : onSelectSeat ? `Your ${title} seat. Click to open seat options.` : onSelectParticipant ? `Select ${title} participant options.` : undefined}
        onClick={onEnterSeat ?? onSelectSeat ?? onSelectParticipant}
        onKeyDown={onEnterSeat || onSelectSeat || onSelectParticipant ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (onEnterSeat ?? onSelectSeat ?? onSelectParticipant)?.();
          }
        } : undefined}
        className={`group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 ${accentStyles.border} ${accentStyles.glow} bg-gradient-to-br ${accentStyles.empty} ring-1 ring-white/10 transition duration-300 ${onEnterSeat || onSelectSeat ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_0_42px_rgba(255,255,255,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' : ''} ${isSelected ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-black' : ''}`}
      >
        {participant ? (
          <>
            {liveUser?.videoTrack ? (
              <video
                ref={videoRef}
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
                ref={audioRef}
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

            {isWinner && (
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-yellow-300/50 bg-black/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.45)]">
                <Gem className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                Mai Winner
              </div>
            )}

            {canModerate && onKick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onKick();
                }}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg hover:bg-red-500"
                title="Kick challenger from Mai Talent Show"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/35">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <Mic2 className="h-8 w-8" />
            </div>
            <span className="text-xs font-bold">{title === 'HOST' ? 'Host is with the judges' : 'Seat Empty'}</span>
            {onEnterSeat && (
              <span className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-black text-white/80">
                {emptyActionLabel ?? 'Click to enter seat'}
              </span>
            )}
          </div>
        )}

        <div className={`absolute left-3 top-3 rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-lg backdrop-blur-md ${accentStyles.badge}`}>
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
  media,
  onSelectSeat,
  onEnterSeat,
  isSelected = false,
  onHostSpeak,
}: {
  seat: string;
  participant: SingOffParticipantLike | null;
  ceo?: boolean;
  media?: any;
  onSelectSeat?: () => void;
  onEnterSeat?: () => void;
  isSelected?: boolean;
  onHostSpeak?: () => void;
}) {
  const liveUser = media?.remoteUsers?.[participant?.user_id || ''];
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => attachMediaTrack(node, liveUser?.videoTrack ?? null),
    [liveUser?.videoTrack],
  );
  const audioRef = useCallback(
    (node: HTMLAudioElement | null) => attachMediaTrack(node, liveUser?.audioTrack ?? null),
    [liveUser?.audioTrack],
  );

  return (
    <div>
      <div
        role={onEnterSeat || onSelectSeat ? 'button' : undefined}
        tabIndex={onEnterSeat || onSelectSeat ? 0 : undefined}
        aria-label={onEnterSeat ? `${seat} seat available. Click to enter seat.` : onSelectSeat ? `Your ${seat} seat. Click to open seat options.` : undefined}
        onClick={onEnterSeat ?? onSelectSeat}
        onKeyDown={onEnterSeat || onSelectSeat ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (onEnterSeat ?? onSelectSeat)?.();
          }
        } : undefined}
        className={`relative aspect-square overflow-hidden rounded-2xl border shadow-lg transition duration-300 ${
          ceo ? 'border-yellow-300/60 bg-yellow-500/10 shadow-[0_0_24px_rgba(250,204,21,0.12)]' : seat === 'Host' ? 'border-purple-300/60 bg-purple-500/10 shadow-[0_0_24px_rgba(168,85,247,0.16)]' : 'border-white/15 bg-zinc-950'
        } ${onEnterSeat || onSelectSeat ? 'cursor-pointer hover:border-white/40 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' : ''} ${isSelected ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-black' : ''}`}
      >
        {participant ? (
          <>
            {liveUser?.videoTrack ? (
              <video
                ref={videoRef}
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
                ref={audioRef}
                autoPlay
              />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-2 pt-8">
              <div className="truncate text-sm font-black">
                {ceo
                  ? participant.display_name || 'Mai (CEO)'
                  : `@${participant.username ?? participant.display_name ?? 'judge'}`}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
            {ceo ? <Crown className="h-7 w-7 text-yellow-500/30" /> : <Gavel className="h-7 w-7" />}
            <span className="text-[10px] font-bold">{onEnterSeat ? 'Click to enter seat' : 'Empty'}</span>
          </div>
        )}
      </div>

      <div className={`mt-1 text-center text-[10px] font-black uppercase tracking-wider ${ceo ? 'text-yellow-300' : seat === 'Host' ? 'text-purple-200' : 'text-white/50'}`}>
        {seat}
      </div>
      {onHostSpeak && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onHostSpeak();
          }}
          className="mt-2 w-full rounded-lg border border-purple-300/30 bg-purple-500/15 px-2 py-1.5 text-[10px] font-black text-purple-100 transition hover:bg-purple-500/25"
        >
          Speak on Stage
        </button>
      )}
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
        <h1 className="mt-4 text-3xl font-black">Mai Talent Show</h1>
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
          Back to Mai Talent Show
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ACTION COMPATIBILITY HELPERS
   ============================================================ */

async function kickParticipant(actions: any, participant: SingOffParticipantLike) {
  const confirmed = window.confirm(`Kick @${participant.username ?? 'user'} from Mai Talent Show?`);
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
