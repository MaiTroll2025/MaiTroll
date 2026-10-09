import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { isStaffUser } from '@/lib/userUtils';
import type { Stream } from '@/types/broadcast';
import type { RTCProvider } from '@/types/broadcast';

export interface RTCProviderConfig {
  provider: RTCProvider;
  isStaffStream: boolean;
  isStaffUser: boolean;
}

/**
 * Determines the RTC provider for a stream based on the broadcaster's role.
 * Staff/official users use GetStream.io, normal users use LiveKit.
 */
export function useRTCProvider(stream: Stream | null): RTCProviderConfig {
  const { profile } = useAuthStore();

  const isStaffUserFlag = useMemo(() => {
    if (!profile) return false;
    return isStaffUser(profile);
  }, [profile]);

  const isStaffStream = useMemo(() => {
    if (!stream) return false;
    // Check if stream has explicit provider set
    if (stream.rtc_provider) {
      return stream.rtc_provider === 'getstream';
    }
    // Fallback: check if broadcaster is staff
    // This would require fetching broadcaster profile, so we use stream metadata
    return false;
  }, [stream]);

  const provider = useMemo((): RTCProvider => {
    return isStaffStream ? 'getstream' : 'livekit';
  }, [isStaffStream]);

  return {
    provider,
    isStaffStream,
    isStaffUser: isStaffUserFlag,
  };
}

/**
 * Determines the RTC provider for a viewer joining a stream.
 * Uses the stream's rtc_provider field (server-authoritative).
 */
export function useStreamRTCProvider(stream: Stream | null): RTCProvider {
  return useMemo(() => {
    if (!stream?.rtc_provider) return 'livekit';
    return stream.rtc_provider;
  }, [stream?.rtc_provider]);
}

/**
 * Checks if the current user is authorized to use GetStream RTC.
 * This is a server-authoritative check - the frontend only receives the result.
 */
export function useGetStreamAuthorization(stream: Stream | null): boolean {
  const { profile } = useAuthStore();

  return useMemo(() => {
    if (!profile) return false;
    if (!stream?.rtc_provider || stream.rtc_provider !== 'getstream') return false;
    return isStaffUser(profile);
  }, [profile, stream?.rtc_provider]);
}