import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamMeetingNotificationProps {
  meetingId: string;
  meetingTitle: string;
  onDismiss: () => void;
  onJoin: (meetingId: string, cameraOn: boolean, micOn: boolean) => void;
}

export default function TeamMeetingNotification({
  meetingId,
  meetingTitle,
  onDismiss,
  onJoin,
}: TeamMeetingNotificationProps) {
  const _navigate = useNavigate();
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Auto-dismiss countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      onDismiss();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onDismiss]);

  const handleJoin = useCallback(() => {
    onJoin(meetingId, cameraOn, micOn);
  }, [meetingId, cameraOn, micOn, onJoin]);

  const handleJoinWithCamera = useCallback(() => {
    setCameraOn(true);
    onJoin(meetingId, true, micOn);
  }, [meetingId, micOn, onJoin]);

  const handleJoinWithMic = useCallback(() => {
    setMicOn(true);
    onJoin(meetingId, cameraOn, true);
  }, [meetingId, cameraOn, onJoin]);

  const handleJoinCameraOffMicOff = useCallback(() => {
    onJoin(meetingId, false, false);
  }, [meetingId, onJoin]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
      >
        <div className="rounded-2xl border border-cyan-500/30 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-5 py-3 flex items-center justify-between border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Users className="h-5 w-5 text-cyan-400" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-cyan-400">Team Meeting Started</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{timeLeft}s</span>
              <button
                onClick={onDismiss}
                className="rounded-full p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Meeting Info */}
          <div className="px-5 py-4">
            <h3 className="text-lg font-bold text-white mb-1 truncate">{meetingTitle}</h3>
            <p className="text-sm text-gray-400 mb-4">A team meeting has started. Join now!</p>

            {/* Camera & Mic Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setCameraOn(!cameraOn)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  cameraOn
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                Camera {cameraOn ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setMicOn(!micOn)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  micOn
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                Mic {micOn ? 'On' : 'Off'}
              </button>
            </div>

            {/* Join Buttons */}
            <div className="space-y-2">
              {/* Primary Join Button */}
              <button
                onClick={handleJoin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
              >
                <Video className="h-4 w-4" />
                Join Now
                {cameraOn && micOn && <span className="text-xs opacity-70">(Camera + Mic)</span>}
                {cameraOn && !micOn && <span className="text-xs opacity-70">(Camera Only)</span>}
                {!cameraOn && micOn && <span className="text-xs opacity-70">(Mic Only)</span>}
                {!cameraOn && !micOn && <span className="text-xs opacity-70">(Camera & Mic Off)</span>}
              </button>

              {/* Quick Join Options */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleJoinWithCamera}
                  className="flex flex-col items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-gray-300 hover:bg-white/10 hover:border-cyan-500/30 transition-all"
                >
                  <Video className="h-3.5 w-3.5 text-green-400" />
                  <span>Camera On</span>
                </button>
                <button
                  onClick={handleJoinWithMic}
                  className="flex flex-col items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-gray-300 hover:bg-white/10 hover:border-cyan-500/30 transition-all"
                >
                  <Mic className="h-3.5 w-3.5 text-green-400" />
                  <span>Mic On</span>
                </button>
                <button
                  onClick={handleJoinCameraOffMicOff}
                  className="flex flex-col items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-gray-300 hover:bg-white/10 hover:border-cyan-500/30 transition-all"
                >
                  <VideoOff className="h-3.5 w-3.5 text-gray-400" />
                  <span>Join Silent</span>
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div className="h-0.5 bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 30, ease: 'linear' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
