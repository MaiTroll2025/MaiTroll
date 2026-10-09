import React from 'react'
import { Loader2 } from 'lucide-react'
import { useAdminFinanceRealtime } from '../../hooks/useAdminFinanceRealtime'

export default function AdminFinanceDashboard() {
  const {
    financeSummary: summary,
    isLoading: loading,
    summaryError: error,
    refetchSummary,
  } = useAdminFinanceRealtime()
  const errorMessage = error instanceof Error ? error.message : null

  const formatNumber = (value?: number | null) => (value ?? 0).toLocaleString()
  const formatCurrency = (value?: number | null) => `$${formatNumber(value)}`

  const summaryItems = [
    {
      label: 'Coin Sales Revenue',
      value: formatCurrency(summary?.economy.coinSalesRevenue),
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Coins in Circulation',
      value: summary ? summary.economy.totalCoinsInCirculation : 0,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10'
    },
    {
      label: 'Gift Coins',
      value: summary ? summary.economy.giftCoins : 0,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10'
    },
    {
      label: 'Payouts',
      value: formatCurrency(summary?.economy.totalPayouts),
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Platform Profit',
      value: formatCurrency(summary?.economy.platformProfit),
      color: 'text-orange-400',
      bg: 'bg-orange-500/10'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Finance Dashboard</p>
          <h1 className="text-3xl font-bold">Platform Finance Overview</h1>
          <p className="text-sm text-gray-400">
            Finance metrics from the current admin finance summary.
          </p>
        </header>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-2xl p-6 shadow-lg shadow-black/40 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading finance metrics...
            </div>
          ) : errorMessage ? (
            <div className="text-red-400">
              {errorMessage}
              <button onClick={() => void refetchSummary()} className="ml-4 text-xs uppercase tracking-wider text-gray-300">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className={`border border-[#2C2C2C] rounded-xl p-4 ${item.bg}`}
                  >
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-400 mb-2">{item.label}</p>
                    <p className={`text-xl font-semibold ${item.color}`}>
                      {typeof item.value === 'number'
                        ? item.value.toLocaleString()
                        : item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="border border-[#2C2C2C] rounded-xl p-5 bg-[#0D0D16]">
                  <h2 className="text-lg font-semibold text-white mb-2">Creator Economy</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    {formatNumber(summary?.economy.giftCoins)} gift coins.
                  </p>
                  <div className="text-xs uppercase tracking-[0.4em] text-gray-400">Creator earned coins</div>
                  <p className="text-xl font-semibold">{formatNumber(summary?.economy.earnedCoins)}</p>
                </div>
                <div className="border border-[#2C2C2C] rounded-xl p-5 bg-[#0D0D16]">
                  <h2 className="text-lg font-semibold text-white mb-2">Pending Payout Requests</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Number of payout requests awaiting processing.
                  </p>
                  <p className="text-xl font-semibold text-orange-300">
                    {formatNumber(summary?.users.pendingPayouts)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
