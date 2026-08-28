import React, { useEffect, useRef } from "react";
import { Coins, Gift, MicOff, User } from "lucide-react";

export interface MobileParticipantVM {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  role?: "host" | "stage" | "viewer" | null;
  team: "blue" | "red";
  seatIndex?: number | null;
  points: number;
  videoTrack?: any;
  hasAudio?: boolean;
}

export default function MobileBattleParticipant({
  vm,
  glow,
  onTap,
}: {
  vm: MobileParticipantVM;
  glow?: boolean;
  onTap?: () => void;
}) {
  const isBlue = vm.team === "blue";
  const borderClass = isBlue
    ? "border-blue-500/70 shadow-[0_0_18px_rgba(59,130,246,0.40)]"
    : "border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.40)]";
  const badgeClass = vm.role === "host"
    ? "bg-gradient-to-r from-cyan-300 to-fuchsia-300 text-black"
    : vm.role === "stage"
    ? "bg-white/15 text-white/90"
    : "bg-white/10 text-white/60";
  const badgeLabel = vm.role === "host" ? "HOST" : vm.role === "stage" ? "GUEST" : "VIEWER";

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = videoContainerRef.current;
    const track = vm.videoTrack;
    if (!track || !container) return;

    const trackId = track.sid || (track as any).id || null;
    if (trackId && trackId === trackIdRef.current && videoRef.current) {
      return;
    }

    if (videoRef.current) {
      try {
        track.detach(videoRef.current);
      } catch {
        // ignore
      }
      videoRef.current.remove();
      videoRef.current = null;
      trackIdRef.current = null;
    }

    try {
      const videoElement = track.attach() as HTMLVideoElement;
      videoRef.current = videoElement;
      trackIdRef.current = trackId;
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      videoElement.style.objectFit = "contain";
      videoElement.style.display = "block";
      videoElement.style.backgroundColor = "black";
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("webkit-playsinline", "true");
      videoElement.controls = false;
      (videoElement as any).disablePictureInPicture = true;
      videoElement.muted = true;
      container.appendChild(videoElement);
    } catch (err) {
      console.error("[MobileBattleParticipant] attach() threw error:", err);
    }
  }, [vm.videoTrack]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => video.play().catch(() => {});
    play();

    return () => {
      try {
        if (vm.videoTrack && videoRef.current) {
          vm.videoTrack.detach(videoRef.current);
        }
      } catch {
        // ignore
      }
      videoRef.current = null;
      trackIdRef.current = null;
    };
  }, [vm.videoTrack]);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Tap to gift ${vm.username}`}
      className={[
        "relative flex h-full w-full shrink-0 snap-center flex-col overflow-hidden rounded-2xl border-[3px] bg-[#0B1020] text-left",
        borderClass,
        glow ? (isBlue ? "ring-2 ring-blue-400/80" : "ring-2 ring-red-400/80") : "",
        "touch-manipulation active:scale-[0.98] transition-transform",
      ].join(" ")}
    >
      {/* Video / fallback avatar — fills the entire box */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        {vm.videoTrack ? (
          <div ref={videoContainerRef} className="absolute inset-0" />
        ) : vm.avatarUrl ? (
          <img src={vm.avatarUrl} alt={vm.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900">
            <User size={40} className="text-white/30" />
          </div>
        )}

        {/* Top row: seat + muted */}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white/80">
            #{typeof vm.seatIndex === "number" ? vm.seatIndex + 1 : "·"}
          </span>
          {vm.hasAudio === false && (
            <span className="rounded-full bg-red-500/80 p-1">
              <MicOff size={10} className="text-white" />
            </span>
          )}
        </div>

        {/* Badge */}
        <div className="absolute right-1.5 top-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Username + points — overlaid at the bottom so the camera fills the box */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5">
        <Gift size={12} className="shrink-0 text-yellow-300 drop-shadow" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white drop-shadow">{vm.username}</span>
        <span className={["flex items-center gap-0.5 text-[11px] font-black drop-shadow", isBlue ? "text-blue-300" : "text-red-300"].join(" ")}>
          <Coins size={11} className="text-yellow-400" />
          {vm.points.toLocaleString()}
        </span>
      </div>
    </button>
  );
}
