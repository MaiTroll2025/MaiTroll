import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { SellerTier } from '../../lib/sellerTiers';
import SellerTierBadge from '../../components/SellerTierBadge';
import { toast } from 'sonner';

interface SellerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  seller_tier: SellerTier;
  completed_sales: number;
  positive_reviews: number;
  negative_reviews: number;
  created_at: string;
}

interface SellerReleaseRequest {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
}

interface SellerMarketSummary {
  actualSales: number;
  pendingReleaseRequests: number;
  releaseRequests: SellerReleaseRequest[];
}

export default function SellerManagement() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [sellerMarketSummary, setSellerMarketSummary] = useState<Record<string, SellerMarketSummary>>({});

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          avatar_url,
          seller_tier,
          completed_sales,
          positive_reviews,
          negative_reviews,
          created_at
        `)
        .order('completed_sales', { ascending: false })
        .limit(100);

      if (selectedTier !== 'all') {
        query = query.eq('seller_tier', selectedTier);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSellers(data || []);
    } catch (err) {
      console.error('Error loading sellers:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load current seller profiles.');
    } finally {
      setLoading(false);
    }
  }, [selectedTier]);

  const loadSellerMarketData = useCallback(async (sellerId: string) => {
    setMarketDataLoading(true);
    try {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('marketplace_purchases')
        .select('id, status')
        .eq('seller_id', sellerId)
        .in('status', ['delivered', 'completed']);

      if (purchaseError) throw purchaseError;

      const actualSales = purchaseData?.length ?? 0;

      const { data: requestData, error: requestError } = await supabase
        .from('marketplace_payout_release_requests')
        .select('id, order_id, status, created_at, reviewed_at, admin_notes, rejection_reason')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (requestError) throw requestError;

      const releaseRequests: SellerReleaseRequest[] = (requestData || []).map((request) => ({
        id: request.id,
        order_id: request.order_id,
        status: request.status,
        created_at: request.created_at,
        reviewed_at: request.reviewed_at,
        rejection_reason: request.rejection_reason,
        admin_notes: request.admin_notes,
      }));

      setSellerMarketSummary((prev) => ({
        ...prev,
        [sellerId]: {
          actualSales,
          pendingReleaseRequests: releaseRequests.filter((request) => request.status === 'pending').length,
          releaseRequests,
        },
      }));
    } catch (err) {
      console.error('Error loading marketplace data:', err);
      toast.error(err instanceof Error ? `Failed to load marketplace data: ${err.message}` : 'Failed to load marketplace data');
    } finally {
      setMarketDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSellers();
  }, [selectedTier, loadSellers]);

  useEffect(() => {
    if (selectedSeller) {
      loadSellerMarketData(selectedSeller.id);
    }
  }, [selectedSeller, loadSellerMarketData]);

  const handleManualTierChange = async (sellerId: string, newTier: SellerTier) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ seller_tier: newTier })
        .eq('id', sellerId);

      if (error) throw error;
      
      // Refresh the list
      await loadSellers();
      
      if (selectedSeller && selectedSeller.id === sellerId) {
        setSelectedSeller({ ...selectedSeller, seller_tier: newTier });
      }
    } catch (err) {
      console.error('Error updating tier:', err);
      toast.error(err instanceof Error ? `Failed to update seller tier: ${err.message}` : 'Failed to update seller tier');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSellers = sellers.filter(seller => 
    seller.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierCounts = {
    all: sellers.length,
    enterprise: sellers.filter(s => s.seller_tier === 'enterprise').length,
    merchant: sellers.filter(s => s.seller_tier === 'merchant').length,
    verified_pro: sellers.filter(s => s.seller_tier === 'verified_pro').length,
    verified: sellers.filter(s => s.seller_tier === 'verified').length,
    standard: sellers.filter(s => s.seller_tier === 'standard').length,
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Seller Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search sellers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>
        
        <select
          value={selectedTier}
          onChange={(e) => setSelectedTier(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
        >
          <option value="all">All Tiers ({tierCounts.all})</option>
          <option value="enterprise">Enterprise ({tierCounts.enterprise})</option>
          <option value="merchant">Merchant ({tierCounts.merchant})</option>
          <option value="verified_pro">Verified Pro ({tierCounts.verified_pro})</option>
          <option value="verified">Verified ({tierCounts.verified})</option>
          <option value="standard">Standard ({tierCounts.standard})</option>
        </select>
        
        <button
          onClick={loadSellers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seller List */}
        <div className="lg:col-span-2">
          {loadError && (
            <div role="alert" className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              Failed to load sellers: {loadError}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredSellers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No sellers found</div>
          ) : (
            <div className="space-y-2">
              {filteredSellers.map((seller) => (
                <div
                  key={seller.id}
                  onClick={() => setSelectedSeller(seller)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSeller?.id === seller.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">
                      {seller.avatar_url ? (
                        <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold">
                          {seller.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{seller.username}</span>
                        <SellerTierBadge tier={seller.seller_tier} size="sm" />
                      </div>
                      <div className="text-sm text-gray-500">
                        {seller.completed_sales} stored sales • {seller.positive_reviews + seller.negative_reviews} reviews
                        {' • '}{seller.positive_reviews} positive
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seller Details Panel */}
        <div className="lg:col-span-1">
          {selectedSeller ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">{selectedSeller.username}</h2>
              
              <div className="space-y-4">
                {/* Current Tier */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Current Tier</label>
                  <div className="flex items-center gap-2">
                    <SellerTierBadge tier={selectedSeller.seller_tier} size="lg" showLabel />
                  </div>
                </div>

                {/* Manual Tier Override */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Manual Override</label>
                  <select
                    value={selectedSeller.seller_tier}
                    onChange={(e) => handleManualTierChange(selectedSeller.id, e.target.value as SellerTier)}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    <option value="standard">Standard</option>
                    <option value="verified">Verified</option>
                    <option value="verified_pro">Verified Pro</option>
                    <option value="merchant">Merchant</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Stats */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-medium mb-2">Statistics</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Completed Sales (stored):</div>
                    <div className="font-semibold">{selectedSeller.completed_sales}</div>

                    <div>Actual Marketplace Sales:</div>
                    <div className="font-semibold">
                      {marketDataLoading && !sellerMarketSummary[selectedSeller.id]
                        ? 'Loading...'
                        : sellerMarketSummary[selectedSeller.id]?.actualSales ?? 'N/A'}
                    </div>

                    <div>Pending Release Requests:</div>
                    <div className="font-semibold">
                      {marketDataLoading && !sellerMarketSummary[selectedSeller.id]
                        ? 'Loading...'
                        : sellerMarketSummary[selectedSeller.id]?.pendingReleaseRequests ?? 0}
                    </div>

                    <div>Total Reviews:</div>
                    <div className="font-semibold">{selectedSeller.positive_reviews + selectedSeller.negative_reviews}</div>
                    
                    <div>Positive Reviews:</div>
                    <div className="font-semibold text-green-500">
                      {selectedSeller.positive_reviews}
                    </div>
                    
                    <div>Negative Reviews:</div>
                    <div className="font-semibold text-red-500">
                      {selectedSeller.negative_reviews}
                    </div>
                  </div>
                </div>

                {/* Marketplace Release Requests */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-medium mb-2">Marketplace Release Requests</h3>
                  {marketDataLoading && !sellerMarketSummary[selectedSeller.id] ? (
                    <div className="text-sm text-gray-500">Loading manual release request data...</div>
                  ) : sellerMarketSummary[selectedSeller.id]?.releaseRequests.length ? (
                    <div className="space-y-3 text-sm">
                      {sellerMarketSummary[selectedSeller.id].releaseRequests.map((request) => (
                        <div key={request.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
                          <div className="font-medium">Request {request.id.slice(0, 8)}</div>
                          <div className="text-gray-500">Order: {request.order_id.slice(0, 8)}</div>
                          <div className="text-gray-500">Status: {request.status}</div>
                          <div className="text-gray-500">Created: {new Date(request.created_at).toLocaleString()}</div>
                          {request.status !== 'pending' && request.reviewed_at && (
                            <div className="text-gray-500">Reviewed: {new Date(request.reviewed_at).toLocaleString()}</div>
                          )}
                          {request.rejection_reason && (
                            <div className="text-red-500">Rejected: {request.rejection_reason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No manual release requests found for this seller.</div>
                  )}
                  <div className="mt-3 text-xs text-blue-600 dark:text-blue-300">
                    <a href="/admin/marketplace/release-requests">View all release requests</a>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500">
              Select a seller to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
