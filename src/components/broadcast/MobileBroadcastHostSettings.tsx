import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Settings,
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Gift,
  Share2,
  Mail,
  Power,
  Sparkles,
  Megaphone,
  Users,
  ShieldCheck,
  Coins,
  UserPlus,
  Circle,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MobileBroadcastHostSettingsProps {
  // State
  isMicOn: boolean;
  isCamOn: boolean;
  isLive: boolean;
  hasRgbEffect: boolean;
  isChatLocked: boolean;
  unreadMessageCount: number;
  seatCount: number;

  // Actions
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onGift: () => void;
  onShare: () => void;
  onOpenMessage: () => void;
  onEndStream: () => void;
  onOpenCoinStore: () => void;
  onInviteFollowers: () => void;
  onToggleRGB?: () => void;
  onTextPopup?: () => void;
  onAssignOfficer?: () => void;
  onPayOfficers?: () => void;
  onToggleChatLock?: () => void;
  onUpdateSeatCount?: (count: number) => void;
}

// ─── Grid Item Definition ────────────────────────────────────────────────────

interface SettingsGridItem {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;       // tailwind text color class
  bgColor: string;     // tailwind bg color class
  borderColor: string; // tailwind border color class
  action: () => void;
  hasPopup?: boolean;  // if true, opens a sub-popup instead of direct action
}

// ─── Sub-Popup Component ─────────────────────────────────────────────────────

