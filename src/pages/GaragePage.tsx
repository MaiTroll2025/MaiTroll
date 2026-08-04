import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehicleAssets } from '../lib/hooks/useVehicleAssets';
import { useCoins } from '../lib/hooks/useCoins';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import { toast } from 'sonner';
import {
  Car,
  ArrowLeft,
  DollarSign,
  X,
  TrendingDown,
  Calendar,
  Tag,
  AlertTriangle,
  CheckCircle,
  Store,
  History,
} from 'lucide-react';
import { formatCompactNumber } from '../lib/utils';
import type { UserVehicleAsset } from '../types/vehicleAssets';
import { TIER_COLORS, TIER_BG_COLORS } from '../types/vehicleAssets';
import useSEO from '@/hooks/useSEO';

export default function GaragePage() {
  const navigate = useNavigate();
  const { userAssets, sellVehicle, isSelling, refresh } = useVehicleAssets();
  const { refreshCoins } = useCoins();

  useSEO({
    title: 'Garage | Virtual Vehicle Community | Mai Troll',
    description: 'Manage your virtual garage on Mai Troll. Buy, sell, and trade digital vehicles. View your collection, list vehicles for sale, and join the vehicle community.',
    keywords: [
      'virtual garage', 'online garage', 'vehicle community', 'digital vehicles',
      'MaiTroll garage', 'buy sell vehicles', 'car collection', 'virtual cars',
      'vehicle trading', 'automobile community', 'MaiTroll vehicles'
    ]
  });

  const [selectedAsset, setSelectedAsset] = useState<UserVehicleAsset | null>(null);
  const [showSellConfirm, setShowSellConfirm] = useState(false);

  const handleSellClick = (asset: UserVehicleAsset) => {
    setSelectedAsset(asset);
    setShowSellConfirm(true);
  };

  const handleConfirmSell = async () => {
    if (!selectedAsset) return;

    try {
      const result = await sellVehicle(selectedAsset.id);

      if (!result.success) {
        toast.error(result.error || 'Sale failed');
        return;
      }

      toast.success(`Sold ${result.vehicle_name} for ${formatCompactNumber(result.buyback_value || 0)} coins!`);
      await refreshCoins();
      setShowSellConfirm(false);
      setSelectedAsset(null);
      refresh();
    } catch (err: any) {
      console.error('Sale error:', err);
      toast.error(err.message || 'Failed to sell vehicle');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalValue = userAssets.reduce((sum, asset) => sum + asset.buyback_value, 0);
  const totalInvested = userAssets.reduce((sum, asset) => sum + asset.purchase_price, 0);
  const totalProfitLoss = totalValue - totalInvested;

  return (
    <div className={`min-h-screen p-6 pb-24 ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
      {/* Background Overlays */}
      <div className={`fixed inset-0 pointer-events-none ${MaiTrollTheme.overlays.radialPurple}`} />
      <div className={`fixed inset-0 pointer-events-none ${MaiTrollTheme.overlays.radialPink}`} />

      <div className="relative max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className={`text-3xl font-bold ${MaiTrollTheme.gradients.text}`}>
                My Garage
              </h1>
              <p className={MaiTrollTheme.text.secondary}>Your vehicle collection. {userAssets.length} vehicles owned.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/vehicle-transactions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10 border ${MaiTrollTheme.borders.glass}`}
            >
              <History className="w-5 h-5" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              onClick={() => navigate('/ktauto')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10 border ${MaiTrollTheme.borders.glass}`}
            >
              <Store className="w-5 h-5" />
              <span className="hidden sm:inline">Dealership</span>
            </button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${MaiTrollTheme.components.card} p-4`}>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Tag className="w-4 h-4" />
              Total Invested
            </div>
            <div className="text-2xl font-bold text-yellow-400 font-mono">
              {formatCompactNumber(totalInvested)} 🪙
            </div>
          </div>
          <div className={`${MaiTrollTheme.components.card} p-4`}>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Current Value
            </div>
            <div className="text-2xl font-bold text-green-400 font-mono">
              {formatCompactNumber(totalValue)} 🪙
            </div>
          </div>
          <div className={`${MaiTrollTheme.components.card} p-4`}>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <TrendingDown className="w-4 h-4" />
              Profit/Loss
            </div>
            <div className={`text-2xl font-bold font-mono ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfitLoss >= 0 ? '+' : ''}{formatCompactNumber(totalProfitLoss)} 🪙
            </div>
          </div>
        </div>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userAssets.length === 0 ? (
            <div className={`col-span-full p-12 text-center rounded-lg border ${MaiTrollTheme.borders.glass}`}>
              <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className={`text-xl font-bold ${MaiTrollTheme.text.primary} mb-2`}>Your Garage is Empty</h3>
              <p className={MaiTrollTheme.text.muted}>Visit the dealership to purchase your first vehicle!</p>
              <button
                onClick={() => navigate('/ktauto')}
                className={`mt-4 px-6 py-3 ${MaiTrollTheme.gradients.button} rounded-lg font-bold transition hover:shadow-lg hover:-translate-y-0.5`}
              >
                Browse Vehicles
              </button>
            </div>
          ) : (
            userAssets.map((asset) => {
              const tierColor = TIER_COLORS[asset.tier as keyof typeof TIER_COLORS] || TIER_COLORS.Common;
              const tierBg = TIER_BG_COLORS[asset.tier as keyof typeof TIER_BG_COLORS] || TIER_BG_COLORS.Common;
              const profitLoss = asset.buyback_value - asset.purchase_price;

              return (
                <div
                  key={asset.id}
                  className={`${MaiTrollTheme.components.card} group !p-0 overflow-hidden`}
                >
                  {/* Image Placeholder */}
                  <div className={`h-48 ${MaiTrollTheme.backgrounds.card} flex items-center justify-center relative border-b ${MaiTrollTheme.borders.glass}`}>
                    {asset.image_url ? (
                      <img src={asset.image_url} alt={asset.vehicle_name} className="w-full h-full object-cover" />
                    ) : (
                      <Car className={`w-16 h-16 ${MaiTrollTheme.text.muted} group-hover:text-purple-500 transition`} />
                    )}
                    {/* Tier Badge */}
                    <div className={`absolute top-2 left-2 ${tierBg} px-2 py-1 rounded text-xs font-bold border ${tierColor} backdrop-blur-sm`}>
                      {asset.tier}
                    </div>
                    {/* Status Badge */}
                    <div className={`absolute top-2 right-2 bg-green-500/20 px-2 py-1 rounded text-xs font-bold border border-green-500/50 text-green-400 backdrop-blur-sm`}>
                      Owned
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className={`text-xl font-bold ${MaiTrollTheme.text.primary}`}>{asset.vehicle_name}</h3>
                      <div className="flex items-center gap-2 text-sm mt-1 text-gray-400">
                        <Calendar className="w-3 h-3" />
                        Purchased {formatDate(asset.purchase_date)}
                      </div>
                    </div>

                    <div className={`space-y-2 text-sm ${MaiTrollTheme.text.muted} bg-black/20 p-3 rounded-lg border ${MaiTrollTheme.borders.glass}`}>
                      <div className="flex justify-between">
                        <span>Purchase Price</span>
                        <span className="text-yellow-400 font-mono">{formatCompactNumber(asset.purchase_price)} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Value</span>
                        <span className="text-green-400 font-mono">{formatCompactNumber(asset.buyback_value)} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Profit/Loss</span>
                        <span className={`font-mono ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profitLoss >= 0 ? '+' : ''}{formatCompactNumber(profitLoss)} 🪙
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Buyback Rate</span>
                        <span className="text-blue-400">{asset.buyback_percentage}%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSellClick(asset)}
                      disabled={isSelling}
                      className={`w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Sell for {formatCompactNumber(asset.buyback_value)} 🪙
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sell Confirmation Modal */}
      {showSellConfirm && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Confirm Sale</h3>
                <button
                  onClick={() => setShowSellConfirm(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center py-4">
                <Car className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-bold text-white">{selectedAsset.vehicle_name}</h4>
                <p className="text-sm text-gray-400">{selectedAsset.tier} Class Vehicle</p>
              </div>

              <div className="space-y-3 bg-black/30 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Original Price</span>
                  <span className="text-yellow-400 font-mono">{formatCompactNumber(selectedAsset.purchase_price)} TC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Buyback Rate</span>
                  <span className="text-blue-400">{selectedAsset.buyback_percentage}%</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between">
                  <span className="text-gray-300 font-medium">You Receive</span>
                  <span className="text-green-400 font-bold font-mono text-lg">{formatCompactNumber(selectedAsset.buyback_value)} TC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mai Troll Keeps</span>
                  <span className="text-red-400 font-mono">{formatCompactNumber(selectedAsset.purchase_price - selectedAsset.buyback_value)} TC</span>
                </div>
              </div>

              <div className="p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-lg text-xs text-yellow-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This action cannot be undone. The vehicle will be permanently removed from your garage.</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSellConfirm(false)}
                  disabled={isSelling}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSell}
                  disabled={isSelling}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/30 disabled:opacity-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isSelling ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={18} /> Confirm Sale
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
