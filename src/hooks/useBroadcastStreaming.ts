/**
 * useBroadcastStreaming Hook
 * Manages broadcast lifecycle: start, stop, status tracking
 * 
 * Usage:
 * const { startBroadcast, stopBroadcast, status } = useBroadcastStreaming(streamId);
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * React hook for broadcast lifecycle management.
 * Uses these protected endpoints:
 *   POST /api/broadcasts/start-streaming
 *   POST /api/broadcasts/stop-streaming
 *   GET  /api/broadcasts/:streamId/status
 *
 * Changing these URLs breaks broadcast start/stop for all components.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

export interface BroadcastStatus {
  isLive: boolean;
  status: 'pending' | 'live' | 'ended' | 'error';
  roomName: string | null;
  startTime: string | null;
  endTime: string | null;
  totalMinutesAllowed?: number;
  minutesUsed?: number;
  minutesRemaining?: number;
  giftExtensionMinutes?: number;
}

const BROADCAST_API_BASE = process.env.VITE_BROADCAST_API_URL || 'http://localhost:3002/api';

export function useBroadcastStreaming(streamId: string) {
  const { profile } = useAuthStore();
  const [status, setStatus] = useState<BroadcastStatus>({
    isLive: false,
    status: 'pending',
    roomName: null,
    startTime: null,
    endTime: null,
  });
  const [loading, setLoading] = useState(false);

  /**
   * Start the broadcast
   */
  const startBroadcast = useCallback(
    async (title: string, roomName: string) => {
      try {
        if (!profile?.id) {
          toast.error('Not authenticated');
          return;
        }

        setLoading(true);
        console.log(`[useBroadcastStreaming] Starting broadcast: ${streamId}`);

        const response = await fetch(`${BROADCAST_API_BASE}/broadcasts/start-streaming`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId,
            roomName,
            broadcasterId: profile.id,
            title,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start broadcast');
        }

        console.log('[useBroadcastStreaming] Broadcast started:', data);

        setStatus({
          isLive: true,
          status: 'live',
          roomName: data.roomName,
          startTime: new Date().toISOString(),
          endTime: null,
          totalMinutesAllowed: data.totalMinutesAllowed || 360,
          minutesUsed: data.minutesUsed || 0,
          minutesRemaining: data.minutesRemaining || 360,
          giftExtensionMinutes: data.giftExtensionMinutes || 0,
        });

        toast.success('Broadcast started successfully');
        return data;
      } catch (error) {
        console.error('[useBroadcastStreaming] Error starting broadcast:', error);
        const message = error instanceof Error ? error.message : 'Failed to start broadcast';
        toast.error(message);
        setStatus(prev => ({ ...prev, status: 'error' }));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [streamId, profile?.id]
  );

  /**
   * Stop the broadcast
   */
  const stopBroadcast = useCallback(async () => {
    try {
      setLoading(true);
      console.log(`[useBroadcastStreaming] Stopping broadcast: ${streamId}`);

      const response = await fetch(`${BROADCAST_API_BASE}/broadcasts/stop-streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to stop broadcast');
      }

      console.log('[useBroadcastStreaming] Broadcast stopped');

      // Hard-update the stream as ended in the database immediately,
      // regardless of what the backend does internally.
      try {
        await supabase
          .from('streams')
          .update({
            is_live: false,
            status: 'ended',
            end_time: new Date().toISOString(),
          })
          .eq('id', streamId);
      } catch (dbErr) {
        console.warn('[useBroadcastStreaming] DB update failed:', dbErr);
      }

      setStatus(prev => ({
        ...prev,
        isLive: false,
        status: 'ended',
        endTime: new Date().toISOString(),
      }));

      toast.success('Broadcast ended successfully');
      return data;
    } catch (error) {
      console.error('[useBroadcastStreaming] Error stopping broadcast:', error);
      const message = error instanceof Error ? error.message : 'Failed to stop broadcast';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  /**
   * Fetch current broadcast status from backend
   */
  const getStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BROADCAST_API_BASE}/broadcasts/${streamId}/status`);
      const data = await response.json();

      if (!response.ok) {
        console.warn('[useBroadcastStreaming] Failed to get status:', data.error);
        return;
      }

      setStatus({
        isLive: data.isLive,
        status: data.status,
        roomName: data.roomName,
        startTime: data.startTime,
        endTime: data.endTime,
        totalMinutesAllowed: data.totalMinutesAllowed,
        minutesUsed: data.minutesUsed,
        minutesRemaining: data.minutesRemaining,
        giftExtensionMinutes: data.giftExtensionMinutes,
      });

      return data;
    } catch (error) {
      console.error('[useBroadcastStreaming] Error getting status:', error);
    }
  }, [streamId]);

  return {
    status,
    loading,
    startBroadcast,
    stopBroadcast,
    getStatus,
  };
}