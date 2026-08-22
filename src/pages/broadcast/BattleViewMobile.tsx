import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, X, Swords, LogOut } from "lucide-react";
import { Track } from "livekit-client";

import { useBattleViewController } from "../../hooks/useBattleViewController";
import type { BattleViewController } from "../../hooks/useBattleViewController";
import { getTrackPublications, safeParseMetadata } from "../../components/broadcast/BattleArena";
import QuickGiftRow from "../../components/broadcast/QuickGiftRow";
import type { ActiveBattle } from "../../components/broadcast/battle/ActiveBattlesPanel";

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
    battle,
    bluePoints,
    redPoints,
    remainingTime,
    isSuddenDeath,
    battleStatus,
    viewerCount,
    activeBattles,
    battleParticipants,
    participantContributions,
    remoteUsers,
    userIdToLiveKitIdentity,
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
    followBroadcaster,
    shareBroadcast,
    loading,
    error,
    showResults,
    preBattleCountdown,
  } = battleView;

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
  // battles (the desktop Arena path works only because of its ULTRA-FALLBACK
  // that assigns any camera-capable remote to a host slot). We replicate that
  // fallback here so the mobile layout shows the same cameras.
  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const findRemoteByIdentity = (identity: string) => {
    const target = normalizeId(identity);
    return remoteUsers.find((u) => {
      const id = String(u.identity || "");
      const n = normalizeId(id);
      return id === identity || n === target || n.startsWith(target.substring(0, 8)) || target.startsWith(n.substring(0, 8));
    });
  };

  // Track cache so a brief unsubscribe/reconnect doesn't drop a box back to the
  // profile picture (mirrors BattleArena's lastKnownTrackRef behaviour).
  const trackCacheRef = React.useRef<Record<string, { videoTrack?: any; hasAudio: boolean }>>({});

  const resolveTrack = (userId: string) => {
    // Prefer the bare user id (the real battle-room identity). Fall back to the
    // broadcast-room mapping only if it happens to be a valid battle identity.
    const remote =
      findRemoteByIdentity(userId) ||
      findRemoteByIdentity(userIdToLiveKitIdentity?.[userId] || "");

    // ULTRA-FALLBACK (matches desktop Arena): if no remote matched by identity
    // yet this participant still needs a camera, grab any unmatched remote that
    // already has a subscribed video track.
    let resolvedRemote = remote;
    if (!resolvedRemote) {
      const usedIdentities = new Set(
        (battleParticipants as any[])
          .map((p) => {
            const r = findRemoteByIdentity(p.user_id);
            return r?.identity;
          })
          .filter(Boolean) as string[]
      );
      const anyRemoteWithVideo = remoteUsers.find((u) => {
        if (usedIdentities.has(u.identity)) return false;
        const pubs = getTrackPublications(u, "video");
        return pubs.some((p: any) => p.track);
      });
      resolvedRemote = anyRemoteWithVideo;
    }

    if (!resolvedRemote) {
      const cached = trackCacheRef.current[userId];
      if (cached?.videoTrack || cached?.hasAudio) return cached;
      return { videoTrack: undefined, hasAudio: false };
    }

    const videoPubs = getTrackPublications(resolvedRemote, "video");
    const audioPubs = getTrackPublications(resolvedRemote, "audio");

    const videoTrack =
      videoPubs.find((p: any) => p.isSubscribed && p.track && p.source === Track.Source.Camera)?.track ||
      videoPubs.find((p: any) => p.track && p.source === Track.Source.Camera)?.track ||
      videoPubs.find((p: any) => p.isSubscribed && p.track)?.track ||
      videoPubs.find((p: any) => p.track)?.track ||
      (isMobileDevice ? videoPubs.find((p: any) => p.track)?.track : undefined);

    const hasAudio = audioPubs.some((p: any) => p.isSubscribed && p.track) || audioPubs.some((p: any) => p.track);

    const result = { videoTrack, hasAudio };
    if (videoTrack || hasAudio) {
      trackCacheRef.current[userId] = result;
    }
    return result;
  };

  const { blueVMs, redVMs } = useMemo(() => {
    const blue: MobileParticipantVM[] = [];
    const red: MobileParticipantVM[] = [];
    for (const p of battleParticipants as any[]) {
      const team = p.team === "opponent" ? "red" : "blue";
      const { videoTrack, hasAudio } = resolveTrack(p.user_id);
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
      };
      if (team === "blue") blue.push(vm);
      else red.push(vm);
    }
    return { blueVMs: blue, redVMs: red };
  }, [battleParticipants, participantContributions, remoteUsers, userIdToLiveKitIdentity]);

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
        />
      )}
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

      {/* End-of-battle return prompt */}
      {showResults && battleStatus === "ended" && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <button
            onClick={handleReturnToStream}
            className="rounded-full bg-amber-500 px-6 py-2 font-bold text-black shadow-lg active:scale-95 inline-flex items-center gap-1.5"
          >
            <LogOut size={16} />
            Return Now
          </button>
        </div>
      )}
    </div>
  );
}
