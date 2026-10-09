import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { useRoom } from '../../hooks/useRoom';

/**
 * ArrestHandler - Monitors jail table for real-time arrest enforcement
 * When a user is arrested while viewing/broadcasting, they are immediately:
 * 1. Removed from the broadcast (leave room)
 * 2. Redirected to /jail
 * 3. Shown an arrest notification
 */
export default function ArrestHandler({ streamId }: { streamId: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { room } = useRoom();
  const userId = user?.id;

  const handleArrest = useCallback(async (jailRecord: any) => {
    console.log('[ArrestHandler] User arrested:', { userId, jailRecord });

    // 1. Disconnect from LiveKit room
    try {
      if (room) {
        await room.disconnect();
        console.log('[ArrestHandler] Disconnected from LiveKit room');
      }
    } catch (error) {
      console.error('[ArrestHandler] Error disconnecting from room:', error);
    }

    // 2. Show arrest toast with details
    const severity = jailRecord.severity || 'unknown';
    const bondAmount = jailRecord.bond_amount || 0;
    const reason = jailRecord.reason || 'No reason provided';

    toast.error(
      `🚔 ARRESTED\n${reason}\nSeverity: ${severity}\nBail: ${bondAmount} coins`,
      {
        duration: 5000,
      }
    );

    // 3. Redirect to jail page
    setTimeout(() => {
      navigate('/jail', { replace: true });
      console.log('[ArrestHandler] Redirected to /jail');
    }, 1000);
  }, [userId, room, navigate]);

  useEffect(() => {
    if (!streamId || !streamId.trim() || !userId) return;

    const checkInitialArrest = async () => {
      try {
        const { data } = await supabase
          .from('jail')
          .select('id, reason, severity, bond_amount, arrested_by, release_time')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const releaseTime = new Date(data.release_time);
          if (releaseTime > new Date()) {
            await handleArrest(data);
          }
        }
      } catch (error) {
        console.error('[ArrestHandler] Error checking initial arrest:', error);
      }
    };

    void checkInitialArrest();

    const channel = supabase
      .channel(`arrests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jail',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const data = (payload as any).new;
          if (data && data.user_id === userId) {
            void handleArrest(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleArrest, streamId, userId]);

  return null; // No UI - just handler
}
