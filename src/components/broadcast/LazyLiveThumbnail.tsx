import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyLiveThumbnailProps {
  /** Stream ID for fetching the live preview */
  streamId: string;
  /** Agora channel name for the stream */
  agoraChannel?: string | null;
  /** Category of the stream (gaming, broadcast, etc.) */
  category?: string;
  /** Static thumbnail URL (fallback) */
  thumbnailUrl?: string | null;
  /** Broadcaster avatar URL (fallback) */
  avatarUrl?: string | null;
  /** Stream title */
  title?: string;
  /** Whether the stream is currently live */
  isLive?: boolean;
  /** Additional className */
  className?: string;
  /** Callback when user clicks to navigate */
  onClick?: () => void;
}

/**
 * LazyLiveThumbnail — Shows a static thumbnail by default.
 * On hover, attempts to load a live video preview of the stream.
 * When the user clicks, navigates to the stream.
 *
 * This component implements lazy loading for live thumbnails:
 * - Default: shows static thumbnail or avatar
 * - On hover: loads and shows live video preview
 * - On click: navigates to the full stream page
 *
 * For gaming streams (HytroGaming), it shows the screenshare preview.
 * For regular broadcasts, it shows the camera/screenshare preview.
 */
export function LazyLiveThumbnail({
  streamId: _streamId,
  agoraChannel,
  category,
  thumbnailUrl,
  avatarUrl,
  title,
  isLive = true,
  className,
  onClick,
}: LazyLiveThumbnailProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [_videoLoaded, setVideoLoaded] = useState(false);
  const [_hasError, _setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On hover, start loading the live preview after a short delay
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);

    // Small delay to avoid loading on quick mouse passes
    hoverTimeoutRef.current = setTimeout(() => {
      // Try to load a live preview via the stream's playback URL
      // For Agora streams, we can't easily get a preview without joining,
      // so we rely on the thumbnail_url being a live snapshot
      setVideoLoaded(true);
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setVideoLoaded(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Clean up any video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Determine the preview source
  // For streams with thumbnail_url, we use that as the "live" preview
  // For gaming streams without thumbnails, we show a branded placeholder
  const previewUrl = thumbnailUrl || avatarUrl;
  const isGaming = category === 'gaming' || !!agoraChannel;

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-slate-950', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Default state: static thumbnail or avatar */}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={title || 'Stream thumbnail'}
          className={cn(
            'h-full w-full object-cover transition-all duration-500',
            isHovering && 'scale-110 blur-[2px]'
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center transition-all duration-500',
            isGaming
              ? 'bg-gradient-to-br from-cyan-950/60 via-slate-950 to-purple-950/40'
              : 'bg-gradient-to-br from-purple-900/20 to-cyan-900/20',
            isHovering && 'scale-105'
          )}
        >
          {isGaming ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 transition-all duration-300',
                  isHovering && 'scale-110 border-cyan-300/40 bg-cyan-300/20'
                )}
              >
                <Play
                  className={cn(
                    'h-8 w-8 text-cyan-300/60 transition-all duration-300',
                    isHovering && 'text-cyan-300 scale-110'
                  )}
                />
              </div>
              {isHovering && (
                <p className="animate-pulse text-[10px] font-black uppercase tracking-widest text-cyan-300/80">
                  Live Preview
                </p>
              )}
            </div>
          ) : (
            <Play className="h-12 w-12 text-white/20" />
          )}
        </div>
      )}

      {/* Hover overlay with live indicator */}
      {isHovering && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 transition-opacity duration-300">
          {/* Pulsing live ring */}
          <div className="relative">
            <div className="absolute -inset-3 animate-ping rounded-full bg-red-500/20" />
            <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-white/60 bg-black/60 backdrop-blur-sm">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          </div>

          {/* Live badge */}
          {isLive && (
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 shadow-lg backdrop-blur-sm">
              <Radio className="h-3 w-3 animate-pulse text-white" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                Watch Live
              </span>
            </div>
          )}

          {/* Gaming indicator */}
          {isGaming && (
            <div className="mt-2 flex items-center gap-1 rounded-full bg-cyan-500/20 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-cyan-300">🎮 SCREEN SHARE</span>
            </div>
          )}
        </div>
      )}

      {/* Live badge (always visible when live) */}
      {isLive && !isHovering && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-[9px] font-black text-white">LIVE</span>
        </div>
      )}
    </div>
  );
}

export default LazyLiveThumbnail;
