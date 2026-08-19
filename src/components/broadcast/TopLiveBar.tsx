import React from 'react';
import { Stream } from '../../types/broadcast';
import { User, Plus, X, Users, Heart } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getGlowingTextStyle } from '../../lib/perkEffects';

interface TopLiveBarProps {
  stream: Stream;
  hostName?: string;
  hostAvatar?: string;
  hostGlowingColor?: string;
  isFollowing?: boolean;
  onFollow?: () => void;
  onClose?: () => void;
  className?: string;
  compact?: boolean;
  viewerCount?: number;
  likeCount?: number;
  onLike?: () => void;
  onViewerCountClick?: () => void;
}

export default function TopLiveBar({
  stream,
  hostName = 'Unknown Host',
  hostAvatar,
  hostGlowingColor,
  isFollowing = false,
  onFollow,
  onClose,
  className,
  compact = false,
  viewerCount,
  likeCount,
  onLike,
  onViewerCountClick,
}: TopLiveBarProps) {
  const displayViewerCount = viewerCount !== undefined ? viewerCount : (stream.current_viewers || stream.viewer_count || 0);
  const displayLikes = likeCount !== undefined ? likeCount : (stream.total_likes || 0);

  if (compact) {
    return (
      <div className={cn("flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent", className)}>
        {/* Left: Host Info */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {hostAvatar ? (
              <img src={hostAvatar} alt={hostName} className="w-8 h-8 rounded-full border border-pink-500" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600">
                <User size={14} className="text-zinc-400" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span 
              className="text-xs font-bold text-white truncate max-w-[80px]"
              style={hostGlowingColor ? getGlowingTextStyle(hostGlowingColor) : undefined}
            >
              {hostName}
            </span>
            <div className="flex items-center gap-1.5">
              <span 
                className="text-[9px] text-zinc-400 flex items-center gap-0.5 cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={onViewerCountClick}
              >
                <Users size={8} className="text-zinc-500" />
                {displayViewerCount.toLocaleString()}
              </span>
              <span className="text-[9px] text-pink-400 flex items-center gap-0.5">
                <Heart size={8} className="text-pink-500" />
                {displayLikes.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Close Button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent", className)}>
      
      {/* Left: Host Info Pill with Stats */}
      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full p-1 pr-3">
        <div className="relative">
          {hostAvatar ? (
            <img src={hostAvatar} alt={hostName} className="w-9 h-9 rounded-full border border-pink-500" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600">
              <User size={16} className="text-zinc-400" />
            </div>
          )}
        </div>
        
        <div className="flex flex-col">
          <span 
            className="text-xs font-bold text-white max-w-[80px] truncate"
            style={hostGlowingColor ? getGlowingTextStyle(hostGlowingColor) : undefined}
          >
            {hostName}
          </span>
          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-zinc-200 transition-colors"
              onClick={onViewerCountClick}
            >
              <Users size={10} className="text-zinc-400" />
              {displayViewerCount.toLocaleString()}
            </span>
            {onLike ? (
              <button 
                onClick={onLike}
                className="text-[10px] text-pink-400 flex items-center gap-1 hover:text-pink-300 transition-colors"
              >
                <Heart size={10} className="text-pink-500" />
                {displayLikes.toLocaleString()}
              </button>
            ) : (
              <span className="text-[10px] text-pink-400 flex items-center gap-1">
                <Heart size={10} className="text-pink-500" />
                {displayLikes.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {!isFollowing && onFollow && (
          <button 
            onClick={onFollow}
            className="ml-1 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white hover:bg-pink-600 transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Right: Close Button */}
      <div className="flex items-center gap-2">
        {onClose && (
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
