import React, { useEffect, useState } from 'react';
import { RefreshCw, Key, TrendingUp, AlertTriangle } from 'lucide-react';
import { getKeySupplyStats, getUserKeyTransactions, getUserSetCompletions } from '../services/keyService';
import type { KeySupply, KeyTransaction, KeySetCompletion } from '../types/keys';

export default function AdminKeysDashboard() {
  const [supplyStats, setSupplyStats] = useState<KeySupply[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<KeyTransaction[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<KeySetCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supply, transactions, completions] = await Promise.all([
        getKeySupplyStats(),
        getUserKeyTransactions('all'), // This would need a special RPC for admin
        getUserSetCompletions('all'), // This would need a special RPC for admin
      ]);
      setSupplyStats(supply);
      // For demo purposes, we'll skip admin-only data
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  const totalIssued = supplyStats.find(s => s.rarity === 'TOTAL');
  const legendaryStats = supplyStats.find(s => s.rarity === 'LEGENDARY');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">🔑 Keys to the City — Admin Dashboard</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Key className="mx-auto h-6 w-6 text-purple-400" />
          <p className="mt-1 text-2xl font-black text-white">{totalIssued?.keys_issued.toLocaleString() || 0}</p>
          <p className="text-xs text-white/50">Keys Issued</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <TrendingUp className="mx-auto h-6 w-6 text-green-400" />
          <p className="mt-1 text-2xl font-black text-white">{totalIssued?.keys_remaining.toLocaleString() || 0}</p>
          <p className="text-xs text-white/50">Keys Remaining</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-yellow-400" />
          <p className="mt-1 text-2xl font-black text-white">{legendaryStats?.key_to_city_issued || 0}</p>
          <p className="text-xs text-white/50">Key to the City Issued</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Key className="mx-auto h-6 w-6 text-orange-400" />
          <p className="mt-1 text-2xl font-black text-white">{legendaryStats?.legendary_issued || 0}</p>
          <p className="text-xs text-white/50">Legendary Issued</p>
        </div>
      </div>

      {/* Supply by Rarity */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Supply by Rarity</h3>
        <div className="space-y-3">
          {supplyStats.filter(s => s.rarity !== 'TOTAL').map(stat => (
            <div key={stat.rarity} className="flex items-center gap-4">
              <div className="w-24 text-sm font-bold text-white">{stat.rarity}</div>
              <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                  style={{ width: `${(stat.keys_issued / Math.max(1, stat.total_supply)) * 100}%` }}
                />
              </div>
              <div className="w-32 text-right text-sm text-white/60">
                {stat.keys_issued.toLocaleString()} / {stat.total_supply.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
