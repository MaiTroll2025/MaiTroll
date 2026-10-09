import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { useRoom } from '../../hooks/useRoom';

/**
 * KickHandler - Monitors stream_kicks table for real-time kick enforcement
 * When a user is kicked while viewing/broadcasting, they are immediately:
 * 1. Removed from the broadcast (leave room)
 * 2. Shown a kick notification
 * 3. Redirected back to home page
 */
export default function KickHandler({ streamId }: { streamId: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { room } = useRoom();
  const userId = user?.id;

  const handleKick = useCallback(async (kickRecord: any) => {
    console.log('[KickHandler] User kicked:', { userId, kickRecord });

    // 1. Disconnect from LiveKit room immediately
    try {
      if (room) {
        await room.disconnect();
        console.log('[KickHandler] Disconnected from LiveKit room');
      }
    } catch (error) {
      console.error('[KickHandler] Error disconnecting from room:', error);
    }

    // 2. Show kick toast with reason
    const reason = kickRecord.reason || 'Kicked by moderator';
    toast.error(`📵 KICKED\n${reason}`, {
      duration: 4000,
    });

    // 3. Redirect to home page after a brief delay
    setTimeout(() => {
      navigate('/', { replace: true });
      console.log('[KickHandler] Redirected to home');
    }, 1000);
  }, [userId, room, navigate]);

  useEffect(() => {
    if (!streamId || !streamId.trim() || !userId) return;

    const channel = supabase
      .channel(`kicks:${streamId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_kicks',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const data = (payload as any).new;
          if (data && data.user_id === userId) {
            void handleKick(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleKick, streamId, userId]);

  return null; // No UI - just handler
}
