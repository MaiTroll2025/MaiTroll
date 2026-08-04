import React from "react";
import { useNavigate } from "react-router-dom";

import { Loader2, Coins, Crown, Flame, Skull, X, RefreshCw, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useBattleViewController } from "../../hooks/useBattleViewController";
import type { BattleViewController } from "../../hooks/useBattleViewController";
import ActiveBattlesPanel from "../../components/broadcast/battle/ActiveBattlesPanel";
import BattleScoreboard from "../../components/broadcast/battle/BattleScoreboard";
import BattleBottomBar from "../../components/broadcast/battle/BattleBottomBar";
import BattleActivityFeed from "../../components/broadcast/battle/BattleActivityFeed";
import BattleChat from "../../components/broadcast/BattleChat";
import MuteHandler from "../../components/broadcast/MuteHandler";
import GiftTray from "../../components/broadcast/GiftTray";
import { MemoBattleArena, BattleConnectionStatus } from "../../components/broadcast/BattleArena";

/**
 * Desktop BattleView — visually and functionally identical to the original
 * desktop BattleView. It consumes the SHARED battle controller so the LiveKit
 * room, realtime state, gifts, timer, and cleanup logic are never re-initialized
 * when the layout switches between desktop and mobile (e.g. on viewport resize).
 */
