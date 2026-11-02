import { supabase } from '@/lib/supabase';

export type MaiCamSignalPayload = {
  type: 'pairing-started' | 'paired' | 'pairing-cancelled' | 'pairing-revoked'
    | 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'device-disconnected'
    | 'switch-camera';
  sessionId: string;
  from: 'phone' | 'desktop';
  payload?: any;
  timestamp: string;
};

const channels: Record<string, any> = {};

export const maicamSignalingService = {
  subscribe(
    sessionId: string,
    onSignal: (signal: MaiCamSignalPayload) => void,
  ): { unsubscribe: () => void } {
    const channelName = `maicam:session:${sessionId}`;

    if (channels[channelName]) {
      return { unsubscribe: () => this.unsubscribe(sessionId) };
    }

    const channel = supabase.channel(channelName);

    channel
      .on(
        'broadcast',
        { event: 'maicam_signal' },
        (payload: any) => {
          const signal = payload?.payload as MaiCamSignalPayload;
          if (signal && signal.sessionId === sessionId) {
            onSignal(signal);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // ready
        }
      });

    channels[channelName] = channel;

    return {
      unsubscribe: () => this.unsubscribe(sessionId),
    };
  },

  send(sessionId: string, signal: Omit<MaiCamSignalPayload, 'timestamp'> & { from: 'phone' | 'desktop' }) {
    const channelName = `maicam:session:${sessionId}`;
    const channel = channels[channelName];
    if (!channel) {
      console.warn('[maicam-signaling] channel not subscribed', sessionId);
      return;
    }

    const full: MaiCamSignalPayload = {
      ...signal,
      timestamp: new Date().toISOString(),
    };

    try {
      channel.send({
        type: 'broadcast',
        event: 'maicam_signal',
        payload: full,
      });
    } catch (err) {
      console.warn('[maicam-signaling] send failed', sessionId, err?.message || err);
    }
  },

  unsubscribe(sessionId: string) {
    const channelName = `maicam:session:${sessionId}`;
    const channel = channels[channelName];
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      delete channels[channelName];
    }
  },

  unsubscribeAll() {
    Object.keys(channels).forEach((id) => this.unsubscribe(id));
  },
};

export default maicamSignalingService;
