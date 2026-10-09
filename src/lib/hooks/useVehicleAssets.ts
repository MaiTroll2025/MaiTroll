// =====================================================
// VEHICLE ASSET SYSTEM - React Hook
// =====================================================
// Hook for managing vehicle assets from the Cars page
// INDEPENDENT from Neighborhood vehicle system
// =====================================================

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import type {
  VehicleCatalogItem,
  UserVehicleAsset,
  VehicleTransaction,
  VehiclePurchaseResult,
  VehicleSaleResult,
  VehicleStats,
  AdminVehicleParams,
  AdminVehicleUpdateParams,
} from '@/types/vehicleAssets';

// Query keys for cache management
export const vehicleAssetKeys = {
  all: ['vehicleAssets'] as const,
  catalog: () => [...vehicleAssetKeys.all, 'catalog'] as const,
  userAssets: () => [...vehicleAssetKeys.all, 'userAssets'] as const,
  transactions: () => [...vehicleAssetKeys.all, 'transactions'] as const,
  stats: () => [...vehicleAssetKeys.all, 'stats'] as const,
};

// =====================================================
// Hook: useVehicleAssets
// Main hook for vehicle asset operations
// =====================================================
export function useVehicleAssets() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch vehicle catalog
  const catalogQuery = useQuery({
    queryKey: vehicleAssetKeys.catalog(),
    queryFn: async (): Promise<VehicleCatalogItem[]> => {
      const { data, error } = await supabase.rpc('get_vehicle_catalog');
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 30000, // 30 seconds
  });

  // Fetch user's owned vehicles
  const userAssetsQuery = useQuery({
    queryKey: vehicleAssetKeys.userAssets(),
    queryFn: async (): Promise<UserVehicleAsset[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc('get_user_vehicle_assets');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 10000, // 10 seconds
  });

  // Fetch transaction history
  const transactionsQuery = useQuery({
    queryKey: vehicleAssetKeys.transactions(),
    queryFn: async (): Promise<VehicleTransaction[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc('get_vehicle_transactions', {
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 10000,
  });

  // Purchase vehicle mutation
  const purchaseMutation = useMutation({
    mutationFn: async (vehicleId: string): Promise<VehiclePurchaseResult> => {
      const { data, error } = await supabase.rpc('purchase_vehicle_asset', {
        p_vehicle_id: vehicleId,
      });
      if (error) throw error;
      return data as VehiclePurchaseResult;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.userAssets() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.catalog() });
    },
  });

  // Sell vehicle mutation
  const sellMutation = useMutation({
    mutationFn: async (assetId: string): Promise<VehicleSaleResult> => {
      const { data, error } = await supabase.rpc('sell_vehicle_asset', {
        p_asset_id: assetId,
      });
      if (error) throw error;
      return data as VehicleSaleResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.userAssets() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: ['coins'] }); // Refresh coin balance
    },
  });

  // Refresh all data
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.all });
    queryClient.invalidateQueries({ queryKey: ['coins'] });
  }, [queryClient]);

  return {
    // Data
    catalog: catalogQuery.data || [],
    userAssets: userAssetsQuery.data || [],
    transactions: transactionsQuery.data || [],

    // Loading states
    isLoadingCatalog: catalogQuery.isLoading,
    isLoadingAssets: userAssetsQuery.isLoading,
    isLoadingTransactions: transactionsQuery.isLoading,

    // Errors
    catalogError: catalogQuery.error,
    assetsError: userAssetsQuery.error,
    transactionsError: transactionsQuery.error,

    // Mutations
    purchaseVehicle: purchaseMutation.mutateAsync,
    sellVehicle: sellMutation.mutateAsync,

    // Mutation states
    isPurchasing: purchaseMutation.isPending,
    isSelling: sellMutation.isPending,
    purchaseError: purchaseMutation.error,
    sellError: sellMutation.error,

    // Refresh
    refresh,
  };
}

// =====================================================
// Hook: useVehicleAdmin
// Admin hook for managing vehicle catalog
// =====================================================
export function useVehicleAdmin() {
  const queryClient = useQueryClient();

  // Fetch vehicle statistics
  const statsQuery = useQuery({
    queryKey: vehicleAssetKeys.stats(),
    queryFn: async (): Promise<VehicleStats[]> => {
      const { data, error } = await supabase.rpc('admin_get_vehicle_stats');
      if (error) throw error;
      return data || [];
    },
  });

  // Create vehicle mutation
  const createMutation = useMutation({
    mutationFn: async (params: AdminVehicleParams): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.rpc('admin_create_vehicle', {
        p_vehicle_id: params.vehicle_id,
        p_name: params.name,
        p_tier: params.tier || 'Common',
        p_base_price: params.base_price || 0,
        p_buyback_percentage: params.buyback_percentage || 75,
        p_image_url: params.image_url || null,
        p_description: params.description || null,
        p_stock_quantity: params.stock_quantity ?? -1,
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.catalog() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.stats() });
    },
  });

  // Update vehicle mutation
  const updateMutation = useMutation({
    mutationFn: async (params: AdminVehicleUpdateParams): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.rpc('admin_update_vehicle', {
        p_vehicle_id: params.vehicle_id,
        p_name: params.name || null,
        p_tier: params.tier || null,
        p_base_price: params.base_price || null,
        p_buyback_percentage: params.buyback_percentage || null,
        p_image_url: params.image_url || null,
        p_description: params.description || null,
        p_stock_quantity: params.stock_quantity ?? null,
        p_is_active: params.is_active ?? null,
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.catalog() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.stats() });
    },
  });

  // Delete vehicle mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: string): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.rpc('admin_delete_vehicle', {
        p_vehicle_id: vehicleId,
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.catalog() });
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.stats() });
    },
  });

  return {
    // Data
    stats: statsQuery.data || [],
    isLoadingStats: statsQuery.isLoading,
    statsError: statsQuery.error,

    // Mutations
    createVehicle: createMutation.mutateAsync,
    updateVehicle: updateMutation.mutateAsync,
    deleteVehicle: deleteMutation.mutateAsync,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Refresh
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: vehicleAssetKeys.all });
    },
  };
}