export default function BattleViewDesktop({ battleView }: { battleView: BattleViewController }) {
  const {
    battle,
    challengerStream,
    opponentStream,
    participantInfo,
    participantSnapshots,
    activeBattles,
    activeBattlesLoading,
    battleId,
    timeLeft,
    isSuddenDeath,
    handleBack,
    handleGiftSelect,
    battleLocalAudioTrack,
    battleLocalVideoTrack,
    isCameraEnabled,
    isMicEnabled,
    remoteUsers,
    trackRevision,
    setTeamBoxCount,
    challengerCrownInfo,
    opponentCrownInfo,
    handleTrollOpponent,
    profile,
    userIdToLiveKitIdentity,
    effectiveUserId,
    isBroadcaster,
    isRandomBattle,
    giftRecipientId,
    isMobileViewport,
    giftStreamId,
    currentStreamId,
    showResults,
    showRematchOption,
    handleRematch,
    handleReturnToStream,
    handleLeaveBattle,
    leaveLoading,
    showMobileChat,
    setShowMobileChat,
    handleNextBattle,
    showMobileGiftTray,
    setShowMobileGiftTray,
    setGiftRecipientId,
    setGiftStreamId,
    connectionStatus,
    touchStartRef,
    loading,
    error,
    handleSelectBattle,
  } = battleView;

  const navigate = useNavigate();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-0 bg-black text-red-500 gap-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white">Battle Error</h2>
        <span className="font-medium">{error}</span>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-amber-500 gap-4"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Loader2 className="animate-spin" size={48} />
        <span className="font-black text-lg animate-pulse">Entering Battle Arena...</span>
        <span className="text-sm text-amber-400/60">Connecting to battle room</span>
      </div>
    );
  }

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white md:flex-row">
      {/* LEFT SIDEBAR — Active Battles + Viewer Status (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-purple-500/20 bg-zinc-950/80 lg:flex">
        <ActiveBattlesPanel
          battles={activeBattles}
          loading={activeBattlesLoading}
          currentBattleId={battleId}
          onSelectBattle={handleSelectBattle}
          challengerName={challengerStream?.title}
          opponentName={opponentStream?.title}
          currentRole={participantInfo?.role}
          viewerCount={participantSnapshots?.length || 0}
        />
        <div className="border-t border-white/10 p-3">
          <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/50">Viewer Status</h3>
          <div className="space-y-1 text-[11px] text-white/70">
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-white/40">Watching</span>
              <span className="truncate text-right font-bold text-purple-200">{challengerStream?.title} vs {opponentStream?.title}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-white/40">Blue host</span>
              <span className="truncate text-right font-bold">{challengerStream?.title}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-white/40">Red host</span>
              <span className="truncate text-right font-bold">{opponentStream?.title}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-white/40">Your role</span>
              <span className="font-bold capitalize text-white/90">{participantInfo?.role || "viewer"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-white/40">Viewers</span>
              <span className="font-bold">{(participantSnapshots?.length || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER COLUMN — scoreboard / stage / bottom bar */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <BattleScoreboard
          challengerName={challengerStream?.title}
          opponentName={opponentStream?.title}
          challengerScore={battle?.score_challenger || 0}
          opponentScore={battle?.score_opponent || 0}
          timeLeft={timeLeft}
          isSuddenDeath={isSuddenDeath}
          battleStatus={battle?.status}
          onBack={handleBack}
        />

        <div className="pointer-events-none absolute right-2 top-16 z-30">
          <BattleConnectionStatus connectionStatus={connectionStatus} />
        </div>

        <div
          className="relative min-h-0 flex-1"
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const s = touchStartRef.current;
            touchStartRef.current = null;
            if (!s) return;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - s.x;
            const dy = t.clientY - s.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
              handleNextBattle(dx < 0 ? 1 : -1);
            }
          }}
        >
          <div className="relative flex h-full w-full items-start justify-center overflow-hidden">
            {/* Battle Arena */}
            <MemoBattleArena
              onGift={handleGiftSelect}
              battleId={battleId}
              localAudioTrack={battleLocalAudioTrack}
              localVideoTrack={battleLocalVideoTrack}
              localIsCameraEnabled={isCameraEnabled}
              localIsMicEnabled={isMicEnabled}
              remoteUsers={remoteUsers}
              trackRevision={trackRevision}
              challengerStreamId={challengerStream.id}
              opponentStreamId={opponentStream.id}
              challengerHostId={challengerStream.user_id}
              opponentHostId={opponentStream.user_id}
              challengerHostName={challengerStream.title}
              opponentHostName={opponentStream.title}
              challengerBoxCount={challengerStream.box_count || 1}
              opponentBoxCount={opponentStream.box_count || 1}
              onChangeBoxCount={setTeamBoxCount}
              challengerScore={battle?.score_challenger || 0}
              opponentScore={battle?.score_opponent || 0}
              challengerCrownInfo={challengerCrownInfo}
              opponentCrownInfo={opponentCrownInfo}
              isSuddenDeath={isSuddenDeath}
              onTrollOpponent={handleTrollOpponent}
              canTroll={isSuddenDeath && participantInfo?.role === "host"}
              currentUserTeam={participantInfo?.team}
              userIdToLiveKitIdentity={userIdToLiveKitIdentity}
              currentUserProfile={profile}
              onOpenStaffActions={(participant) => {
                const streamId =
                  participant.sourceStreamId ||
                  (participant.team === "challenger" ? challengerStream.id : opponentStream.id);
                window.dispatchEvent(
                  new CustomEvent("Mai Troll:open-user-actions", {
                    detail: {
                      userId: participant.identity,
                      username: participant.name,
                      streamId,
                      battleId,
                      role: participant.role,
                      team: participant.team,
                      source: "battle_box",
                    },
                  })
                );
              }}
              currentUserId={effectiveUserId}
              isBroadcaster={isBroadcaster}
              timeLeft={timeLeft}
              battleStatus={battle?.status}
            />
          </div>
        </div>

        {/* Battle status banner between grid and gifting */}
        {battle?.status === "starting" || battle?.status === "ready" ? (
          <div className="flex items-center justify-center gap-2 bg-amber-500/15 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">Battle starting…</div>
        ) : battle?.status === "active" && isSuddenDeath ? (
          <div className="flex items-center justify-center gap-2 bg-red-500/20 py-1 text-xs font-bold uppercase tracking-wider text-red-200 animate-pulse">Sudden Death</div>
        ) : battle?.status === "paused" ? (
          <div className="flex items-center justify-center gap-2 bg-yellow-500/15 py-1 text-xs font-bold uppercase tracking-wider text-yellow-200">Paused</div>
        ) : null}

        {/* Bottom action bar (desktop; mobile uses the existing mobile bar) */}
        <div className="hidden md:block">
          <BattleBottomBar
            challengerName={challengerStream?.title}
            opponentName={opponentStream?.title}
            isLive={battle?.status === "active" || battle?.status === "starting" || battle?.status === "ready"}
            viewerCount={participantSnapshots?.length || 0}
            onGift={() => {
              if (!isBroadcaster && challengerStream?.user_id) handleGiftSelect(challengerStream.user_id, challengerStream.id);
            }}
            onNext={() => handleNextBattle(1)}
            hasNext={activeBattles.length > 0}
          />
        </div>

        {/* Progress Bar */}
        <div className="flex h-1 w-full">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: `${challengerPercent}%` }} />
          <div className="h-full bg-gradient-to-l from-red-500 to-red-600 transition-all duration-500" style={{ width: `${opponentPercent}%` }} />
        </div>

        <MuteHandler streamId={challengerStream.id} />

        {/* Host Controls - only show for non-random battles */}
        {!isRandomBattle && participantInfo?.role === "host" && (battle?.status === "active" || battle?.status === "starting") && (
          <div className="absolute left-3 top-14 z-40 flex flex-col gap-2 md:left-4">
            <button
              onClick={handleLeaveBattle}
              disabled={leaveLoading}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white border border-red-500/40 transition disabled:opacity-60 shadow-lg inline-flex items-center gap-1.5"
            >
              <Skull size={14} />
              {leaveLoading ? "Leaving..." : "Forfeit"}
            </button>
          </div>
        )}

        {/* Battle End Overlay */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-gradient-to-b from-zinc-900 to-black border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl text-center max-w-md shadow-[0_0_60px_rgba(245,158,11,0.3)]"
              >
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-2 uppercase tracking-tighter italic">
                  Battle Ended
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent w-full my-4" />

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {challengerCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {challengerStream.title}
                    </span>
                    <span className="text-purple-400 font-bold text-lg">{battle.score_challenger.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {opponentCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {opponentStream.title}
                    </span>
                    <span className="text-emerald-400 font-bold text-lg">{battle.score_opponent.toLocaleString()}</span>
                  </div>
                </div>

                {battle.status === "ended" ? (
                  <div className="mb-6">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Winner</div>
                    {battle.winner_id === challengerStream.user_id || battle.winner_stream_id === challengerStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === "challenger" ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_challenger || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {challengerStream.title}
                          </div>
                        )}
                      </div>
                    ) : battle.winner_id === opponentStream.user_id || battle.winner_stream_id === opponentStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === "opponent" ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_opponent || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {opponentStream.title}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-2xl font-bold text-zinc-400">It&apos;s a Draw!</div>
                    )}
                    {(battle.winner_id === challengerStream.user_id && challengerCrownInfo.hasStreak) ||
                      (battle.winner_id === opponentStream.user_id && opponentCrownInfo.hasStreak) ? (
                      <div className="mt-2 text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Flame size={16} className="fill-amber-400" />
                        WIN STREAK CONTINUES!
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mb-6 text-xl font-bold text-zinc-400 italic animate-pulse">Calculating Results...</div>
                )}

                <div className="text-sm text-zinc-500">Choose rematch or return to stream.</div>

                {showRematchOption && participantInfo?.role === "host" && (
                  <button
                    onClick={handleRematch}
                    className="mt-4 mr-2 px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full transition inline-flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    Rematch
                  </button>
                )}

                <button
                  onClick={handleReturnToStream}
                  className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full transition inline-flex items-center gap-1.5"
                >
                  <LogOut size={14} />
                  Return Now
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Tray */}
        {giftRecipientId && !isMobileViewport && (
          <GiftTray
            key={giftRecipientId}
            onClose={() => {
              setGiftRecipientId(null);
              setGiftStreamId(null);
            }}
            recipientId={giftRecipientId}
            streamId={giftStreamId || currentStreamId}
            battleId={battleId}
          />
        )}

        {/* Mobile Bottom Action Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center justify-around px-4 py-3">
            {/* Chat Button */}
            <button
              onClick={() => setShowMobileChat(true)}
              className="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors"
            >
              <div className="relative">
                💬
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <span className="text-xs font-medium">Chat</span>
            </button>

            {/* Troll Button (only for hosts during sudden death) */}
            {participantInfo?.role === "host" && isSuddenDeath && (
              <button
                onClick={() => {
                  const targetStreamId = participantInfo.team === "challenger" ? opponentStream?.id : challengerStream?.id;
                  if (targetStreamId) {
                    handleTrollOpponent(targetStreamId);
                  }
                }}
                className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
              >
                <Skull size={20} />
                <span className="text-xs font-medium">Troll</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Gift Tray Overlay - only shown when a broadcaster box is clicked */}
        <AnimatePresence>
          {showMobileGiftTray && giftRecipientId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
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
                className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Send Gift</h3>
                  <button
                    onClick={() => {
                      setShowMobileGiftTray(false);
                      setGiftRecipientId(null);
                      setGiftStreamId(null);
                    }}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <GiftTray
                  key={giftRecipientId}
                  onClose={() => {
                    setGiftRecipientId(null);
                    setGiftStreamId(null);
                    setShowMobileGiftTray(false);
                  }}
                  recipientId={giftRecipientId}
                  streamId={giftStreamId || currentStreamId}
                  battleId={battleId}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Chat Overlay */}
        <AnimatePresence>
          {showMobileChat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => setShowMobileChat(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                  <h3 className="text-lg font-bold text-white">Battle Chat</h3>
                  <button onClick={() => setShowMobileChat(false)} className="text-zinc-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <div className="h-[60vh]">
                  <BattleChat
                    battleId={battleId}
                    challengerStream={{ id: challengerStream.id, title: challengerStream.title, user_id: challengerStream.user_id }}
                    opponentStream={{ id: opponentStream.id, title: opponentStream.title, user_id: opponentStream.user_id }}
                    currentStreamId={currentStreamId}
                    currentUserId={effectiveUserId}
                    participantRole={participantInfo?.role}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* RIGHT CHAT PANEL — system activity + battle chat (desktop) */}
      <aside className="hidden w-80 shrink-0 flex-col border-l border-purple-500/20 bg-zinc-950/80 xl:flex">
        <BattleActivityFeed
          battleId={battleId}
          challengerName={challengerStream?.title}
          opponentName={opponentStream?.title}
        />
        <div className="min-h-0 flex-1">
          <BattleChat
            battleId={battleId}
            challengerStream={{ id: challengerStream.id, title: challengerStream.title, user_id: challengerStream.user_id }}
            opponentStream={{ id: opponentStream.id, title: opponentStream.title, user_id: opponentStream.user_id }}
            currentStreamId={currentStreamId}
            currentUserId={effectiveUserId}
            participantRole={participantInfo?.role}
          />
        </div>
      </aside>
    </div>
  );
}
