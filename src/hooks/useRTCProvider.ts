import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import type { Stream } from '@/types/broadcast';
import type { RTCProvider } from '@/types/broadcast';

export interface RTCProviderConfig {
  provider: RTCProvider;
  isStaffStream: boolean;
  isStaffUser: boolean;
}

export function useRTCProvider(_stream: Stream | null): RTCProviderConfig {
  const { profile } = useAuthStore();

  const isStaffUserFlag = useMemo(() => {
    if (!profile) return false;
    return false;
  }, [profile]);

  const provider = useMemo((): RTCProvider => {
    return 'livekit';
  }, []);

  return {
    provider,
    isStaffStream: false,
    isStaffUser: isStaffUserFlag,
  };
}

export function useStreamRTCProvider(_stream: Stream | null): RTCProvider {
  return useMemo(() => {
    return 'livekit';
  }, []);
}

export function useGetStreamAuthorization(_stream: Stream | null): boolean {
  return false;
}