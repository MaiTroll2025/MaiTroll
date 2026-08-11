import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { UserRole } from '@/lib/supabase';

export interface BroadcastViewerCapState {
  // Viewer cap settings
  viewerCapEnabled: boolean;
  viewerCapMax: number;
  viewerCapHours: number;
  // Start cap settings
  startCapEnabled: boolean;
  startCapMax: number;
  // Seat cap settings
  seatCapEnabled: boolean;
  seatCapMax: number;
  // Master override
  allRestrictionsDisabled: boolean;
  // Loading
  loading: boolean;
}

export function useBroadcastViewerCap() {
  const [state, setState] = useState<BroadcastViewerCapState>({
    viewerCapEnabled: false,
    viewerCapMax: 20,
    viewerCapHours: 24,
    startCapEnabled: false,
    startCapMax: 2,
    seatCapEnabled: true,
    seatCapMax: 2,
    allRestrictionsDisabled: false,
    loading: true,
  });

  const profile = useAuthStore((s) => s.profile);

  const isAdmin =
    profile?.role === UserRole.ADMIN ||
    profile?.troll_role === UserRole.ADMIN ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
    profile?.role === UserRole.OWNER ||
    profile?.role === UserRole.PRESIDENT ||
    profile?.role === UserRole.VICE_PRESIDENT ||
    profile?.role === UserRole.TEMP_CITY_ADMIN ||
    profile?.role === UserRole.TEMP_ADMIN;

  const parseSetting = useCallback((settingValue: any): any => {
    if (!settingValue) return null;
    if (typeof settingValue === 'object') return settingValue;
    if (typeof settingValue === 'string') {
      try {
        // Handle both JSON string and plain text
        if (settingValue.startsWith('{')) {
          return JSON.parse(settingValue);
        }
        return settingValue;
      } catch {
        return settingValue;
      }
    }
    return settingValue;
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'broadcast_viewer_cap_enabled',
          'broadcast_viewer_cap_max',
          'broadcast_viewer_cap_hours',
          'broadcast_start_cap_enabled',
          'broadcast_start_cap_max',
          'broadcast_seat_cap_enabled',
          'broadcast_seat_cap_max',
          'broadcast_all_restrictions_disabled',
        ]);

      if (error) {
        console.error('[useBroadcastViewerCap] fetch error:', error);
        return;
      }

      if (data) {
        const map: Record<string, any> = {};
        data.forEach((row) => {
          map[row.setting_key] = parseSetting(row.setting_value);
        });

        setState((prev) => ({
          ...prev,
          viewerCapEnabled: map.broadcast_viewer_cap_enabled?.enabled === true,
          viewerCapMax: Number(map.broadcast_viewer_cap_max?.value ?? 20),
          viewerCapHours: Number(map.broadcast_viewer_cap_hours?.value ?? 24),
          startCapEnabled: map.broadcast_start_cap_enabled?.enabled === true,
          startCapMax: Number(map.broadcast_start_cap_max?.value ?? 2),
          seatCapEnabled: map.broadcast_seat_cap_enabled?.enabled === true,
          seatCapMax: Number(map.broadcast_seat_cap_max?.value ?? 2),
          allRestrictionsDisabled: map.broadcast_all_restrictions_disabled?.enabled === true,
          loading: false,
        }));
      }
    } catch (err) {
      console.error('[useBroadcastViewerCap] unexpected error:', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [parseSetting]);

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('broadcast_viewer_cap_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings',
           filter: 'setting_key=in.(broadcast_viewer_cap_enabled,broadcast_viewer_cap_max,broadcast_viewer_cap_hours,broadcast_start_cap_enabled,broadcast_start_cap_max,broadcast_seat_cap_enabled,broadcast_seat_cap_max,broadcast_all_restrictions_disabled)',
        },
        () => {
          // Re-fetch all settings on any change
          fetchSettings();
        },
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchSettings]);

  // Toggle viewer cap
  const setViewerCapEnabled = useCallback(
    async (enabled: boolean) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ enabled }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_viewer_cap_enabled');

        if (error) throw error;
        setState((prev) => ({ ...prev, viewerCapEnabled: enabled }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setViewerCapEnabled error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // Set viewer cap max
  const setViewerCapMax = useCallback(
    async (value: number) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ value }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_viewer_cap_max');

        if (error) throw error;
        setState((prev) => ({ ...prev, viewerCapMax: value }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setViewerCapMax error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // Toggle start cap
  const setStartCapEnabled = async (enabled: boolean) => {
    if (!isAdmin) return false;
    try {
      const { error } = await supabase
        .from('admin_settings')
        .update({
          setting_value: JSON.stringify({ enabled }),
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'broadcast_start_cap_enabled');

      if (error) throw error;
      setState((prev) => ({ ...prev, startCapEnabled: enabled }));
      return true;
    } catch (err) {
      console.error('[useBroadcastViewerCap] setStartCapEnabled error:', err);
      return false;
    }
  };

  // Set start cap max
  const setStartCapMax = useCallback(
    async (value: number) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ value }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_start_cap_max');

        if (error) throw error;
        setState((prev) => ({ ...prev, startCapMax: value }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setStartCapMax error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // Toggle all restrictions disabled (master override)
  const setAllRestrictionsDisabled = useCallback(
    async (disabled: boolean) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ enabled: disabled }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_all_restrictions_disabled');

        if (error) throw error;
        setState((prev) => ({ ...prev, allRestrictionsDisabled: disabled }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setAllRestrictionsDisabled error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // UI-only early-feedback helper. NOT a security boundary — the authoritative
  // enforcement happens in the join_stream_as_viewer / start_broadcast_with_capacity_check
  // RPCs. This is used to disable the join/start button when the known state is
  // already at/over the configured cap, and to show the configured limit.
  const isStreamViewerCapped = useCallback(
    (currentViewers?: number): boolean => {
      if (state.allRestrictionsDisabled) return false;
      if (!state.viewerCapEnabled) return false;
      if (typeof currentViewers === 'number' && currentViewers >= state.viewerCapMax) {
        return true;
      }
      return false;
    },
    [state.allRestrictionsDisabled, state.viewerCapEnabled, state.viewerCapMax],
  );

  // Toggle seat cap
  const setSeatCapEnabled = useCallback(
    async (enabled: boolean) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ enabled }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_seat_cap_enabled');

        if (error) throw error;
        setState((prev) => ({ ...prev, seatCapEnabled: enabled }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setSeatCapEnabled error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // Set seat cap max
  const setSeatCapMax = useCallback(
    async (value: number) => {
      if (!isAdmin) return false;
      try {
        const { error } = await supabase
          .from('admin_settings')
          .update({
            setting_value: JSON.stringify({ value }),
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', 'broadcast_seat_cap_max');

        if (error) throw error;
        setState((prev) => ({ ...prev, seatCapMax: value }));
        return true;
      } catch (err) {
        console.error('[useBroadcastViewerCap] setSeatCapMax error:', err);
        return false;
      }
    },
    [isAdmin],
  );

  // Structured view of the start cap for UI display/early feedback.
  const startCap = useMemo(
    () => ({
      enabled: state.startCapEnabled && !state.allRestrictionsDisabled,
      max: state.startCapMax,
    }),
    [state.startCapEnabled, state.allRestrictionsDisabled, state.startCapMax],
  );

  // Structured view of the seat cap for UI display/early feedback.
  const seatCap = useMemo(
    () => ({
      enabled: state.seatCapEnabled && !state.allRestrictionsDisabled,
      max: state.seatCapMax,
    }),
    [state.seatCapEnabled, state.allRestrictionsDisabled, state.seatCapMax],
  );

  return {
    ...state,
    startCap,
    seatCap,
    isAdmin,
    setViewerCapEnabled,
    setViewerCapMax,
    setStartCapEnabled,
    setStartCapMax,
    setSeatCapEnabled,
    setSeatCapMax,
    setAllRestrictionsDisabled,
    isStreamViewerCapped,
  };
}
