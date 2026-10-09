import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface SeatHeatBarProps {
  userId: string;
  streamId: string;
  boxCount?: number;
  isBroadcasterBox?: boolean;
}

export default function SeatHeatBar({ userId, streamId, boxCount = 1, isBroadcasterBox: _isBroadcasterBox = false }: SeatHeatBarProps) {
  const [heatValue, setHeatValue] = useState(0);

  useEffect(() => {
    setHeatValue(Math.random() * 30 + 10);

    const channel = supabase
      .channel(`seat-heat-${streamId}-${userId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        if (payload.payload?.recipientId === userId || payload.payload?.targetUserId === userId || payload.payload?.userId === userId) {
          setHeatValue(prev => Math.min(100, prev + 10));
        }
      })
      .subscribe();

    const decayInterval = setInterval(() => {
      setHeatValue(prev => Math.max(0, prev - 2));
    }, 3000);

    return () => {
      clearInterval(decayInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [streamId, userId]);

  const getStatus = () => {
    if (heatValue >= 70) return 'hype';
    if (heatValue >= 30) return 'normal';
    return 'unstable';
  };

  const status = getStatus();
  const showAtTop = boxCount <= 1;

  return (
    <div className={`${showAtTop ? 'absolute top-2 left-3 right-3' : 'absolute bottom-2 left-3 right-3'} z-10 pointer-events-none`}>
      <div className="h-1.5 bg-gray-900/80 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm">
        <div
          className={`h-full transition-all duration-300 ${
            status === 'hype' ? 'bg-gradient-to-r from-purple-500 to-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
            status === 'normal' ? 'bg-gradient-to-r from-green-500 to-purple-500' :
            'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse'
          }`}
          style={{ width: `${heatValue}%` }}
        />
      </div>
    </div>
  );
}