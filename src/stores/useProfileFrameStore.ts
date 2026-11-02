/**
 * Profile Frame Store (Zustand)
 * Manages user's owned frames, equipped frame, and frame catalog
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { LAUNCH_FRAMES, type ProfileFrame } from '../config/profileFrames';
import { deductCoins } from '../lib/coinTransactions';
import { invalidateFrameCache } from '../lib/frameCache';

interface UserFrameRecord {
  id: string;
  user_id: string;
  frame_id: string;
  is_equipped: boolean;
  acquired_at: string;
}

interface ProfileFrameState {
  // Catalog (all available frames)
  catalog: ProfileFrame[];
  catalogLoading: boolean;

  // User's owned frames
  ownedFrames: UserFrameRecord[];
  ownedLoading: boolean;

  // Currently equipped frame
  equippedFrameId: string | null;
  equippedFrame: ProfileFrame | null;

  // Actions
  loadCatalog: () => Promise<void>;
  loadUserFrames: (userId: string) => Promise<void>;
  purchaseFrame: (frameId: string) => Promise<boolean>;
  equipFrame: (frameId: string | null) => Promise<boolean>;
  getEquippedFrame: () => ProfileFrame | null;
  isFrameOwned: (frameId: string) => boolean;
}

export const useProfileFrameStore = create<ProfileFrameState>((set, get) => ({
  catalog: LAUNCH_FRAMES,
  catalogLoading: false,
  ownedFrames: [],
  ownedLoading: false,
  equippedFrameId: null,
  equippedFrame: null,

  loadCatalog: async () => {
    set({ catalogLoading: true });
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
        set({ catalog: frames });
      }
    } catch (err) {
      console.warn('[ProfileFrameStore] Failed to load catalog, using defaults', err);
    } finally {
      set({ catalogLoading: false });
    }
  },

  loadUserFrames: async (userId: string) => {
    set({ ownedLoading: true });
    try {
      const { data, error } = await supabase
        .from('user_profile_frames')
        .select('*')
        .eq('user_id', userId);

      if (!error && data) {
        const owned: UserFrameRecord[] = data.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          frame_id: row.frame_id,
          is_equipped: row.is_equipped,
          acquired_at: row.acquired_at,
        }));

        const equipped = owned.find(f => f.is_equipped);
        const equippedFrame = equipped
          ? get().catalog.find(f => f.id === equipped.frame_id) || null
          : null;

        set({
          ownedFrames: owned,
          equippedFrameId: equipped?.frame_id || null,
          equippedFrame,
        });
      }
    } catch (err) {
      console.warn('[ProfileFrameStore] Failed to load user frames', err);
    } finally {
      set({ ownedLoading: false });
    }
  },

  purchaseFrame: async (frameId: string): Promise<boolean> => {
    const { user } = useAuthStore.getState();
    if (!user) return false;

    const frame = get().catalog.find(f => f.id === frameId);
    if (!frame) return false;
    if (get().isFrameOwned(frameId)) return false;

    try {
      // Deduct coins using the secure RPC
      const { success, error: deductError } = await deductCoins({
        userId: user.id,
        amount: frame.coinCost,
        type: 'frame_purchase',
        description: `Purchased Profile Frame: ${frame.name}`,
        metadata: { frame_id: frameId, frame_name: frame.name },
        supabaseClient: supabase,
      });

      if (!success) {
        console.error('[ProfileFrameStore] Coin deduction failed:', deductError);
        return false;
      }

      // Add to user's collection
      const { error: insertError } = await supabase
        .from('user_profile_frames')
        .insert({
          user_id: user.id,
          frame_id: frameId,
          is_equipped: false,
        });

      if (insertError) throw insertError;

      // Reload user frames
      await get().loadUserFrames(user.id);
      return true;
    } catch (err) {
      console.error('[ProfileFrameStore] Purchase failed:', err);
      return false;
    }
  },

  equipFrame: async (frameId: string | null): Promise<boolean> => {
    const { user } = useAuthStore.getState();
    if (!user) return false;

    try {
      // Unequip all current frames
      await supabase
        .from('user_profile_frames')
        .update({ is_equipped: false })
        .eq('user_id', user.id)
        .eq('is_equipped', true);

      if (frameId) {
        // Verify ownership
        if (!get().isFrameOwned(frameId)) return false;

        // Equip the selected frame
        const { error } = await supabase
          .from('user_profile_frames')
          .update({ is_equipped: true })
          .eq('user_id', user.id)
          .eq('frame_id', frameId);

        if (error) throw error;
      }

      // Update profile's active_frame_id
      await supabase
        .from('user_profiles')
        .update({ active_frame_id: frameId })
        .eq('id', user.id);

      // Update local state — find frame in catalog or build minimal object
      let equippedFrame = frameId
        ? get().catalog.find(f => f.id === frameId) || null
        : null;

      // If frame not in catalog (just purchased), fetch from DB and add to catalog
      if (frameId && !equippedFrame) {
        const { data: frameRow } = await supabase
          .from('profile_frames')
          .select('*')
          .eq('id', frameId)
          .maybeSingle();

        if (frameRow) {
          equippedFrame = {
            id: frameRow.id,
            name: frameRow.name,
            description: frameRow.description || '',
            icon: frameRow.icon || '✨',
            animationType: frameRow.animation_type,
            frameStyle: frameRow.frame_style || 'flat',
            borderColor: frameRow.border_color || '#ffffff',
            borderGradient: frameRow.border_gradient || null,
            glowColor: frameRow.glow_color || null,
            glowIntensity: frameRow.glow_intensity ?? 1,
            animationSpeed: frameRow.animation_speed || 'normal',
            hasParticles: frameRow.has_particles ?? false,
            particleColor: frameRow.particle_color || null,
            particleCount: frameRow.particle_count ?? 4,
            hasSparkles: frameRow.has_sparkles ?? false,
            hasEnergyRings: frameRow.has_energy_rings ?? false,
            rarity: frameRow.rarity || 'common',
            coinCost: frameRow.coin_cost ?? 0,
            isActive: frameRow.is_active ?? true,
            isLimited: frameRow.is_limited ?? false,
            limitedQuantity: frameRow.limited_quantity ?? null,
            sortOrder: frameRow.sort_order ?? 0,
          };
          // Add to catalog so future lookups are instant
          set({
            catalog: [...get().catalog, equippedFrame],
          });
        }
      }

      set({
        equippedFrameId: frameId,
        equippedFrame,
        ownedFrames: get().ownedFrames.map(f => ({
          ...f,
          is_equipped: f.frame_id === frameId,
        })),
      });

      // Invalidate the useUserFrame cache so all components re-fetch
      invalidateFrameCache(user.id);

      return true;
    } catch (err) {
      console.error('[ProfileFrameStore] Equip failed:', err);
      return false;
    }
  },

  getEquippedFrame: () => get().equippedFrame,

  isFrameOwned: (frameId: string) => {
    return get().ownedFrames.some(f => f.frame_id === frameId);
  },
}));
