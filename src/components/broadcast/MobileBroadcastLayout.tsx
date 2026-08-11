import React, { useState, useCallback, useEffect } from 'react';
import { Stream, ChatMessage } from '../../types/broadcast';
import { useMobileLayout, useSafeAreaHeight } from '../../hooks/useMobileLayout';
import { cn } from '../../lib/utils';
import { SeatSession } from '../../hooks/useStreamSeats';
import TopLiveBar from './TopLiveBar';
import ChatBottomSheet from './ChatBottomSheet';
import { GiftSystemProvider } from '../../lib/hooks/useGiftSystem';
import GiftTray from './GiftTray';
import ParticipantStrip from './ParticipantStrip';
import BroadcastControls from './BroadcastControls';
import MoreControlsDrawer from './MoreControlsDrawer';
import UserActionModal from './UserActionModal';
import { MessageSquare, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MobileBroadcastLayoutProps {
  stream: Stream;
  isHost: boolean;
  isModerator: boolean;
  messages: ChatMessage[];
  seats: Record<number, SeatSession>;
  children: React.ReactNode;
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onLeave: () => void;
  onJoinSeat: (index: number) => void;
  onGift?: (userId: string) => void;
  hostGlowingColor?: string;
  onShare?: () => void;
  isMicEnabled?: boolean;
  isCamEnabled?: boolean;
  localTracks?: any;
  onStartBattle?: () => void;
  isBattleActive?: boolean;
  isLive?: boolean;
  onInviteFollowers?: () => void;
}

export default function MobileBroadcastLayout({
  stream,
  isHost,
  isModerator,
  messages,
  seats,
  children,
  onSendMessage,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onLeave,
  onJoinSeat,
  onGift,
  hostGlowingColor,
  onShare,
  isMicEnabled = true,
  isCamEnabled = true,
  localTracks,
  onStartBattle,
  isBattleActive,
  isLive,
  onInviteFollowers,
}: MobileBroadcastLayoutProps) {
  const { isMobile } = useMobileLayout();
  const { headerHeight, dockHeight, safeArea } = useSafeAreaHeight();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Removed local isMuted/isCameraOff state to rely on props
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedSeatUser, setSelectedSeatUser] = useState<{
    userId: string;
    username?: string;
    role?: string;
    createdAt?: string;
  } | null>(null);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      setUnreadMessages((prev) => Math.min(prev + 1, 9));
    }
  }, [messages.length, isChatOpen]);

  // Clear unread when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadMessages(0);
    }
  }, [isChatOpen]);

  const handleToggleMic = useCallback(() => {
    onToggleMic();
  }, [onToggleMic]);

  const handleToggleCamera = useCallback(() => {
    onToggleCamera();
  }, [onToggleCamera]);

  const handleLeave = useCallback(() => {
    if (confirm(isHost ? 'End this broadcast?' : 'Leave this broadcast?')) {
      onLeave();
    }
  }, [isHost, onLeave]);

  const handleGift = useCallback(() => {
    setIsGiftOpen(true);
  }, []);

  const handleSeatUserClick = useCallback((seat: SeatSession) => {
    if (!seat.user_id) return;

    setSelectedSeatUser({
      userId: seat.user_id,
      username: seat.user_profile?.username,
      role: seat.user_profile?.role || seat.user_profile?.troll_role,
      createdAt: seat.user_profile?.created_at,
    });
  }, []);

  const handleCloseSeatUser = useCallback(() => {
    setSelectedSeatUser(null);
  }, []);

  const handleGiftSelectedUser = useCallback(() => {
    if (!selectedSeatUser) return;
    onGift?.(selectedSeatUser.userId);
    setSelectedSeatUser(null);
  }, [onGift, selectedSeatUser]);

  const handleInviteFollowers = useCallback(async () => {
    if (!onInviteFollowers) return;
    try {
      const { data: user } = await supabase.auth.getUser();
      const inviterId = user.user?.id;
      if (!inviterId) return;
      
      const { data, error } = await supabase.rpc('invite_followers_to_broadcast', {
        p_stream_id: stream.id,
        p_inviter_id: inviterId
      });
      if (error) throw error;
    } catch (e: any) {
      console.error('Failed to invite followers:', e);
    }
  }, [stream.id, onInviteFollowers]);

  // Calculate stage height based on viewport
  const stageHeight = `calc(100dvh - ${headerHeight}px - ${isMinimized ? '60' : dockHeight}px)`;

  if (!isMobile) {
    // Desktop layout - return original structure
    return (
      <div className="relative h-dvh w-full bg-black overflow-hidden">
        {children}
        <TopLiveBar
          stream={stream}
          hostName={isHost ? 'You' : 'Host'}
          hostGlowingColor={hostGlowingColor}
          onClose={onLeave}
          className="z-20"
        />
        <BroadcastControls
          stream={stream}
          isHost={isHost}
          isModerator={isModerator}
          isOnStage={isHost}
          chatOpen={isChatOpen}
          toggleChat={() => setIsChatOpen(!isChatOpen)}
          onGiftHost={handleGift}
          onLeave={handleLeave}
          onShare={onShare}
          handleLike={() => {}}
          toggleBattleMode={() => {}}
          localTracks={localTracks}
          toggleCamera={handleToggleCamera}
          toggleMicrophone={handleToggleMic}
          isMicOn={isMicEnabled}
          isCamOn={isCamEnabled}
          isLive={isLive}
          onStartBattle={onStartBattle}
          isBattleActive={isBattleActive}
          onInviteFollowers={handleInviteFollowers}
        />
        {isChatOpen && (
          <ChatBottomSheet
            messages={messages}
            onSendMessage={onSendMessage}
          />
        )}
        <MoreControlsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          isMuted={!isMicEnabled}
          isCameraOff={!isCamEnabled}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onFlipCamera={onFlipCamera}
          onLeave={handleLeave}
          isHost={isHost}
        />
        {isGiftOpen && (
          <GiftTray
            recipientId={stream.user_id}
            streamId={stream.id}
            onClose={() => setIsGiftOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className="relative h-dvh w-full bg-black overflow-hidden flex flex-col font-sans text-white"
      style={{ 
        paddingBottom: safeArea.bottom,
        minHeight: '100dvh'
      }}
    >
      {/* 1. Top HUD - Compact Sticky Header */}
      <div 
        className="absolute top-0 left-0 right-0 z-50"
        style={{ 
          paddingTop: safeArea.top,
        }}
      >
        <TopLiveBar
          stream={stream}
          hostName={isHost ? 'You' : 'Host'}
          hostGlowingColor={hostGlowingColor}
          onClose={handleLeave}
          className=""
        />
      </div>

      {/* 2. Stage Area - Responsive Grid Layout */}
      <div 
        className="relative z-10 w-full flex flex-col sm:flex-row gap-1.5 px-1 pt-1"
        style={{ 
          height: stageHeight,
          marginTop: headerHeight,
          overflow: 'hidden'
        }}
      >
        {/* Main Video - Responsive */}
        <div className="relative flex-1 min-w-0 min-h-0 rounded-lg overflow-hidden bg-black/40">
          {/* Video Layer */}
          <div className="absolute inset-0">
            {children}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40" />

          {/* Participant Strip (Guests) */}
          <div className="absolute top-2 left-0 right-0 z-20">
            <ParticipantStrip
              seats={seats}
              onJoinRequest={onJoinSeat}
              onUserClick={handleSeatUserClick}
            />
          </div>
        </div>

        {/* Right Panel - Chat (Hidden on Small Mobile) */}
        {isChatOpen && (
          <div className="hidden sm:flex flex-col w-64 min-h-0 bg-zinc-900/80 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
            <ChatBottomSheet
              messages={messages}
              onSendMessage={onSendMessage}
              className="h-full"
            />
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute top-2 right-2 z-10 w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white/40 hover:text-white text-[10px]"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 3. Chat - Full Modal on Small Screens */}
      {isChatOpen && (
        <div className="sm:hidden absolute inset-0 z-40 bg-black/60 flex flex-col" onClick={() => setIsChatOpen(false)}>
          <div 
            className="flex-1 bg-zinc-900 overflow-hidden flex flex-col min-h-0 mt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-sm font-bold">Chat</span>
              <button onClick={() => setIsChatOpen(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatBottomSheet
                messages={messages}
                onSendMessage={onSendMessage}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {selectedSeatUser && (
        <UserActionModal
          streamId={stream.id}
          userId={selectedSeatUser.userId}
          username={selectedSeatUser.username}
          role={selectedSeatUser.role}
          createdAt={selectedSeatUser.createdAt}
          isHost={isHost}
          isModerator={isModerator}
          onClose={handleCloseSeatUser}
          onGift={handleGiftSelectedUser}
        />
      )}

      {/* 4. Bottom Dock - Compact Controls */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 z-30",
          isMinimized ? "pb-safe-bottom" : ""
        )}
        style={{ paddingBottom: safeArea.bottom }}
      >
        {isMinimized ? (
          // Minimized state - compact pill button
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full py-2 mx-1 mb-1 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center gap-2"
          >
            <span className="text-[10px] text-white/60">Controls</span>
          </button>
        ) : (
          // Full controls - more compact
          <div className="bg-gradient-to-t from-black/98 via-black/90 to-transparent pt-2 pb-1 px-1">
            {/* Gift Tray Modal */}
            {isGiftOpen && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setIsGiftOpen(false)}>
                <div className="w-full" onClick={(e) => e.stopPropagation()}>
                  <GiftSystemProvider streamId={stream.id} defaultReceiverId={stream.user_id}>
                    <GiftTray
                      recipientId={stream.user_id}
                      streamId={stream.id}
                      onClose={() => setIsGiftOpen(false)}
                    />
                  </GiftSystemProvider>
                </div>
              </div>
            )}

            {/* Compact Control Grid */}
            <div className="flex items-center justify-between gap-2 px-2">
              {/* Left: Chat Toggle - Compact */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="relative w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors flex-shrink-0"
                title="Chat"
              >
                <MessageSquare size={16} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>

              {/* Center: Camera & Mic - Vertical Column */}
              <div className="flex flex-col items-center justify-center gap-1">
                <button
                  onClick={handleToggleCamera}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all text-sm font-bold",
                    !isCamEnabled 
                      ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                      : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                  )}
                  title={isCamEnabled ? 'Camera Off' : 'Camera On'}
                >
                  {!isCamEnabled ? '📷' : '📹'}
                </button>
                <button
                  onClick={handleToggleMic}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all text-sm font-bold",
                    !isMicEnabled 
                      ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                      : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                  )}
                  title={isMicEnabled ? 'Mute' : 'Unmute'}
                >
                  {!isMicEnabled ? '🔇' : '🎤'}
                </button>
              </div>

              {/* Right: Gift & Menu & Leave */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleGift}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors flex-shrink-0 text-sm font-bold"
                  title="Send Gift"
                >
                  🎁
                </button>

                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors flex-shrink-0 text-sm"
                  title="More Options"
                >
                  ⋯
                </button>

                {isHost && (
                  <button
                    onClick={handleLeave}
                    className="w-10 h-10 rounded-full bg-red-600/80 flex items-center justify-center text-white hover:bg-red-700 transition-colors flex-shrink-0 text-sm font-bold"
                    title="End Stream"
                  >
                    ⏹
                  </button>
                )}
              </div>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized(true)}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0 text-sm font-bold ml-auto"
                title="Minimize"
              >
                −
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. More Controls Drawer Overlay */}
      <MoreControlsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        isMuted={!isMicEnabled}
        isCameraOff={!isCamEnabled}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={onFlipCamera}
        onLeave={handleLeave}
        isHost={isHost}
      />
    </div>
  );
}
