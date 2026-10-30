import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Coins, ExternalLink, Loader2, Star, Sparkles } from 'lucide-react';
import { COIN_PACKAGES } from '@/config/coinConfig';

interface FloatingPosterProps {
  className?: string;
}

export default function FloatingPoster({ className }: FloatingPosterProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);

  const availableCoins = useMemo(() => Math.max(0, totalCoins), [totalCoins]);

  const featuredPackages = useMemo(
    () => COIN_PACKAGES.filter((pkg) => ['pkg-500', 'pkg-1000', 'pkg-2500', 'pkg-5000'].includes(pkg.id)),
    [],
  );

  useEffect(() => {
    const rawTotal = Number(profile?.troll_coins || 0);
    setTotalCoins(rawTotal);
    setLoadingBalances(false);
  }, [profile]);

  useEffect(() => {
    async function loadBalances() {
      if (!user?.id) {
        setLoadingBalances(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('troll_coins')
          .eq('id', user.id)
          .single();
        setTotalCoins(Number(data?.troll_coins ?? 0));
      } catch {
        /* ignore */
      } finally {
        setLoadingBalances(false);
      }
    }
    loadBalances();
  }, [user?.id]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem('floating_poster_dismissed', 'true');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('floating_poster_dismissed') === 'true') {
        setDismissed(true);
      }
    } catch {}
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] ${className || ''}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(15,10,40,0.95) 0%, rgba(30,15,60,0.92) 50%, rgba(10,20,50,0.95) 100%)',
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(147,51,234,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Animated shimmer border glow */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, transparent 40%, transparent 60%, rgba(147,51,234,0.10) 100%)',
          animation: 'shimmer-pulse 4s ease-in-out infinite',
        }}
      />

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
      >
        <Star className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="relative px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
              boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">Coin Store</h3>
            <p className="text-[10px] text-slate-400 leading-tight">Buy Troll Coins</p>
          </div>
        </div>
      </div>

      {/* Balance strip */}
      <div className="px-4 pb-3">
        <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] text-slate-400">Your Balance</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white">{loadingBalances ? '—' : availableCoins.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">coins</span>
          </div>
        </div>
      </div>

      {/* Coin packs */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Choose a pack</div>
        <div className="space-y-1">
          {featuredPackages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => {
                if (!user?.id) {
                  navigate('/auth');
                  return;
                }
                navigate(`/coins?pack=${pkg.id}`);
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-purple-500/20 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-yellow-400 group-hover:text-yellow-300" />
                <div className="text-left">
                  <span className="text-[11px] font-semibold text-white block leading-tight">{pkg.label}</span>
                  <span className="text-[9px] text-slate-500">{pkg.coins.toLocaleString()} coins</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-green-400">${pkg.usdPrice.toFixed(0)}</span>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          onClick={() => navigate('/store')}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold transition-all"
        >
          View Full Store
        </button>
      </div>

      {/* Bottom accent line */}
      <div
        className="h-0.5 w-full"
        style={{
          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 25%, #ec4899 50%, #8b5cf6 75%, #06b6d4 100%)',
        }}
      />
    </div>
  );
}
