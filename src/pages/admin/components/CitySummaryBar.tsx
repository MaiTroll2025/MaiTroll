import React, { useMemo, useState } from 'react'
import { Users, DollarSign, Shield, Award, Activity, TrendingUp, Coins, Zap, Wifi, WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react'

interface CitySummaryBarProps {
  stats: {
    totalUsers: number
    adminsCount: number
    pendingApps: number
    pendingPayouts: number
    trollOfficers: number
    aiFlags: number
    coinSalesRevenue: number
    totalPayouts: number
    feesCollected: number
    platformProfit: number
    totalCoinsInCirculation: number
    totalValue: number
    purchasedCoins: number
    earnedCoins: number
    freeCoins: number
    giftCoins: number
    appSponsoredGifts: number
    total_liability_coins: number
    total_platform_profit_usd: number
    kick_ban_revenue: number
  }
  liveStreamsCount: number
  financeLoading?: boolean
  isConnected?: boolean
  lastSync?: Date | null
  reconciliation?: {
    revenueMatch?: boolean
    purchasesMatch?: boolean
    payoutsMatch: boolean
    balancesMatch?: boolean
    discrepancies: {
      revenue?: number
      purchases?: number
      payouts: number
      balances?: number
    }
  } | null
  onRefreshFinance?: () => void
}

export default function CitySummaryBar({ stats, liveStreamsCount, financeLoading, isConnected, lastSync, reconciliation, onRefreshFinance }: CitySummaryBarProps) {
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null)
  const revenueMatches = reconciliation
    ? (reconciliation.revenueMatch ?? reconciliation.purchasesMatch ?? true)
    : true
  const payoutsMatch = reconciliation?.payoutsMatch ?? true
  const balancesMatch = reconciliation?.balancesMatch ?? true
  const hasMismatch = !!reconciliation && (!revenueMatches || !payoutsMatch || !balancesMatch)

  const money = (value: number) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  const number = (value: number) => Number(value || 0).toLocaleString()

  const summaryItems = useMemo(() => [
    {
      id: 'citizens',
      label: 'Total Citizens',
      value: number(stats.totalUsers),
      icon: <Users className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      details: [
        ['Total citizens', number(stats.totalUsers)],
        ['Admins', number(stats.adminsCount)],
        ['Troll Officers', number(stats.trollOfficers)],
      ],
    },
    {
      id: 'streams',
      label: 'Active Streams',
      value: liveStreamsCount.toString(),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      borderColor: 'border-pink-500/30',
      details: [
        ['Live streams', number(liveStreamsCount)],
        ['Realtime', isConnected ? 'Connected' : 'Disconnected'],
        ['Last sync', lastSync ? lastSync.toLocaleString() : 'Not synced yet'],
      ],
    },
    {
      id: 'revenue',
      label: 'Platform Revenue',
      value: money(stats.coinSalesRevenue),
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      details: [
        ['Coin sales revenue', money(stats.coinSalesRevenue)],
        ['Fees collected', money(stats.feesCollected)],
        ['Total payouts', money(stats.totalPayouts)],
        ['Purchased coins', number(stats.purchasedCoins)],
      ],
    },
    {
      id: 'coins',
      label: 'Coins in Circulation',
      value: number(stats.totalCoinsInCirculation),
      icon: <Coins className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      details: [
        ['Total coins in circulation', number(stats.totalCoinsInCirculation)],
        ['Earned coins', number(stats.earnedCoins)],
        ['Free coins', number(stats.freeCoins)],
        ['Gift coins', number(stats.giftCoins)],
        ['App sponsored gifts', number(stats.appSponsoredGifts)],
      ],
    },
    {
      id: 'applications',
      label: 'Pending Applications',
      value: stats.pendingApps.toString(),
      icon: <Shield className="w-4 h-4" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      details: [
        ['Pending applications', number(stats.pendingApps)],
        ['Pending payouts', number(stats.pendingPayouts)],
        ['AI flags', number(stats.aiFlags)],
      ],
    },
    {
      id: 'officers',
      label: 'Troll Officers',
      value: stats.trollOfficers.toString(),
      icon: <Award className="w-4 h-4" />,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      details: [
        ['Troll Officers', number(stats.trollOfficers)],
        ['Admins', number(stats.adminsCount)],
        ['Total citizens', number(stats.totalUsers)],
      ],
    },
    {
      id: 'profit',
      label: 'Platform Profit',
      value: money(stats.platformProfit),
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      details: [
        ['Platform profit', money(stats.platformProfit)],
        ['Platform profit USD', money(stats.total_platform_profit_usd)],
        ['Kick/ban revenue', money(stats.kick_ban_revenue)],
        ['Coin liability', number(stats.total_liability_coins)],
      ],
    },
    {
      id: 'health',
      label: 'System Health',
      value: '98.5%',
      icon: <Zap className="w-4 h-4" />,
      color: 'text-lime-400',
      bgColor: 'bg-lime-500/20',
      borderColor: 'border-lime-500/30',
      details: [
        ['System health', '98.5%'],
        ['Realtime', isConnected ? 'Connected' : 'Disconnected'],
        ['Finance sync', financeLoading ? 'Syncing' : 'Ready'],
      ],
    }
  ], [financeLoading, isConnected, lastSync, liveStreamsCount, stats])

  const selectedItem = summaryItems.find((item) => item.id === selectedSummary)

  return (
    <div className="bg-gradient-to-r from-[#0A0814] via-[#1a0b2e] to-[#0A0814] border-b border-[#2C2C2C] p-4 mb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            City Summary
          </h2>
          <div className="text-xs text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {summaryItems.map((item, _index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedSummary(item.id)}
              className={`relative text-left ${item.bgColor} ${item.borderColor} border rounded-lg p-3 backdrop-blur-sm hover:scale-105 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-white/30`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`${item.color} group-hover:animate-pulse`}>
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-gray-300 truncate">
                  {item.label}
                </span>
              </div>
              <div className="text-lg font-bold text-white">
                {item.value}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
            </button>
          ))}
        </div>

        {/* Finance Status Bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-xs text-gray-400">
                {isConnected ? 'Realtime Connected' : 'Realtime Disconnected'}
              </span>
            </div>

            {/* Last Sync */}
            {lastSync && (
              <div className="text-xs text-gray-400">
                Last sync: {lastSync.toLocaleTimeString()}
              </div>
            )}

            {/* Loading */}
            {financeLoading && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-xs text-gray-400">Syncing...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Reconciliation Alert */}
            {hasMismatch && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">Finance data needs review</span>
              </div>
            )}

            {/* Refresh Button */}
            {onRefreshFinance && (
              <button
                onClick={onRefreshFinance}
                className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/30 transition-colors"
                disabled={financeLoading}
              >
                <RefreshCw className={`w-3 h-3 ${financeLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>
      {selectedItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4" onClick={() => setSelectedSummary(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111322] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`${selectedItem.color}`}>{selectedItem.icon}</div>
                <h3 className="text-base font-bold text-white">{selectedItem.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="rounded p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close summary details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {selectedItem.details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-sm font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
            {selectedItem.id === 'revenue' || selectedItem.id === 'profit' || selectedItem.id === 'coins' ? (
              <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                These values refresh from the live admin finance summary and realtime finance channels.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