function SettingsSubPopup({
  title,
  icon: Icon,
  color,
  onClose,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Popup Card */}
      <div
        ref={popupRef}
        className={cn(
          'relative z-10 w-full max-w-[420px] mx-3 mb-4 sm:mb-0',
          'rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl',
          'shadow-[0_0_40px_rgba(34,211,238,0.20)]',
          'animate-in slide-in-from-bottom-4 fade-in duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('grid h-8 w-8 place-items-center rounded-lg', color)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-black text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MobileBroadcastHostSettings({
  isMicOn,
  isCamOn,
  isLive,
  hasRgbEffect,
  isChatLocked,
  unreadMessageCount,
  seatCount,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onGift,
  onShare,
  onOpenMessage,
  onEndStream,
  onOpenCoinStore,
  onInviteFollowers,
  onToggleRGB,
  onTextPopup,
  onAssignOfficer,
  onPayOfficers,
  onToggleChatLock,
  onUpdateSeatCount,
}: MobileBroadcastHostSettingsProps) {
  const [isGridOpen, setIsGridOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  // Lock body scroll when grid or popup is open
  useEffect(() => {
    if (isGridOpen || activePopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isGridOpen, activePopup]);

  const closeGrid = useCallback(() => setIsGridOpen(false), []);
  const closePopup = useCallback(() => setActivePopup(null), []);

  // ── Grid items ──────────────────────────────────────────────────────────

  const gridItems: SettingsGridItem[] = [
    {
      id: 'mic',
      label: isMicOn ? 'Mute' : 'Unmute',
      icon: isMicOn ? Mic : MicOff,
      color: isMicOn ? 'text-emerald-400' : 'text-red-400',
      bgColor: isMicOn ? 'bg-emerald-500/15' : 'bg-red-500/15',
      borderColor: isMicOn ? 'border-emerald-400/30' : 'border-red-400/30',
      action: onToggleMic,
    },
    {
      id: 'camera',
      label: isCamOn ? 'Cam Off' : 'Cam On',
      icon: isCamOn ? Video : VideoOff,
      color: isCamOn ? 'text-emerald-400' : 'text-red-400',
      bgColor: isCamOn ? 'bg-emerald-500/15' : 'bg-red-500/15',
      borderColor: isCamOn ? 'border-emerald-400/30' : 'border-red-400/30',
      action: () => setActivePopup('camera'),
      hasPopup: true,
    },
    {
      id: 'seats',
      label: 'Seats',
      icon: Users,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/15',
      borderColor: 'border-violet-400/30',
      action: () => setActivePopup('seats'),
      hasPopup: true,
    },
    {
      id: 'gift',
      label: 'Gift',
      icon: Gift,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/15',
      borderColor: 'border-pink-400/30',
      action: onGift,
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-400/30',
      action: onShare,
    },
    {
      id: 'message',
      label: 'Messages',
      icon: MessageSquare,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-400/30',
      action: () => setActivePopup('message'),
      hasPopup: true,
    },
    {
      id: 'invite',
      label: 'Invite',
      icon: UserPlus,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-400/30',
      action: onInviteFollowers,
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: Sparkles,
      color: hasRgbEffect ? 'text-emerald-400' : 'text-violet-400',
      bgColor: hasRgbEffect ? 'bg-emerald-500/15' : 'bg-violet-500/15',
      borderColor: hasRgbEffect ? 'border-emerald-400/30' : 'border-violet-400/30',
      action: () => setActivePopup('effects'),
      hasPopup: true,
    },
    {
      id: 'coins',
      label: 'Coins',
      icon: Coins,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/15',
      borderColor: 'border-yellow-400/30',
      action: onOpenCoinStore,
    },
    {
      id: 'officer',
      label: 'Officer',
      icon: ShieldCheck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/15',
      borderColor: 'border-blue-400/30',
      action: () => setActivePopup('officer'),
      hasPopup: true,
    },
    {
      id: 'announce',
      label: 'Announce',
      icon: Megaphone,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/15',
      borderColor: 'border-orange-400/30',
      action: () => setActivePopup('announce'),
      hasPopup: true,
    },
    {
      id: 'end',
      label: 'End Stream',
      icon: Power,
      color: 'text-red-400',
      bgColor: 'bg-red-500/15',
      borderColor: 'border-red-400/30',
      action: () => setActivePopup('end'),
      hasPopup: true,
    },
  ];

  const handleGridItemClick = useCallback(
    (item: SettingsGridItem) => {
      if (item.hasPopup) {
        item.action(); // opens the sub-popup
      } else {
        item.action(); // direct action
        closeGrid(); // close grid after direct action
      }
    },
    [closeGrid]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Settings Button - Fixed position on mobile */}
      <button
        onClick={() => setIsGridOpen(true)}
        className={cn(
          'relative z-50',
          'grid h-11 w-11 place-items-center rounded-full',
          'bg-white/10 backdrop-blur-md border border-white/15',
          'text-white/80 hover:text-white hover:bg-white/20 transition-all',
          'active:scale-95'
        )}
        aria-label="Settings"
      >
        <Settings className="h-5 w-5" />
        {/* Live indicator dot */}
        {isLive && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-slate-950 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        )}
      </button>

      {/* ── Grid Popup ──────────────────────────────────────────────────── */}
      {isGridOpen && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeGrid}
          />

          {/* Grid Card */}
          <div
            className={cn(
              'relative z-10 w-full max-w-[420px] mx-3 mb-4 sm:mb-0',
              'rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl',
              'shadow-[0_0_40px_rgba(34,211,238,0.20)]',
              'animate-in slide-in-from-bottom-4 fade-in duration-200'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Settings className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-white">Settings</h3>
              </div>
              <button
                type="button"
                onClick={closeGrid}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid */}
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {gridItems.map((item) => (
                 <button
                   key={item.id}
                   onClick={() => handleGridItemClick(item)}
                   className={cn(
                     'settings-grid-item flex flex-col items-center justify-center gap-1.5',
                     'rounded-xl border py-3 px-2 transition-all',
                     'active:scale-95',
                     item.bgColor,
                     item.borderColor
                   )}
                 >
                    <item.icon
                      className={cn('h-5 w-5', item.color)}
                    />
                    <span className="text-[10px] font-bold text-white/80 leading-tight text-center">
                      {item.label}
                    </span>
                     {/* Badge for message count */}
                     {item.id === 'message' && unreadMessageCount > 0 && (
                       <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[8px] font-black text-white">
                         {unreadMessageCount}
                       </span>
                     )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Popups ──────────────────────────────────────────────────── */}

      {/* Camera Popup */}
      {activePopup === 'camera' && (
        <SettingsSubPopup
          title="Camera"
          icon={Video}
          color="bg-emerald-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            <button
              onClick={() => { onToggleCamera(); closePopup(); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all active:scale-[0.98]',
                isCamOn
                  ? 'border-red-400/30 bg-red-500/10 text-red-300'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
              )}
            >
              {isCamOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              <span className="text-sm font-bold">{isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}</span>
            </button>
            <button
              onClick={() => { onFlipCamera(); closePopup(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 transition-all active:scale-[0.98]"
            >
              <Camera className="h-5 w-5" />
              <span className="text-sm font-bold">Flip Camera</span>
            </button>
          </div>
        </SettingsSubPopup>
      )}

      {/* Message Popup */}
      {activePopup === 'message' && (
        <SettingsSubPopup
          title="Messages"
          icon={Mail}
          color="bg-cyan-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            <button
              onClick={() => { onOpenMessage(); closePopup(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-cyan-300 transition-all active:scale-[0.98]"
            >
              <Mail className="h-5 w-5" />
              <span className="text-sm font-bold">Open Messages</span>
            </button>
            {onToggleChatLock && (
              <button
                onClick={() => { onToggleChatLock(); closePopup(); }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all active:scale-[0.98]',
                  isChatLocked
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                )}
              >
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold">{isChatLocked ? 'Unlock Chat' : 'Lock Chat'}</span>
              </button>
            )}
          </div>
        </SettingsSubPopup>
      )}

      {/* Effects Popup */}
      {activePopup === 'effects' && (
        <SettingsSubPopup
          title="Effects"
          icon={Sparkles}
          color="bg-violet-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            {onToggleRGB && (
              <button
                onClick={() => { onToggleRGB(); closePopup(); }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all active:scale-[0.98]',
                  hasRgbEffect
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-violet-400/30 bg-violet-500/10 text-violet-300'
                )}
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-bold">{hasRgbEffect ? 'Disable RGB Effect' : 'Enable RGB Effect'}</span>
              </button>
            )}
          </div>
        </SettingsSubPopup>
      )}

      {/* Officer Popup */}
      {activePopup === 'officer' && (
        <SettingsSubPopup
          title="Officer"
          icon={ShieldCheck}
          color="bg-blue-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            {onAssignOfficer && (
              <button
                onClick={() => { onAssignOfficer(); closePopup(); }}
                className="flex w-full items-center gap-3 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-blue-300 transition-all active:scale-[0.98]"
              >
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold">Assign Broad Officer</span>
              </button>
            )}
            {onPayOfficers && (
              <button
                onClick={() => { onPayOfficers(); closePopup(); }}
                className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-cyan-300 transition-all active:scale-[0.98]"
              >
                <Coins className="h-5 w-5" />
                <span className="text-sm font-bold">Pay Broad Officers</span>
              </button>
            )}
          </div>
        </SettingsSubPopup>
      )}

      {/* Announce Popup */}
      {activePopup === 'announce' && (
        <SettingsSubPopup
          title="Announcement"
          icon={Megaphone}
          color="bg-orange-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            {onTextPopup && (
              <button
                onClick={() => { onTextPopup(); closePopup(); }}
                className="flex w-full items-center gap-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-orange-300 transition-all active:scale-[0.98]"
              >
                <Megaphone className="h-5 w-5" />
                <span className="text-sm font-bold">Send Text Popup</span>
              </button>
            )}
          </div>
        </SettingsSubPopup>
      )}

      {/* Seats Popup */}
      {activePopup === 'seats' && (
        <SettingsSubPopup
          title="Manage Seats"
          icon={Users}
          color="bg-violet-500/20"
          onClose={closePopup}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm font-bold text-white/80">Viewer Seats</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const next = Math.max(0, seatCount - 1);
                    if (next !== seatCount) {
                      onUpdateSeatCount?.(next);
                    }
                    closePopup();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition active:scale-95"
                >
                  -
                </button>
                <span className="text-sm font-black text-white w-4 text-center">{seatCount}</span>
                <button
                  onClick={() => {
                    const next = Math.min(6, seatCount + 1);
                    if (next !== seatCount) {
                      onUpdateSeatCount?.(next);
                    }
                    closePopup();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              Adjust how many viewer seats are available. Total boxes = seats + broadcaster.
            </p>
          </div>
        </SettingsSubPopup>
      )}

      {/* End Stream Popup */}
      {activePopup === 'end' && (
        <SettingsSubPopup
          title="End Stream"
          icon={Power}
          color="bg-red-500/20"
          onClose={closePopup}
        >
          <div className="space-y-3">
            <p className="text-sm text-white/60">
              Are you sure you want to end this broadcast? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={closePopup}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => { onEndStream(); closePopup(); }}
                className="flex-1 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-300 transition-all active:scale-[0.98]"
              >
                End Stream
              </button>
            </div>
          </div>
        </SettingsSubPopup>
      )}
    </>
  );
}
