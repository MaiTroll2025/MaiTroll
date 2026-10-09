import React from 'react';
import { Mic, MicOff, Video, VideoOff, MoreVertical, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { StagePass } from '../../types/broadcast';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { useUserFrame } from '@/hooks/useUserFrame';

interface StageGuestCardProps {
  pass: StagePass;
  isMicOn: boolean;
  isCamOn: boolean;
  onRemove?: () => void;
  onMenuOpen?: () => void;
  onDot3DMenu?: () => void;
  menuOpen?: boolean;
}

export default function StageGuestCard({
  pass,
  isMicOn,
  isCamOn,
  onRemove: _onRemove,
  onMenuOpen,
  menuOpen = false,
}: StageGuestCardProps) {
  const name = pass.user_profile?.username || 'Stage Guest';
  const initials = name.slice(0, 2).toUpperCase();
  const avatarUrl = pass.user_profile?.avatar_url;
  const userId = (pass as any)?.user_id;
  const guestFrame = useUserFrame(userId);

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl overflow-hidden',
        'border transition-all duration-300',
        menuOpen
          ? 'border-violet-400/60 shadow-[0_0_24px_rgba(139,92,246,0.35)]'
          : 'border-cyan-400/25 shadow-[0_0_16px_rgba(34,211,238,0.12)]',
        'bg-black/75 backdrop-blur-md'
      )}
    >
      {/* Top gradient strip */}
      <div className="h-[3px] bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400" />

      {/* Status bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 bg-black/30">
        <div className="flex items-center gap-1.5">
          <Circle size={6} className="fill-emerald-400 text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
            On Stage
          </span>
        </div>

        {/* 3-dot menu */}
        <button
          onClick={onMenuOpen}
          className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <MoreVertical size={12} className="text-white/50" />
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 min-h-0 relative bg-slate-950/80 flex items-center justify-center" style={{ overflow: 'visible' }}>
        {avatarUrl ? (
          <div className="w-full h-full flex items-center justify-center" style={{ overflow: 'visible' }}>
            <ProfileFrame
              frame={guestFrame}
              avatarUrl={avatarUrl}
              username={name}
              size="sm"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-400/30 flex items-center justify-center">
              <span className="text-[18px] font-black text-cyan-300/80">
                {initials}
              </span>
            </div>
          </div>
        )}

        {/* Mic / Cam status icons ─ bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Mic */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full',
                  isMicOn
                    ? 'bg-emerald-500/20 border border-emerald-500/40'
                    : 'bg-red-500/20 border border-red-500/40'
                )}
                title={isMicOn ? 'Microphone on' : 'Microphone off'}
              >
                {isMicOn ? (
                  <Mic size={10} className="text-emerald-400" />
                ) : (
                  <MicOff size={10} className="text-red-400" />
                )}
              </span>

              {/* Camera */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full',
                  isCamOn
                    ? 'bg-cyan-500/20 border border-cyan-500/40'
                    : 'bg-red-500/20 border border-red-500/40'
                )}
                title={isCamOn ? 'Camera on' : 'Camera off'}
              >
                {isCamOn ? (
                  <Video size={10} className="text-cyan-400" />
                ) : (
                  <VideoOff size={10} className="text-red-400" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Name bar */}
      <div className="px-2.5 py-2 border-t border-white/5 bg-black/40">
        <div className="flex items-center gap-2">
          {/* Avatar ring */}
          <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ overflow: 'visible' }}>
            {avatarUrl ? (
              <ProfileFrame
                frame={guestFrame}
                avatarUrl={avatarUrl}
                username={name}
                size="sm"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-[8px] font-black text-white">
                {initials}
              </div>
            )}
          </div>
          <span className="text-[11px] font-bold text-white/90 truncate">{name}</span>
        </div>
      </div>
    </div>
  );
}
