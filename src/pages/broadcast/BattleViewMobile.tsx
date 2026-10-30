import React, { useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, X, LogOut } from "lucide-react";
import { Track } from "livekit-client";

import type { BattleViewController } from "../../hooks/useBattleViewController";
import useTrollTime from "../../hooks/useTrollTime";
import TrollTimeBanner from "../../components/battle/TrollTimeBanner";
import { getTrackPublications } from "../../components/broadcast/battleArenaUtils";
import QuickGiftRow from "../../components/broadcast/QuickGiftRow";
import type { ActiveBattle } from "../../hooks/useActiveBattles";

import MobileBattleHeader from "../../components/battle/mobile/MobileBattleHeader";
import MobileBattleScore from "../../components/battle/mobile/MobileBattleScore";
import MobileBattleTeamRow from "../../components/battle/mobile/MobileBattleTeamRow";
import MobileBattleStatus from "../../components/battle/mobile/MobileBattleStatus";
import MobileBattleFloatingChat from "../../components/battle/mobile/MobileBattleFloatingChat";
import MobileBattleShareSheet from "../../components/battle/mobile/MobileBattleShareSheet";
import MobileBattleFooter from "../../components/battle/mobile/MobileBattleFooter";
import type { MobileParticipantVM } from "../../components/battle/mobile/MobileBattleParticipant";
import MatchFoundOverlay from "../../components/broadcast/MatchFoundOverlay";

const STAFF_ROLES = new Set([
  "admin",
  "owner",
  "ceo",
  "moderator",
  "lead_troll_officer",
  "troll_officer",
  "staff",
]);

function isStaffProfile(profile: any): boolean {
  const role = String(profile?.role || profile?.account_type || "").toLowerCase();
  return (
    STAFF_ROLES.has(role) ||
    profile?.is_admin === true ||
    profile?.is_staff === true ||
    profile?.is_moderator === true
  );
}

function normalizeId(v: string | null | undefined) {
  return String(v || "").replace(/-/g, "").toLowerCase();
}

/**
 * Mobile BattleView — a SEPARATE layout from the desktop BattleView.
 * Consumes the same shared battle controller, so resizing between mobile and
 * desktop never re-initializes the LiveKit room, realtime subscriptions, or gifts.
 *
 * Scoring uses POINTS (gift coin value), never crowns.
 */
