/**
 * ProfileFrameContext — Global context for profile frames
 *
 * Provides equipped frame data for any user ID.
 * Caches frame data to avoid repeated DB queries.
 * Automatically fetches frame info when a user ID is requested.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LAUNCH_FRAMES, type ProfileFrame } from '../config/profileFrames';
import { ProfileFrameContext } from '../hooks/useProfileFrameContext';

export interface UserFrameData {
  frameId: string | null;
  frame: ProfileFrame | null;
  loading: boolean;
}

export interface ProfileFrameContextValue {
  /** Get equipped frame data for a user (cached) */
  getUserFrame: (userId: string) => UserFrameData;
  /** Preload frame data for multiple users (e.g. chat participant list) */
  preloadUserFrames: (userIds: string[]) => Promise<void>;
  /** The catalog of all available frames */
  catalog: ProfileFrame[];
  /** Load the catalog */
  loadCatalog: () => Promise<void>;
}

// Cache for user frame data
const frameCache = new Map<string, UserFrameData>();
const pendingRequests = new Map<string, Promise<void>>();

export function ProfileFrameProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<ProfileFrame[]>(LAUNCH_FRAMES);
  const catalogLoaded = useRef(false);

  // Load catalog from DB on mount
  const loadCatalog = useCallback(async () => {
    if (catalogLoaded.current) return;
    catalogLoaded.current = true;
    try {
      const { data, error } = await supabase
        .from('profile_frames')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const frames: ProfileFrame[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          animationType: row.animation_type,
          frameStyle: row.frame_style,
          borderColor: row.border_color,
          borderGradient: row.border_gradient,
          glowColor: row.glow_color,
          glowIntensity: row.glow_intensity,
          animationSpeed: row.animation_speed,
          hasParticles: row.has_particles,
          particleColor: row.particle_color,
          particleCount: row.particle_count,
          hasSparkles: row.has_sparkles,
          hasEnergyRings: row.has_energy_rings,
          rarity: row.rarity,
          coinCost: row.coin_cost,
          isActive: row.is_active,
          isLimited: row.is_limited,
          limitedQuantity: row.limited_quantity,
          sortOrder: row.sort_order,
        }));
        setCatalog(frames);
      }
    } catch (err) {
      console.warn('[ProfileFrameContext] Failed to load catalog', err);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Fetch frame data for a single user
  const fetchUserFrame = useCallback(async (userId: string) => {
    if (frameCache.has(userId)) return;
    if (pendingRequests.has(userId)) {
      await pendingRequests.get(userId);
      return;
    }

    const request = (async () => {
      try {
        // Get the user's equipped frame
        const { data, error } = await supabase
          .from('user_profile_frames')
          .select('frame_id')
          .eq('user_id', userId)
          .eq('is_equipped', true)
          .maybeSingle();

        if (error || !data?.frame_id) {
          frameCache.set(userId, { frameId: null, frame: null, loading: false });
          return;
        }

        const frame = catalog.find((f) => f.id === data.frame_id) || null;
        frameCache.set(userId, { frameId: data.frame_id, frame, loading: false });
      } catch {
        frameCache.set(userId, { frameId: null, frame: null, loading: false });
      }
    })();

    pendingRequests.set(userId, request);
    await request;
    pendingRequests.delete(userId);
  }, [catalog]);

  const getUserFrame = useCallback((userId: string): UserFrameData => {
    if (!userId) return { frameId: null, frame: null, loading: false };

    const cached = frameCache.get(userId);
    if (cached) return cached;

    // Trigger async fetch
    fetchUserFrame(userId);

    return { frameId: null, frame: null, loading: true };
  }, [fetchUserFrame]);

  const preloadUserFrames = useCallback(async (userIds: string[]) => {
    const uncached = userIds.filter((id) => id && !frameCache.has(id));
    if (uncached.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('user_profile_frames')
        .select('user_id, frame_id')
        .in('user_id', uncached)
        .eq('is_equipped', true);

      if (error) {
        // Mark all as no frame
        uncached.forEach((id) => frameCache.set(id, { frameId: null, frame: null, loading: false }));
        return;
      }

      const frameMap = new Map<string, string>();
      (data || []).forEach((row: any) => {
        frameMap.set(row.user_id, row.frame_id);
      });

      uncached.forEach((id) => {
        const frameId = frameMap.get(id);
        const frame = frameId ? catalog.find((f) => f.id === frameId) || null : null;
        frameCache.set(id, { frameId: frameId || null, frame, loading: false });
      });
    } catch {
      uncached.forEach((id) => frameCache.set(id, { frameId: null, frame: null, loading: false }));
    }
  }, [catalog]);

  return (
    <ProfileFrameContext.Provider value={{ getUserFrame, preloadUserFrames, catalog, loadCatalog }}>
      {children}
    </ProfileFrameContext.Provider>
  );
}
