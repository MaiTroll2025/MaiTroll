import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Mic, MicOff, RefreshCw, Video, VideoOff, Power, X } from 'lucide-react';
import { toast } from 'sonner';

import { MaiCamConnectionManager } from '@/lib/maicam/MaiCamConnectionManager';

interface PhoneMaiCamCameraProps {
  manager: MaiCamConnectionManager;
  onDisconnect: () => void;
}

export default function PhoneMaiCamCamera({ manager, onDisconnect }: PhoneMaiCamCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [quality, setQuality] = useState<'480p' | '720p' | '1080p'>('720p');
  const [fps, setFps] = useState<15 | 24 | 30 | 60>(30);

  useEffect(() => {
    if (manager.localStream && videoRef.current) {
      videoRef.current.srcObject = manager.localStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      try { videoRef.current.play().catch(() => {}); } catch {}
    }
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [manager.localStream]);

  const handleSwitchCamera = useCallback(async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    await manager.switchCamera(next);
  }, [manager, facingMode]);

  const handleRestart = useCallback(async () => {
    try {
      await manager.restartCapture({
        video: isVideoEnabled,
        audio: isMicEnabled,
        quality,
        fps,
        facingMode,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restart camera');
    }
  }, [manager, isVideoEnabled, isMicEnabled, quality, fps, facingMode]);

  const handleDisconnect = useCallback(() => {
    manager.disconnect();
    onDisconnect();
  }, [manager, onDisconnect]);

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-[70dvh] max-h-[70dvh] object-contain object-center bg-black"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
        />
      </div>

      <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-3">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#39FF14] animate-pulse"/>
          <span className="text-[10px] font-bold text-[#39FF14]">Transmitting</span>
        </div>

        <div className="flex items-center justify-center gap-2 mt-2">
          <button onClick={handleSwitchCamera} className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-white text-sm active:scale-95">
            <Camera size={18}/> <span className="hidden sm:inline">Switch Camera</span>
          </button>
          <button
            onClick={() => { setIsVideoEnabled(!isVideoEnabled); manager.setVideoEnabled(!isVideoEnabled); }}
            className={`
              flex items-center gap-1 rounded-full border px-3 py-2 text-sm active:scale-95 transition
              ${isVideoEnabled ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}
            `}
          >
            {isVideoEnabled ? <VideoOff size={18}/> : <Video size={18}/>}
            <span className="hidden sm:inline">{isVideoEnabled ? 'Video Off' : 'Video On'}</span>
          </button>
          <button
            onClick={() => { setIsMicEnabled(!isMicEnabled); manager.setMicEnabled(!isMicEnabled); }}
            className={`
              flex items-center gap-1 rounded-full border px-3 py-2 text-sm active:scale-95 transition
              ${isMicEnabled ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}
            `}
          >
            {isMicEnabled ? <Mic size={18}/> : <MicOff size={18}/>}
            <span className="hidden sm:inline">{isMicEnabled ? 'Mic Off' : 'Mic On'}</span>
          </button>
          <button onClick={handleDisconnect} className="flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm active:scale-95">
            <Power size={18}/> Disconnect
          </button>
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] font-bold text-slate-400">Quality</span>
          {(['480p', '720p', '1080p'] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition active:scale-95
                ${quality === q ? 'border-[#39FF14] bg-[#39FF14]/20 text-[#39FF14]' : 'border-white/10 bg-white/5 text-slate-400'}`}
            >
              {q}
            </button>
          ))}
          {([15, 24, 30, 60] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFps(f)}
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition active:scale-95
                ${fps === f ? 'border-[#39FF14] bg-[#39FF14]/20 text-[#39FF14]' : 'border-white/10 bg-white/5 text-slate-400'}`}
            >
              {f}fps
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-1">
          <button onClick={handleRestart} className="rounded-full border border-[#39FF14]/40 bg-[#39FF14]/10 px-2.5 py-1.5 text-[#39FF14] text-[10px] font-bold active:scale-95">
            <RefreshCw size={14}/> Restart
          </button>
          <button onClick={() => onDisconnect()} className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1.5 text-slate-400 text-[10px] font-bold active:scale-95">
            <X size={14}/> Return
          </button>
        </div>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 text-[9px] text-slate-500">
        Portrait &amp; landscape supported • Keep screen awake
      </div>
    </div>
  );
}