export default function BattleViewMobile({ battleView }: { battleView: BattleViewController }) {
  const {
    battleId,
    battle,
    bluePoints,
    redPoints,
    remainingTime,
    isSuddenDeath,
    battleStatus,
    viewerCount,
    activeBattles,
    battleParticipants,
    departedSeatKeys,
    participantContributions,
    remoteUsers,
    userIdToLiveKitIdentity: _userIdToLiveKitIdentity,
    effectiveUserId,
    isBroadcaster,
    profile,
    challengerStream,
    opponentStream,
    currentStreamId,
    giftRecipientId,
    showMobileGiftTray,
    setShowMobileGiftTray,
    setGiftRecipientId,
    setGiftStreamId,
    handleGiftSelect,
    handleBack,
    handleSelectBattle,
    handleReturnToStream,
    handleLeaveBattle,
    leaveLoading,
    showRematchOption,
    handleRematch,
    participantInfo,
    followBroadcaster,
    shareBroadcast: _shareBroadcast,
    loading,
    error,
    showResults,
    preBattleCountdown,
    onToggleCamera,
    onToggleMic: _onToggleMic,
    onOpenBroadcasterControls,
    battleLocalVideoTrack,
    battleLocalAudioTrack,
  } = battleView;

  // Server-authoritative Troll Time state for this battle.
  const trollTime = useTrollTime(battleId);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [shareSheetOpen, setShareSheetOpen] = React.useState(false);

  // Resolve LiveKit video/audio tracks for a participant user id.
  //
  // NOTE: In the battle room each broadcaster connects with their BARE user id
  // as the LiveKit identity (the battle token uses `identity || userId`). The
  // `userIdToLiveKitIdentity` map passed from BroadcastPage instead maps seat
  // user ids to the MAIN broadcast-room identity (`viewer-<streamId>-<uuid>`),
  // which is meaningless inside the battle room. So we must match the remote
  // participant primarily by the bare user id, and never rely on that map for
  // battles. We match by exact identity or exact normalized identity only — no
  // fuzzy substring matching and no ULTRA-FALLBACK that could cross-map one
  // broadcaster's video onto another participant's box.
  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const findRemoteByIdentity = useCallback((identity: string) => {
    const target = normalizeId(identity);
    return remoteUsers.find((u) => {
      const id = String(u.identity || "");
      const n = normalizeId(id);
      return id === identity || n === target;
    });
  }, [remoteUsers]);

  // Track cache so a brief unsubscribe/reconnect doesn't drop a box back to the
  // profile picture (mirrors BattleArena's lastKnownTrackRef behaviour).
  const trackCacheRef = React.useRef<Record<string, { videoTrack?: any; hasAudio: boolean; audioMuted: boolean; hasVideo: boolean }>>({});

  const resolveTrack = useCallback((userId: string) => {
    // In the battle room, participants use bare user IDs as LiveKit identities.
    const remote = findRemoteByIdentity(userId);

    if (!remote) {
      const cached = trackCacheRef.current[userId];
      if (cached?.videoTrack || cached?.hasAudio) return cached;
      return { videoTrack: undefined, hasAudio: false, audioMuted: false, hasVideo: false };
    }

    const videoPubs = getTrackPublications(remote, "video");
    const audioPubs = getTrackPublications(remote, "audio");

    const videoTrack =
      videoPubs.find((p: any) => p.isSubscribed && p.track && p.source === Track.Source.Camera)?.track ||
      videoPubs.find((p: any) => p.track && p.source === Track.Source.Camera)?.track ||
      videoPubs.find((p: any) => p.isSubscribed && p.track)?.track ||
      videoPubs.find((p: any) => p.track)?.track ||
      (isMobileDevice ? videoPubs.find((p: any) => p.track)?.track : undefined);

    const audioTrack = audioPubs.find((p: any) => p.isSubscribed && p.track)?.track || audioPubs.find((p: any) => p.track)?.track;
    const hasAudio = !!audioTrack;
    const audioMuted = hasAudio ? Boolean((audioTrack as any)?.isMuted) : false;
    const hasVideo = !!videoTrack;

    const result = { videoTrack, hasAudio, audioMuted, hasVideo };
    if (videoTrack || hasAudio) {
      trackCacheRef.current[userId] = result;
    }
    return result;
  }, [findRemoteByIdentity, isMobileDevice]);

  const { blueVMs, redVMs } = useMemo(() => {
    const blue: MobileParticipantVM[] = [];
    const red: MobileParticipantVM[] = [];

    for (const p of battleParticipants as any[]) {
      if (departedSeatKeys.has(`${p.source_stream_id}:${p.user_id}`)) continue;
      const team = p.team === "opponent" ? "red" : "blue";
      const isLocal = effectiveUserId && p.user_id === effectiveUserId;
      let videoTrack = isLocal ? battleLocalVideoTrack : undefined;
      let hasAudio = isLocal ? !!battleLocalAudioTrack : false;
      let hasVideo = isLocal ? !!battleLocalVideoTrack : undefined;
      let audioMuted: boolean | undefined = undefined;

      if (!isLocal) {
        const fallback = resolveTrack(p.user_id);
        const fbVideo = fallback.videoTrack;
        const fbAudio = fallback.hasAudio;
        const fbAudioMuted = fallback.audioMuted;
        const fbHasVideo = fallback.hasVideo;
        if (fbVideo) videoTrack = fbVideo;
        if (fbAudio) hasAudio = true;
        hasVideo = fbHasVideo;
        audioMuted = fbAudioMuted;
      }

      const vm: MobileParticipantVM = {
        userId: p.user_id,
        username: p.profile?.username || p.username || "User",
        avatarUrl: p.profile?.avatar_url,
        role: p.role,
        team,
        seatIndex: p.seat_index,
        points: participantContributions?.[p.user_id] || 0,
        videoTrack,
        hasAudio,
        hasVideo,
        audioMuted,
      };
      if (team === "blue") blue.push(vm);
      else red.push(vm);
    }
    return { blueVMs: blue, redVMs: red };
  }, [battleParticipants, departedSeatKeys, participantContributions, resolveTrack, effectiveUserId, battleLocalVideoTrack, battleLocalAudioTrack]);

  const viewers = useMemo(() => {
    return (battleParticipants as any[])
      .map((p) => ({
        userId: p.user_id,
        username: p.profile?.username || p.username || "User",
        avatarUrl: p.profile?.avatar_url,
        coins: participantContributions?.[p.user_id] || 0,
      }))
      .sort((a, b) => b.coins - a.coins);
  }, [battleParticipants, participantContributions]);

  const handleTapParticipant = (vm: MobileParticipantVM) => {
    if (isStaffProfile(profile)) {
      const streamId =
        vm.team === "blue" ? challengerStream?.id : opponentStream?.id;
      window.dispatchEvent(
        new CustomEvent("Mai Troll:open-user-actions", {
          detail: {
            userId: vm.userId,
            username: vm.username,
            streamId,
            battleId: battle?.id,
            role: vm.role,
            team: vm.team === "blue" ? "challenger" : "opponent",
            source: "battle_box",
          },
        })
      );
      return;
    }

    if (vm.userId === effectiveUserId) {
      if (vm.role === 'host') {
        onOpenBroadcasterControls?.();
      } else {
        void onToggleCamera();
      }
      return;
    }

    // Open gifting for this participant (controller enforces broadcaster/self restrictions).
    const streamId = vm.team === "blue" ? challengerStream?.id : opponentStream?.id;
    if (streamId) handleGiftSelect(vm.userId, streamId);
  };

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-amber-400">
        <span className="animate-spin text-2xl">◌</span>
        <span className="text-sm font-bold">Entering Battle Arena…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-red-400">
        <span className="text-6xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold text-white">Battle Error</h2>
        <span className="font-medium">{error}</span>
        <button
          onClick={handleBack}
          className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
        >
          Return Home
        </button>
      </div>
    );
  }

  const showMatchOverlay = preBattleCountdown !== null && preBattleCountdown > 0;

  // Winner determined from authoritative point totals (never crowns).
  let statusLabel = "";
  let statusTone: "default" | "sudden" | "blue" | "red" | "ended" = "default";
  if (battleStatus === "starting" || battleStatus === "ready") {
    statusLabel = "Battle Starting";
  } else if (isSuddenDeath && battleStatus === "active") {
    statusLabel = remainingTime <= 10 ? "Sudden Death" : "Sudden Death In 10s";
    statusTone = "sudden";
  } else if (battleStatus === "ended") {
    if (bluePoints > redPoints) {
      statusLabel = "Team Blue Wins";
      statusTone = "blue";
    } else if (redPoints > bluePoints) {
      statusLabel = "Team Red Wins";
      statusTone = "red";
    } else {
      statusLabel = "Battle Ended";
      statusTone = "ended";
    }
  } else if (showResults) {
    statusLabel = "Returning To Broadcast";
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-black text-white">
      {showMatchOverlay && (
        <MatchFoundOverlay
          challengerUserId={challengerStream.user_id}
          opponentUserId={opponentStream.user_id}
          challengerStateCode={challengerStream.state_battle_state_code || null}
          opponentStateCode={opponentStream.state_battle_state_code || null}
          countdown={preBattleCountdown}
          isBroadcaster={isBroadcaster}
        />
      )}
      <TrollTimeBanner
        active={trollTime.active}
        multiplier={trollTime.multiplier}
        endsAt={trollTime.endsAt}
        eventId={trollTime.eventId}
      />
      <MobileBattleHeader
        viewerCount={viewerCount}
        viewers={viewers}
        onBack={handleBack}
        onOverflow={() => setDrawerOpen(true)}
      />

      <div className="flex w-full flex-none flex-col gap-3 overflow-y-auto p-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <MobileBattleScore
          bluePoints={bluePoints}
          redPoints={redPoints}
          timeLeft={remainingTime}
          isSuddenDeath={isSuddenDeath}
          battleStatus={battleStatus}
        />

        {/* Team Blue (left) | Team Red (right) */}
        <div className="flex w-full flex-none items-stretch gap-2">
          {/* Team Blue — left */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-300">Team Blue</span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-blue-400/80">
                <Coins size={11} className="text-yellow-400" />
                {bluePoints.toLocaleString()} Points
              </span>
            </div>
            <MobileBattleTeamRow team="blue" participants={blueVMs} onTapParticipant={handleTapParticipant} />
          </div>

          {/* Team Red — right */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-300">Team Red</span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-red-400/80">
                <Coins size={11} className="text-yellow-400" />
                {redPoints.toLocaleString()} Points
              </span>
            </div>
            <MobileBattleTeamRow team="red" participants={redVMs} onTapParticipant={handleTapParticipant} />
          </div>
        </div>

        {statusLabel && <MobileBattleStatus label={statusLabel} tone={statusTone} />}

        <MobileBattleFloatingChat
          battleId={battle.id}
          challengerStream={{ id: challengerStream.id, title: challengerStream.title, user_id: challengerStream.user_id }}
          opponentStream={{ id: opponentStream.id, title: opponentStream.title, user_id: opponentStream.user_id }}
          currentStreamId={currentStreamId}
          currentUserId={effectiveUserId}
          participantRole={battleView.participantInfo?.role}
          broadcasterName={challengerStream.title || "Battle"}
        />
      </div>

      <MobileBattleFooter
        avatarUrl={profile?.avatar_url}
        title={challengerStream.title || "Battle"}
        viewerCount={viewerCount}
        onFollow={followBroadcaster}
        onShare={() => setShareSheetOpen(true)}
      />

      {/* Gift quick popup (reuses the shared gifting flow) */}
      <AnimatePresence>
        {showMobileGiftTray && giftRecipientId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
            onClick={() => {
              setShowMobileGiftTray(false);
              setGiftRecipientId(null);
              setGiftStreamId(null);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-zinc-900 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Quick Gift</h3>
                <button
                  onClick={() => {
                    setShowMobileGiftTray(false);
                    setGiftRecipientId(null);
                    setGiftStreamId(null);
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <QuickGiftRow
                recipientId={giftRecipientId}
                streamId={battleView.giftStreamId || currentStreamId}
                battleId={battle.id}
                onClose={() => {
                  setShowMobileGiftTray(false);
                  setGiftRecipientId(null);
                  setGiftStreamId(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share & Invite sheet */}
      <AnimatePresence>
        {shareSheetOpen && (
          <MobileBattleShareSheet
            streamId={challengerStream?.id}
            title={challengerStream?.title || "Battle"}
            currentUserId={effectiveUserId}
            onClose={() => setShareSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Active Battles drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-zinc-900 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Active Battles</h3>
                <button onClick={() => setDrawerOpen(false)} className="text-zinc-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              {isBroadcaster && battleStatus === "active" && (
                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={() => {
                    setDrawerOpen(false);
                    void handleLeaveBattle();
                  }}
                  className="mb-3 w-full rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-left text-sm font-bold text-red-200 disabled:opacity-50"
                >
                  {leaveLoading ? "Forfeiting…" : "Forfeit Battle"}
                </button>
              )}
              <div className="flex flex-col gap-2">
                {(activeBattles as ActiveBattle[]).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setDrawerOpen(false);
                      handleSelectBattle(b);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-left active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-white">
                        {b.challenger?.title || "Blue"} <span className="text-white/40">vs</span> {b.opponent?.title || "Red"}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/50">
                        <span className="text-blue-300">{b.score_challenger ?? 0} pts</span>
                        <span className="text-red-300">{b.score_opponent ?? 0} pts</span>
                        <span>· {((b.challenger?.viewer_count || 0) + (b.opponent?.viewer_count || 0))} watching</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-500/80 px-2 py-1 text-[9px] font-black uppercase text-white">Live</span>
                  </button>
                ))}
                {(activeBattles as ActiveBattle[]).length === 0 && (
                  <div className="py-6 text-center text-xs text-white/40">No other battles live</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(showRematchOption && participantInfo?.role === "host" || showResults && battleStatus === "ended") && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center gap-2 px-4">
          {showRematchOption && participantInfo?.role === "host" && (
            <button
              onClick={handleRematch}
              className="rounded-full bg-fuchsia-600 px-5 py-2 font-bold text-white shadow-lg active:scale-95 inline-flex items-center gap-1.5"
            >
              Rematch
            </button>
          )}
          {showResults && battleStatus === "ended" && (
            <button
              onClick={handleReturnToStream}
              className="rounded-full bg-amber-500 px-6 py-2 font-bold text-black shadow-lg active:scale-95 inline-flex items-center gap-1.5"
            >
              <LogOut size={16} />
              Return Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
