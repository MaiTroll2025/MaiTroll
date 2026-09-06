import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  MoreHorizontal,
  Radio,
  Gift,
  Sparkles,
  Skull,
  Bell,
  Mail,
  Users,
} from 'lucide-react';
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import GiftTray from './GiftTray';
import { GiftItem } from '../../lib/hooks/useGiftSystem';
import BroadcastOfficerModal from './BroadcastOfficerModal';
import { MaiTrollBroadcastTheme, bottomBarShell, bottomBarAmbient, hostActionButtonCenter } from '../../styles/broadcastTheme'

/**
 * Generic "icon grid" button used in host action bottom bar.
 */
function HostActionButton({
  active,
  onClick,
  icon: Icon,
  label,
  variant = 'default',
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}) {
  const theme = MaiTrollBroadcastTheme
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[70px] min-w-[110px] flex-col items-center justify-center gap-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'default'
          ? theme.glassButton
          : theme.danger,
      )}
    >
      <Icon className={cn('h-6 w-6', variant === 'danger' && 'h-7 w-7')} />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

/** Message summary card — left card in the bottom bar */
export function MessageSummaryCard({
  unreadCount,
  onOpen,
}: {
  unreadCount: number;
  onOpen: () => void;
}) {
  const theme = MaiTrollBroadcastTheme
  return (
    <div className={cn('flex h-[86px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-5 shadow-[0_0_18px_rgba(34,211,238,0.15)] backdrop-blur-2xl', theme.panel)}>
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300">
          <Mail className="h-7 w-7" />
        </div>
        <div>
          <p className="text-base font-black text-white">Messages</p>
          <p className="mt-1 text-sm font-black text-emerald-400">
            {unreadCount} unread
          </p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className={cn('rounded-xl px-5 py-2.5 text-sm font-bold text-white', theme.glassButton)}
      >
        Open
      </button>
    </div>
  );
}

/**
 * BroadcastBottomBar
 *
 * Three cells:
 *   StagePassSummaryCard  (left, 290px)
 *   HostActionButtons     (center, fills remaining)
 *   OpenStagePassCard     (right, 360px)
 *
 * Handlers wired from BroadcastPage.tsx business logic.
 */
export interface BroadcastBottomBarProps {
  unreadMessageCount: number;
  isMicOn: boolean;
  isCamOn: boolean;
  isLive: boolean;
  liveViewerCount?: number;
  liveTimer?: string;
  isGiftTrayOpen: boolean;
  isOfficerModalOpen: boolean;
  onToggleMic?: () => void;
  onToggleCam?: () => void;
  onGift?: () => void;
  onGiftRecipient?: (userId: string) => void;
  onShare?: () => void;
  onOpenMoreMenu?: () => void;
  onEndStream: () => void;
  onOpenMessage: () => void;
  onManageMessage?: () => void;
  onOpenCoinStore?: () => void;
   onTroll?: () => void;
   isHost?: boolean;
   onInviteFollowers?: () => void;
   onOpenSeats?: () => void;
   currentViewerSeatCount?: number;
   seatCount?: number;
   isEnding?: boolean;
}

