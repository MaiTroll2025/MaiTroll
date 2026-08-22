import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  Crown,
  Expand,
  Mic,
  MicOff,
  MoreHorizontal,
  Plus,
  Send,
  Settings,
  Sparkles,
  MessageCircle,
  Smile,
  Eye,
  Users,
  X,
  Gift,
  Crosshair,
  UserRound,
  Radio,
  Heart,
  Share2,
  Sofa,
  UserPlus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ActionTarget =
  | { kind: 'chat'; username: string; role?: string }
  | { kind: 'seat'; seatId: number; username: string; role?: string }
  | null;

export interface Seat {
  id: number;
  color: 'purple' | 'blue' | 'pink' | 'cyan' | 'gold';
  occupied: boolean;
  username: string;
  avatarUrl: string;
  role: string;
  micOn: boolean;
}

export interface ChatMessage {
  id: string;
  username: string;
  role?: string;
  message: string;
  time: string;
}

export interface MobileBroadcastFullscreenProps {
  mode: 'host' | 'viewer';
  streamName: string;
  streamAvatarUrl?: string;
  viewerCount: number;
  chatCount: number;
  onStageCount: number;
  maxStage: number;
  elapsed: string;
  isLive: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  seats: Seat[];
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleEffects?: () => void;
  effectsOn?: boolean;
  onSettings?: () => void;
  onMore?: () => void;
  onUserAction: (target: ActionTarget) => void;
  onBack?: () => void;
  onClose?: () => void;
  onJoinSeat: (seatId: number) => void;
  onLike?: () => void;
  liked?: boolean;
  onShare?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}W`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function LiveBadge() {
  return (
    <span className="mbc-host__badge-live">
      <span className="mbc-header__live-dot" />
      LIVE
    </span>
  );
}

function SeatColorClass(color: Seat['color']) {
  const map = {
    purple: 'mbc-seat--purple',
    blue: 'mbc-seat--blue',
    pink: 'mbc-seat--pink',
    cyan: 'mbc-seat--cyan',
    gold: 'mbc-seat--gold',
  };
  return map[color];
}

function SeatComponent({
  seat,
  onJoinSeat,
  onAction,
}: {
  seat: Seat;
  onJoinSeat?: (id: number) => void;
  onAction?: (target: { kind: 'seat'; seatId: number; username: string; role?: string }) => void;
}) {
  const colorClass = SeatColorClass(seat.color);

  return (
    <button type="button" className={`mbc-seat ${colorClass}`}>
      <span className="mbc-seat__badge">{seat.id}</span>

      {seat.occupied ? (
        <div className="mbc-seat__content">
          <div
            className="mbc-seat__avatar-wrap"
            style={{ position: 'relative', width: '100%', aspectRatio: '1/1', maxWidth: '64px' }}
          >
            {seat.avatarUrl ? (
              <img src={seat.avatarUrl} alt={seat.username} className="mbc-seat__avatar" />
            ) : (
              <div
                className="mbc-seat__avatar"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '18px',
                  fontWeight: 800,
                }}
              >
                {seat.username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <span className="mbc-seat__username">{seat.username}</span>
          {seat.role && <span className="mbc-seat__role">{seat.role}</span>}
          <span className={`mbc-seat__mic ${seat.micOn ? 'mbc-seat__mic--on' : 'mbc-seat__mic--off'}`}>
            {seat.micOn ? <MessageCircle size={10} /> : <X size={10} />}
            {seat.micOn ? 'On' : 'Off'}
          </span>
        </div>
      ) : (
        <div className="mbc-seat__empty">
          <span className="mbc-seat__plus">
            <Sofa size={20} />
          </span>
          <span className="mbc-seat__tap">Tap to Join</span>
        </div>
      )}
      {!seat.occupied && onJoinSeat && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJoinSeat(seat.id);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
          aria-label={`Seat ${seat.id} — tap to join`}
        />
      )}
      {seat.occupied && onAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction({ kind: 'seat', seatId: seat.id, username: seat.username, role: seat.role || undefined });
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
          aria-label={`${seat.username} — tap for actions`}
        />
      )}
    </button>
  );
}

function UserActionOverlay({ target, onClose }: { target: ActionTarget; onClose: () => void }) {
  if (!target) return null;
  const title = target.kind === 'chat' ? 'Chat User' : `Seat ${target.seatId}`;
  const sub = target.username;

  return (
    <div className="mbc-user-action-overlay" onClick={onClose}>
      <div className="mbc-user-action-overlay__backdrop" />
      <div className="mbc-user-action-overlay__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mbc-user-action-overlay__header">
          <div>
            <div className="mbc-user-action-overlay__title">{title}</div>
            <div className="mbc-user-action-overlay__user">{sub}</div>
          </div>
          <button type="button" className="mbc-user-action-overlay__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mbc-user-action-overlay__body">
          <button type="button" className="mbc-user-action-overlay__row" onClick={onClose}>
            <span className="mbc-user-action-overlay__row-icon">
              <Gift size={18} />
            </span>
            <span className="mbc-user-action-overlay__row-text">
              <span className="mbc-user-action-overlay__row-title">Send Gift</span>
              <span className="mbc-user-action-overlay__row-sub">Send a Troll City gift</span>
            </span>
          </button>
          <button type="button" className="mbc-user-action-overlay__row" onClick={onClose}>
            <span className="mbc-user-action-overlay__row-icon">
              <Crosshair size={18} />
            </span>
            <span className="mbc-user-action-overlay__row-text">
              <span className="mbc-user-action-overlay__row-title">Battle</span>
              <span className="mbc-user-action-overlay__row-sub">Challenge to battle</span>
            </span>
          </button>
          <button type="button" className="mbc-user-action-overlay__row" onClick={onClose}>
            <span className="mbc-user-action-overlay__row-icon">
              <UserRound size={18} />
            </span>
            <span className="mbc-user-action-overlay__row-text">
              <span className="mbc-user-action-overlay__row-title">View Profile</span>
              <span className="mbc-user-action-overlay__row-sub">Open user profile</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MobileBroadcastFullscreen({
  mode,
  streamName,
  streamAvatarUrl,
  viewerCount,
  chatCount,
  onStageCount,
  maxStage,
  elapsed,
  isLive,
  isMicOn,
  isCameraOn,
  seats,
  messages,
  chatInput,
  onChatInputChange,
  onSendChat,
  isChatOpen,
  onToggleChat,
  onToggleMic,
  onToggleCamera,
  onToggleEffects,
  effectsOn,
  onSettings,
  onMore,
  onUserAction,
  onBack,
  onClose,
  onJoinSeat,
  onLike,
  liked,
  onShare,
}: MobileBroadcastFullscreenProps) {
  const navigate = useNavigate();
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUserAction = useCallback(
    (target: ActionTarget) => {
      setActionTarget(target);
    },
    [],
  );

  const closeUserAction = useCallback(() => {
    setActionTarget(null);
  }, []);

  const handleSend = useCallback(() => {
    onSendChat();
  }, [onSendChat]);

  return (
    <main className="mbc-root">
      <div className="mbc-glow" />
      <div className="mbc-grid-overlay" />

      <div className="mbc-content">
        {/* ========================================================
             TOP HEADER
             ======================================================== */}
        <header className="mbc-header">
          <div className="mbc-header__left">
            {mode === 'viewer' ? (
              <button type="button" className="mbc-header__close" aria-label="Go back" onClick={onBack || (() => navigate(-1))}>
                <X size={16} />
              </button>
            ) : (
              <button type="button" className="mbc-header__close" aria-label="Close broadcast" onClick={onClose}>
                <X size={16} />
              </button>
            )}

            <div
              className="mbc-header__avatar"
              style={{
                display: 'grid',
                placeItems: 'center',
                background: mode === 'host' ? 'rgba(139,44,255,0.2)' : 'rgba(61,139,255,0.2)',
                fontSize: '12px',
                fontWeight: 800,
                color: '#FFFFFF',
              }}
            >
              {streamAvatarUrl ? (
                <img src={streamAvatarUrl} alt={streamName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                streamName.slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="mbc-header__identity">
              <span className="mbc-header__name">{streamName}</span>
              <span className="mbc-header__verified" aria-label="Verified">
                ✓
              </span>
              {isLive && <LiveBadge />}
              <span className="mbc-header__timer">{elapsed}</span>
            </div>
          </div>

          {/* Stats panel */}
          <div className="mbc-header__stats">
            <span className="mbc-header__stat">
              <Eye size={13} />
              <strong>{formatCount(viewerCount)}</strong> Viewers
            </span>
            <span className="mbc-header__stat-divider" />
            <span className="mbc-header__stat">
              <MessageCircle size={13} />
              <strong>{formatCount(chatCount)}</strong> In Chat
            </span>
            <span className="mbc-header__stat-divider" />
            <span className="mbc-header__stat">
              <Users size={13} />
              <strong>
                {onStageCount}/{maxStage}
              </strong>{' '}
              On Stage
            </span>
          </div>

          <button type="button" className="mbc-header__more" aria-label="More options" onClick={onMore}>
            <MoreHorizontal size={18} />
          </button>
        </header>

        {/* ========================================================
             HOST / STREAM VIDEO PANEL
             ======================================================== */}
        <section className={mode === 'host' ? 'mbc-host' : 'mbc-viewer-stream'} style={{ position: 'relative' }}>
          <div className={mode === 'host' ? 'mbc-host__bg' : 'mbc-viewer-stream__bg'} />

          <div
            className={mode === 'host' ? 'mbc-host__placeholder' : 'mbc-viewer-stream__placeholder'}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: `2px solid ${mode === 'host' ? 'rgba(139,44,255,0.5)' : 'rgba(61,139,255,0.5)'}`,
                boxShadow: `0 0 20px ${mode === 'host' ? 'rgba(139,44,255,0.25)' : 'rgba(61,139,255,0.25)'}`,
                display: 'grid',
                placeItems: 'center',
                background: mode === 'host' ? 'rgba(139,44,255,0.15)' : 'rgba(61,139,255,0.15)',
              }}
            >
              <Radio size={28} color="rgba(255,255,255,0.7)" />
            </div>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {mode === 'host' ? (isCameraOn ? 'Camera feed active' : 'Camera is off') : 'Stream preview'}
            </span>
          </div>

          {/* Overlays */}
          {mode === 'host' && <HostBadge />}
          <LiveBadge />

          <span className="mbc-host__viewers">
            <Eye size={12} />
            {formatCount(viewerCount)}
          </span>

          <button type="button" className="mbc-host__fullscreen" aria-label="Enter fullscreen">
            <Expand size={14} />
          </button>

          {mode === 'host' && (
            <>
              <span className="mbc-host__mic">
                <span
                  className="mbc-host__mic-dot"
                  style={
                    !isMicOn
                      ? { background: '#F87171', boxShadow: '0 0 6px rgba(248,113,113,0.8)' }
                      : undefined
                  }
                />
                {isMicOn ? 'Mic On' : 'Mic Off'}
              </span>

              <div className="mbc-host__name-bar">
                <Crown size={12} color="#FFC83D" />
                <span>{streamName}</span>
              </div>
            </>
          )}

          {/* Viewer-specific: creator card and side actions */}
          {mode === 'viewer' && (
            <>
              <div className="mbc-creator-card">
                <div className="mbc-creator-card__avatar">
                  {streamAvatarUrl ? (
                    <img src={streamAvatarUrl} alt={streamName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    streamName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="mbc-creator-card__meta">
                  <div className="mbc-creator-card__name">{streamName}</div>
                  <div className="mbc-creator-card__sub">@{streamName.toLowerCase().replace(/\s/g, '')}</div>
                </div>
                <button
                  type="button"
                  className="mbc-follow-btn"
                  onClick={onLike}
                  style={liked ? { background: 'rgba(255,63,216,0.15)', borderColor: 'rgba(255,63,216,0.4)', color: '#FF3FD8' } : undefined}
                >
                  <Heart size={13} />
                  {liked ? 'Liked' : 'Like'}
                </button>
              </div>

              <div className="mbc-side-actions">
                <button
                  type="button"
                  className={`mbc-side-action ${liked ? 'mbc-side-action--active' : ''}`}
                  onClick={onLike}
                  aria-label="Like"
                >
                  <Heart size={20} />
                  <span>Like</span>
                </button>

                <button type="button" className="mbc-side-action" aria-label="Seats" onClick={onToggleChat}>
                  <Sofa size={20} />
                  <span>Seats</span>
                </button>

                <button type="button" className="mbc-side-action" aria-label="Share" onClick={onShare}>
                  <Share2 size={20} />
                  <span>Share</span>
                </button>

                <button type="button" className="mbc-side-action" aria-label="More" onClick={onMore}>
                  <MoreHorizontal size={20} />
                  <span>More</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* ========================================================
             SIX-SEAT STAGE
             ======================================================== */}
        <section className="mbc-stage" aria-label="Stage seats">
          {seats.map((seat) => (
            <SeatComponent key={seat.id} seat={seat} onJoinSeat={onJoinSeat} onAction={onUserAction} />
          ))}
        </section>

        {/* Spacer pushes chat up so controls remain reachable */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* ========================================================
             LIVE CHAT OVERLAY
             ======================================================== */}
        <section className="mbc-chat" aria-label="Live chat">
          <div
            className="mbc-chat__scroll"
            style={{
              overflowY: 'auto',
              maxHeight: '32vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className="mbc-chat__message">
                <div
                  className="mbc-chat__avatar"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    background: mode === 'host' ? 'rgba(139,44,255,0.2)' : 'rgba(61,139,255,0.2)',
                    fontSize: '9px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                  }}
                >
                  {msg.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="mbc-chat__body">
                  <div className="mbc-chat__top">
                    <button
                      type="button"
                      className="mbc-chat__username"
                      onClick={() =>
                        handleUserAction({
                          kind: 'chat',
                          username: msg.username,
                          role: msg.role || undefined,
                        })
                      }
                    >
                      {msg.username}
                    </button>
                    {msg.role && <span className="mbc-chat__role">{msg.role}</span>}
                    <span className="mbc-chat__time">{msg.time}</span>
                  </div>
                  <p className="mbc-chat__text">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="mbc-chat__input-row">
            <button type="button" className="mbc-chat__emoji" aria-label="Open emoji picker">
              <Smile size={18} />
            </button>
            <input
              className="mbc-chat__input"
              type="text"
              placeholder="Say something..."
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              type="button"
              className="mbc-chat__send"
              onClick={handleSend}
              disabled={!chatInput.trim()}
              aria-label="Send message"
              style={!chatInput.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              <Send size={16} />
            </button>
          </div>
        </section>

        {/* ========================================================
             BOTTOM CONTROLS
             ======================================================== */}
        <nav className="mbc-controls" aria-label={mode === 'host' ? 'Broadcast controls' : 'Viewer controls'}>
          {mode === 'host' ? (
            <>
              <button
                type="button"
                className={`mbc-control ${isCameraOn ? 'mbc-control--active' : 'mbc-control--muted'}`}
                onClick={onToggleCamera}
                aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>

              <button
                type="button"
                className={`mbc-control ${isMicOn ? 'mbc-control--active' : 'mbc-control--muted'}`}
                onClick={onToggleMic}
                aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <button
                type="button"
                className={`mbc-control ${effectsOn ? 'mbc-control--active' : ''}`}
                onClick={onToggleEffects}
                aria-label="Toggle effects"
              >
                <Sparkles size={20} />
              </button>

              <button type="button" className="mbc-control" aria-label="Settings" onClick={onSettings}>
                <Settings size={20} />
              </button>

              <button type="button" className="mbc-control" aria-label="More options" onClick={onMore}>
                <MoreHorizontal size={20} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`mbc-control ${liked ? 'mbc-control--active' : ''}`}
                onClick={onLike}
                aria-label={liked ? 'Unlike' : 'Like'}
              >
                <Heart size={20} />
              </button>

              <button
                type="button"
                className="mbc-control"
                aria-label="Seats"
                onClick={() => {
                  const seatSection = document.querySelector('.mbc-stage');
                  seatSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Sofa size={20} />
              </button>

              <button type="button" className="mbc-control" aria-label="Share" onClick={onShare}>
                <Share2 size={20} />
              </button>

              <button type="button" className="mbc-control" aria-label="More options" onClick={onMore}>
                <MoreHorizontal size={20} />
              </button>
            </>
          )}
        </nav>
      </div>

      <UserActionOverlay target={actionTarget} onClose={closeUserAction} />
    </main>
  );
}

function HostBadge() {
  return (
    <span className="mbc-host__badge-host">
      <Crown size={12} />
      HOST
    </span>
  );
}
