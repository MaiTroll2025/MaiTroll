import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import { toast } from 'sonner';
import { Car, ArrowLeft, DollarSign, Info, X, Warehouse, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCoins } from '../lib/hooks/useCoins';
import { useVehicleAssets } from '../lib/hooks/useVehicleAssets';
import { formatCompactNumber } from '../lib/utils';
import type { VehicleCatalogItem } from '../types/vehicleAssets';
import { TIER_COLORS, TIER_BG_COLORS } from '../types/vehicleAssets';

function isValidFutureDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date > new Date();
}

export default function CarDealership() {
  const navigate = useNavigate();
  const { troll_coins: balance, refreshCoins } = useCoins();
  const { user, profile, refreshProfile } = useAuthStore();
  const { catalog, purchaseVehicle, isPurchasing } = useVehicleAssets();

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCatalogItem | null>(null);

  const openVehicle = (vehicle: VehicleCatalogItem) => {
    setSelectedVehicle(vehicle)
    // Bring the user to the top so the modal is always visible (especially on
    // mobile where the grid can be scrolled far down before tapping a car).
    try {
      window.scrollTo({ top: 0, behavior: 'auto' })
      const scroller = document.querySelector('.app-viewport main') as HTMLElement | null
      if (scroller) scroller.scrollTop = 0
    } catch {
      /* ignore */
    }
  };

  const handlePurchase = async () => {
    if (!user || !selectedVehicle) return;

    if ((balance || 0) < selectedVehicle.base_price) {
      toast.error(`Insufficient funds. You need ${formatCompactNumber(selectedVehicle.base_price)} coins.`);
      return;
    }

    const hasCarInsurance = isValidFutureDate(profile?.car_insurance_expiry);
    if (!hasCarInsurance) {
      toast.error('You must purchase car insurance before buying a vehicle.');
      navigate('/insurance');
      return;
    }

    try {
      const result = await purchaseVehicle(selectedVehicle.vehicle_id);

      if (!result.success) {
        toast.error(result.error || 'Purchase failed');
        return;
      }

      toast.success(`Congratulations! You purchased a ${result.vehicle_name}!`);
      await refreshProfile();
      await refreshCoins();
      setSelectedVehicle(null);
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err.message || 'Failed to process purchase');
    }
  };

  const getStockLabel = (quantity: number) => {
    if (quantity >= 999999) return { text: 'Unlimited', color: 'text-green-400' };
    if (quantity > 10) return { text: `${quantity} in stock`, color: 'text-blue-400' };
    if (quantity > 0) return { text: `Only ${quantity} left!`, color: 'text-orange-400' };
    return { text: 'Out of Stock', color: 'text-red-400' };
  };

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
                Mai Troll Auto Mall
              </h1>
              <p className={MaiTrollTheme.text.secondary}>Premium vehicles for the discerning collector. {catalog.length} vehicles available.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/garage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10 border ${MaiTrollTheme.borders.glass}`}
          >
            <Warehouse className="w-5 h-5" />
            <span className="hidden sm:inline">My Garage</span>
          </button>
        </div>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalog.length === 0 ? (
            <div className={`col-span-full p-8 text-center rounded-lg border ${MaiTrollTheme.borders.glass}`}>
              <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className={MaiTrollTheme.text.muted}>No vehicles in stock at this time.</p>
            </div>
          ) : (
            catalog.map((vehicle) => {
              const stock = getStockLabel(vehicle.stock_quantity);
              const tierColor = TIER_COLORS[vehicle.tier as keyof typeof TIER_COLORS] || TIER_COLORS.Common;
              const tierBg = TIER_BG_COLORS[vehicle.tier as keyof typeof TIER_BG_COLORS] || TIER_BG_COLORS.Common;
              const isOutOfStock = vehicle.stock_quantity === 0;

              return (
                <div
                  key={vehicle.vehicle_id}
                  className={`${MaiTrollTheme.components.card} group !p-0 overflow-hidden ${isOutOfStock ? 'opacity-60' : ''}`}
                >
                  {/* Image Placeholder */}
                  <div className={`h-48 ${MaiTrollTheme.backgrounds.card} flex items-center justify-center relative border-b ${MaiTrollTheme.borders.glass}`}>
                    {vehicle.image_url ? (
                      <img src={vehicle.image_url} alt={vehicle.name} className="w-full h-full object-cover" />
                    ) : (
                      <Car className={`w-16 h-16 ${MaiTrollTheme.text.muted} group-hover:text-purple-500 transition`} />
                    )}
                    {/* Tier Badge */}
                    <div className={`absolute top-2 left-2 ${tierBg} px-2 py-1 rounded text-xs font-bold border ${tierColor} backdrop-blur-sm`}>
                      {vehicle.tier}
                    </div>
                    {/* Stock Badge */}
                    <div className={`absolute top-2 right-2 ${MaiTrollTheme.backgrounds.card} px-2 py-1 rounded text-xs font-medium border ${MaiTrollTheme.borders.glass} backdrop-blur-sm ${stock.color}`}>
                      {stock.text}
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className={`text-xl font-bold ${MaiTrollTheme.text.primary}`}>{vehicle.name}</h3>
                      {vehicle.description && (
                        <p className={`text-sm ${MaiTrollTheme.text.muted} mt-1`}>{vehicle.description}</p>
                      )}
                    </div>

                    <div className={`space-y-2 text-sm ${MaiTrollTheme.text.muted} bg-black/20 p-3 rounded-lg border ${MaiTrollTheme.borders.glass}`}>
                      <div className="flex justify-between">
                        <span>Price</span>
                        <span className="text-yellow-400 font-mono font-bold">{formatCompactNumber(vehicle.base_price)} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sell Value</span>
                        <span className="text-green-400 font-mono">{formatCompactNumber(vehicle.buyback_value)} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Buyback Rate</span>
                        <span className="text-blue-400">{vehicle.buyback_percentage}%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openVehicle(vehicle)}
                      disabled={isPurchasing || isOutOfStock}
                      className={`w-full py-3 ${isOutOfStock ? 'bg-gray-700 cursor-not-allowed' : MaiTrollTheme.gradients.button} rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5`}
                    >
                      {isOutOfStock ? (
                        'Out of Stock'
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          View Deal
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-20 sm:items-center sm:pt-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col md:flex-row">

            {/* Left: Vehicle Preview */}
            <div className="w-full md:w-2/5 bg-gradient-to-br from-gray-800 to-black p-6 flex flex-col items-center justify-center relative">
              {selectedVehicle.image_url && (
                <img
                  src={selectedVehicle.image_url}
                  alt={selectedVehicle.name}
                  className="w-full object-contain drop-shadow-xl"
                />
              )}
              {!selectedVehicle.image_url && (
                <Car className="w-32 h-32 text-gray-600" />
              )}
              <div className="mt-4 text-center">
                <h3 className="text-xl font-bold text-white">{selectedVehicle.name}</h3>
                <p className="text-sm text-gray-400">{selectedVehicle.tier} Class</p>
              </div>
            </div>

            {/* Right: Details & Purchase */}
            <div className="w-full md:w-3/5 p-6 flex flex-col relative">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Purchase Summary</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Vehicle Price</span>
                      <span className="font-mono text-yellow-400 font-bold text-lg">{formatCompactNumber(selectedVehicle.base_price)} TC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Instant Sell Value</span>
                      <span className="font-mono text-green-400">{formatCompactNumber(selectedVehicle.buyback_value)} TC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Buyback Rate</span>
                      <span className="font-mono text-blue-400">{selectedVehicle.buyback_percentage}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-purple-900/20 border border-purple-500/20 rounded-lg text-xs text-purple-200 space-y-1">
                  <p className="flex items-center gap-2 font-bold"><Sparkles size={14}/> Vehicle Asset Info</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-80">
                    <li>This vehicle becomes a collectible asset in your garage</li>
                    <li>You can sell it back anytime for {selectedVehicle.buyback_percentage}% of purchase price</li>
                    <li>Higher tier vehicles may have better buyback rates</li>
                    <li>Limited vehicles may increase in value over time</li>
                  </ul>
                </div>

                {(balance || 0) < selectedVehicle.base_price && (
                  <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-200">
                    <p className="font-bold">Insufficient Funds</p>
                    <p className="opacity-80">You need {formatCompactNumber(selectedVehicle.base_price - (balance || 0))} more coins to purchase this vehicle.</p>
                  </div>
                )}

                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                  <div className="text-sm text-gray-400">Total Cost</div>
                  <div className="text-2xl font-bold text-yellow-400 font-mono">
                    {formatCompactNumber(selectedVehicle.base_price)} TC
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setSelectedVehicle(null); }}
                  disabled={isPurchasing}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={isPurchasing || (balance || 0) < selectedVehicle.base_price}
                  className="flex-[2] px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/30 disabled:opacity-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isPurchasing ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <DollarSign size={18} /> Purchase Now
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
