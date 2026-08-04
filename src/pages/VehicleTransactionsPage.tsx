import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehicleAssets } from '../lib/hooks/useVehicleAssets';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, History, Car, Warehouse } from 'lucide-react';
import { formatCompactNumber } from '../lib/utils';

export default function VehicleTransactionsPage() {
  const navigate = useNavigate();
  const { transactions, isLoadingTransactions } = useVehicleAssets();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ArrowDownCircle className="w-5 h-5 text-yellow-400" />;
      case 'sale':
      case 'buyback':
        return <ArrowUpCircle className="w-5 h-5 text-green-400" />;
      default:
        return <History className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'text-yellow-400';
      case 'sale':
      case 'buyback':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'Purchase';
      case 'sale':
        return 'Sale';
      case 'buyback':
        return 'Buyback';
      default:
        return type;
    }
  };

  return (
    <div className={`min-h-screen p-6 pb-24 ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
      {/* Background Overlays */}
      <div className={`fixed inset-0 pointer-events-none ${MaiTrollTheme.overlays.radialPurple}`} />
      <div className={`fixed inset-0 pointer-events-none ${MaiTrollTheme.overlays.radialPink}`} />

      <div className="relative max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className={`text-3xl font-bold ${MaiTrollTheme.gradients.text}`}>
                Vehicle Transactions
              </h1>
              <p className={MaiTrollTheme.text.secondary}>History of all vehicle purchases and sales.</p>
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

        {/* Transaction List */}
        <div className={`${MaiTrollTheme.components.card} overflow-hidden`}>
          {isLoadingTransactions ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className={`mt-4 ${MaiTrollTheme.text.muted}`}>Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className={`text-xl font-bold ${MaiTrollTheme.text.primary} mb-2`}>No Transactions Yet</h3>
              <p className={MaiTrollTheme.text.muted}>Your vehicle transaction history will appear here.</p>
              <button
                onClick={() => navigate('/ktauto')}
                className={`mt-4 px-6 py-3 ${MaiTrollTheme.gradients.button} rounded-lg font-bold transition hover:shadow-lg hover:-translate-y-0.5 inline-flex items-center gap-2`}
              >
                <Car className="w-5 h-5" />
                Visit Dealership
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-white/5 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tx.transaction_type === 'purchase' ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                        {getTransactionIcon(tx.transaction_type)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{tx.vehicle_name}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span className={getTransactionColor(tx.transaction_type)}>
                            {getTransactionLabel(tx.transaction_type)}
                          </span>
                          <span>•</span>
                          <span>{formatDate(tx.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right font-mono font-bold ${getTransactionColor(tx.transaction_type)}`}>
                      {tx.transaction_type === 'purchase' ? '-' : '+'}{formatCompactNumber(Math.abs(tx.amount))} 🪙
                    </div>
                  </div>
                  {/* Additional metadata */}
                  {tx.metadata && (tx.metadata as any).buyback_percentage && tx.transaction_type === 'sale' && (
                    <div className="mt-2 text-xs text-gray-500 flex gap-4">
                      {(tx.metadata as any).purchase_price && (
                        <span>Original: {formatCompactNumber((tx.metadata as any).purchase_price)} 🪙</span>
                      )}
                      {(tx.metadata as any).profit_loss && (
                        <span className={(tx.metadata as any).profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(tx.metadata as any).profit_loss >= 0 ? '+' : ''}{formatCompactNumber((tx.metadata as any).profit_loss)} 🪙
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
