import React from "react";
import { Share2, Radio, UserPlus } from "lucide-react";

interface MobileBattleFooterProps {
  avatarUrl?: string | null;
  title: string;
  viewerCount: number;
  onFollow: () => void;
  onShare: () => void;
  className?: string;
}

/**
 * Mobile broadcast footer.
 *
 * Pure content height.
 * Never stretches vertically.
 * Safe-area aware.
 */
export default function MobileBattleFooter({
  avatarUrl,
  title,
  viewerCount,
  onFollow,
  onShare,
  className = "",
}: MobileBattleFooterProps) {
  return (
    <footer
      className={`
        w-full
        flex-none
        border-t border-white/10
        bg-[#0B1020]
        px-3
        py-2
        ${className}
      `}
      style={{
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={title}
            className="h-10 w-10 flex-none rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 flex-none rounded-full bg-zinc-800" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Radio size={13} className="text-red-500" />
            <span className="truncate text-sm font-bold text-white">
              {title}
            </span>
          </div>

          <div className="mt-0.5 text-xs text-white/60">
            {(viewerCount ?? 0).toLocaleString()} watching
          </div>
        </div>

        <button
          onClick={onFollow}
          className="
            flex-none
            inline-flex
            items-center
            gap-1.5
            rounded-full
            bg-purple-600
            px-4
            py-2
            text-xs
            font-bold
            text-white
            transition
            active:scale-95
          "
        >
          <UserPlus size={14} />
          Follow
        </button>

        <button
          onClick={onShare}
          aria-label="Share"
          className="
            flex
            flex-none
            items-center
            gap-1.5
            rounded-full
            bg-white/10
            px-4
            py-2
            text-xs
            font-bold
            text-white
            transition
            active:scale-95
          "
        >
          <Share2 size={16} />
          Share
        </button>
      </div>
    </footer>
  );
}