import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import Hls from 'hls.js';

import { useAuthStore } from '../../lib/store';
import LiveKitViewerPlayer from './LiveKitViewerPlayer';


export interface WatchableStream {
  id: string;
  room_name?: string;
  livekit_room_name?: string;
  streamChannel: string;
  title?: string;
  broadcaster_id?: string;
  hls_url?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

interface HLSPlayerProps {
  stream: WatchableStream;
  hlsUrl: string;
  onClose: () => void;
  userId: string | null;
  username: string | null;
  isGuest: boolean;
}

function HLSPlayer({ stream: _stream, hlsUrl, onClose, userId: _userId, username: _username, isGuest: _isGuest }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initHLS = () => {
      // If HLS.js is supported, use it
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hlsRef.current = hls;

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(() => {
            // Autoplay failed, user interaction required
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[HLSPlayer] HLS error:', data);
          if (data.fatal) {
            setError('Failed to load stream');
            setIsLoading(false);
          }
        });

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = hlsUrl;
        setIsLoading(false);
        video.play().catch(() => {
          // Autoplay failed
        });
      } else {
        setError('HLS playback not supported');
        setIsLoading(false);
      }
    };

    initHLS();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [hlsUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p>Live stream is starting...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-white">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full"
        />

      </div>
    </div>
  );
}

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  const userId = useAuthStore(s => s.user?.id || null);
  const username = useAuthStore(s => s.profile?.username);
  const isGuest = !userId;

  // Prefer HLS playback if available (for lower latency and better scalability for viewing)
  // Fall back to LiveKit for real-time interaction if needed
  const hlsUrl = stream.hls_url;
  // Real-time audience playback via LiveKit. The broadcaster publishes to a room
  // named `livekit_room_name` (falls back to the stream id), so mirror that exact
  // resolution order here — otherwise the viewer joins an empty/wrong room and
  // nothing ever plays.
  const livekitRoomName = stream.room_name || stream.livekit_room_name || stream.id;

  if (hlsUrl) {
    console.log('[StreamWatchModal] Using HLS playback, URL:', hlsUrl);
    return <HLSPlayer stream={stream} hlsUrl={hlsUrl} onClose={onClose} userId={userId} username={username} isGuest={isGuest} />;
  }

  console.log('[StreamWatchModal] Using LiveKit for real-time viewer playback, room:', livekitRoomName);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Always use LiveKit for real-time viewing */}
        <LiveKitViewerPlayer
          streamId={stream.id}
          broadcasterId={stream.broadcaster_id || stream.streamChannel}
          roomName={livekitRoomName}
        />

      </div>
    </div>
  );
}
