import React, { useState } from 'react';
import { Radio, Users, Share2, Gift, ChevronRight, MoreHorizontal, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';

export default function BattleBottomBar({
  challengerName,
  opponentName,
  isLive,
  viewerCount,
  onShare,
  onGift,
  onNext,
  hasNext,
}: {
  challengerName?: string | null;
  opponentName?: string | null;
  isLive?: boolean;
  viewerCount?: number;
  onShare?: () => void;
  onGift?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (onShare) return onShare();
    try {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: 'MaiTroll Battle', url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          toast.success('Battle link copied');
          setTimeout(() => setCopied(false), 1500);
        });
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="z-30 flex items-center gap-2 border-t border-white/10 bg-gradient-to-b from-black/80 to-zinc-950 px-3 py-2 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
            isLive ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/60'
          )}
        >
          <Radio size={10} className={isLive ? 'animate-pulse' : ''} />
          {isLive ? 'Live' : 'Offline'}
        </span>
        <div className="min-w-0 truncate text-xs font-bold text-white/90">
          {challengerName || 'Blue'} <span className="text-white/30">vs</span> {opponentName || 'Red'}
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-[10px] text-white/50 sm:flex">
          <Users size={11} /> {(viewerCount ?? 0).toLocaleString()}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
          <span className="hidden sm:inline">Share</span>
        </button>
        <button
          type="button"
          onClick={onGift}
          className="flex items-center gap-1 rounded-full border border-purple-400/40 bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white transition hover:scale-105"
        >
          <Gift size={14} />
          <span className="hidden sm:inline">Gift</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-40"
          title="Next battle"
        >
          <ChevronRight size={14} />
          <span className="hidden sm:inline">Next</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/80 transition hover:bg-white/10 sm:hidden"
          onClick={() => toast('More options coming soon')}
          aria-label="More"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