export default function BroadcastBottomBar({
  unreadMessageCount,
  isMicOn,
  isCamOn,
  isLive,
  liveViewerCount = 0,
  liveTimer = '00:00',
  isGiftTrayOpen,
  isOfficerModalOpen,
  onToggleMic,
  onToggleCam,
  onGift,
  onShare,
  onOpenMoreMenu,
  onEndStream,
  onOpenMessage,
  onManageMessage,
  onOpenCoinStore,
onTroll,
    isHost = false,
    onInviteFollowers,
    onOpenSeats,
    currentViewerSeatCount = 0,
    seatCount = 0,
    isEnding = false,
  }: BroadcastBottomBarProps) {
  const theme = MaiTrollBroadcastTheme
  return (
    <div className={cn(bottomBarShell, 'relative overflow-hidden', 'bg-slate-950/95')}>
      {/* Ambient glow strip */}
      <div className={bottomBarAmbient} />

      <div className="grid gap-4" style={{ gridTemplateColumns: '290px 1fr' }}>
        {/* Left: Messages summary */}
        <MessageSummaryCard
          unreadCount={unreadMessageCount}
          onOpen={onOpenMessage}
        />

        {/* Center: host action buttons + live info */}
        <div className={cn(hostActionButtonCenter, 'relative flex flex-col items-center justify-center gap-1')}>
          {/* Live info row */}
          <div className="flex items-center justify-center gap-4 mb-1">
            {isLive && (
              <span className="flex items-center gap-2 text-xs font-black text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-bold text-white/80">
              <span className="inline-block h-4 w-4 rounded-full bg-gradient-to-br from-purple-400 via-cyan-400 to-pink-400 shadow-md mr-1" />
              {liveViewerCount >= 1000 ? `${(liveViewerCount / 1000).toFixed(1)}K` : liveViewerCount}
            </span>
          </div>
          {/* Host action buttons row */}
           <div className="flex items-center gap-2">
             <HostActionButton
               active={isMicOn}
               onClick={onToggleMic}
               icon={isMicOn ? Mic : MicOff}
               label={isMicOn ? 'Mute' : 'Unmute'}
             />
              {isHost && onOpenSeats && (
                <HostActionButton
                  active={false}
                  onClick={undefined}
                  disabled
                  icon={Users}
                  label={`Seats${seatCount > 0 ? ` ${currentViewerSeatCount}/${seatCount}` : ''}`}
                />
              )}
             <HostActionButton
              active={isCamOn}
              onClick={onToggleCam}
              icon={isCamOn ? Video : VideoOff}
              label={isCamOn ? 'Turn Off' : 'Camera'}
            />
            <HostActionButton
              active={Boolean(isGiftTrayOpen)}
              onClick={onGift}
              icon={Gift}
              label="Gifts"
            />
            <HostActionButton
              active={false}
              onClick={onShare}
              icon={Share2}
              label="Share"
            />
            {isHost && onInviteFollowers && (
              <HostActionButton
                active={false}
                onClick={onInviteFollowers}
                icon={Bell}
                label="Invite"
              />
            )}
            <HostActionButton
              active={false}
              onClick={onOpenMoreMenu}
              icon={MoreHorizontal}
              label="More"
            />
            {!isHost && (
              <HostActionButton
                active={false}
                onClick={onTroll}
                icon={Skull}
                label="Troll"
                variant="danger"
                disabled={!onTroll}
              />
            )}
            {/* End Stream — red variant */}
            <button
              onClick={onEndStream}
              disabled={isEnding}
              className={cn(
                'flex h-[70px] min-w-[150px] flex-col items-center justify-center gap-2 rounded-xl transition-all',
                theme.danger,
                isEnding && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Radio className="h-7 w-7" />
              <span className="text-sm font-black">{isEnding ? 'Ending...' : 'End Stream'}</span>
            </button>
          </div>
        </div>

        {/* Right: removed duplicate message button — use the Open button in Messages summary */}
      </div>
    </div>
  );
}

/**
 * BroadcastFooterStrip
 *
 * Bottom-of-page one-line status bar.
 */
export function BroadcastFooterStrip({
  viewerCount,
  connectionQuality = 'Excellent',
  onLicenseClick,
}: {
  viewerCount: number;
  connectionQuality?: string;
  onLicenseClick?: () => void;
}) {
  return (
    <footer className={MaiTrollBroadcastTheme.footerStrip}>
      <span className="flex items-center gap-2 text-slate-400">
        <Sparkles className="h-4 w-4 text-purple-400" />
        Stream protected
      </span>
      <span className="text-white/15">•</span>
      <span>
        <button
          onClick={onLicenseClick}
          className="hover:text-slate-200 transition-colors"
          title="Your stream license"
        >
          {viewerCount >= 1000 ? `${(viewerCount / 1000).toFixed(1)}K` : viewerCount} watching
        </button>
      </span>
      <span className="text-white/15">•</span>
      <span>Mai Troll Guidelines</span>
      <span className="text-white/15">•</span>
      <span className="text-emerald-400">{connectionQuality} Connection</span>
    </footer>
  );
}
