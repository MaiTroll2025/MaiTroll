import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  DollarSign,
  Coins,
  ShoppingCart,
  X,
  TrendingUp,
  Clock,
  ChevronRight,
  Sparkles,
  Zap,
  Star,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { CASHOUT_TIERS, COIN_PACKAGES } from '@/config/coinConfig';
import { formatCoins } from '@/lib/coinMath';
import { toast } from 'sonner';
import CoinStoreModal from '@/components/broadcast/CoinStoreModal';

// Shape of a tier pulled from site_content or fallback
interface PosterTier {
  coins: number;
  usd: number;
  label: string;
  color: string;
  note?: string;
}

interface FloatingPosterProps {
  className?: string;
}

export default function FloatingPoster({ className }: FloatingPosterProps) {
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [activeSection, setActiveSection] = useState<'tiers' | 'weekly' | 'store'>('tiers');

  // Wallet-style cashout state (mirrors Wallet.tsx)
  const [totalCoins, setTotalCoins] = useState(0);
  const [eligibleCoins, setEligibleCoins] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);

  // Coin store modal state — uses same CoinStoreModal as broadcast/viewer quick store
  const [showCoinStore, setShowCoinStore] = useState(false);

  // Admin-editable content from site_content table
  const [posterTiers, setPosterTiers] = useState<PosterTier[]>([]);
  const [posterTitle, setPosterTitle] = useState('Earn & Cash Out');
  const [posterSubtitle, setPosterSubtitle] = useState('MaiTroll Rewards Hub');
  const [featuredPkgIds, setFeaturedPkgIds] = useState<string[]>([
    'pkg-500', 'pkg-1000', 'pkg-2500', 'pkg-5000', 'pkg-10000',
  ]);

  const availableCoins = useMemo(() => {
    return Math.max(0, totalCoins);
  }, [totalCoins]);

  const tierList = useMemo(() => {
    const source = posterTiers.length > 0 ? posterTiers : CASHOUT_TIERS.map((tier) => ({
      coins: tier.coins,
      usd: tier.usd,
      label: tier.label || tier.name || `Tier ${tier.coins}`,
      color: tier.color,
    }));

    return [...source].sort((a, b) => a.coins - b.coins);
  }, [posterTiers]);

  const displayPackages = useMemo(() => {
    const filtered = COIN_PACKAGES.filter((pkg) => featuredPkgIds.includes(pkg.id));
    return filtered.length > 0 ? filtered : COIN_PACKAGES.slice(0, 5);
  }, [featuredPkgIds]);

  const eligibleTier = useMemo(() => {
    return [...tierList].reverse().find((tier) => eligibleCoins >= tier.coins) || null;
  }, [eligibleCoins, tierList]);

  const nextTier = useMemo(() => {
    return tierList.find((tier) => eligibleCoins < tier.coins) || null;
  }, [eligibleCoins, tierList]);

  const progressToNext = useMemo(() => {
    if (!nextTier) return 100;
    return Math.min(100, Math.max(0, (eligibleCoins / nextTier.coins) * 100));
  }, [eligibleCoins, nextTier]);

  useEffect(() => {
    async function loadBalances() {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('troll_coins')
          .eq('id', user.id)
          .single()

        const rawTotal = Number(data?.troll_coins ?? 0)
        const eligibleBalance = Math.max(0, rawTotal)

        setTotalCoins(rawTotal)
        setEligibleCoins(eligibleBalance)
      } catch (err) {
        console.error('[FloatingPoster] Failed to load balances:', err)
      } finally {
        setLoadingBalances(false)
      }
    }

    loadBalances()
  }, [user?.id])

  useEffect(() => {
    const rawTotal = Number(profile?.troll_coins || 0);
    const eligibleBalance = Math.max(0, rawTotal);

    setTotalCoins(rawTotal);
    setEligibleCoins(eligibleBalance);
    setWeeklyEarnings(0);
    setLoadingBalances(false);
  }, [profile]);

  // Fetch admin-managed poster content
  useEffect(() => {
    const fetchPosterContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('title, subtitle, cashout_tiers, featured_packages')
          .eq('content_key', 'homepage_poster')
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.warn('[FloatingPoster] site_content fetch failed, using defaults:', error.message);
        }

        if (data) {
          setPosterTitle(data.title || 'Earn & Cash Out');
          setPosterSubtitle(data.subtitle || 'MaiTroll Rewards Hub');

          if (Array.isArray(data.cashout_tiers) && data.cashout_tiers.length > 0) {
            setPosterTiers(data.cashout_tiers as PosterTier[]);
          }

          if (Array.isArray(data.featured_packages) && data.featured_packages.length > 0) {
            setFeaturedPkgIds(data.featured_packages as string[]);
          }
        }
      } catch (err) {
        console.warn('[FloatingPoster] Error loading poster content:', err);
      }
    };

    fetchPosterContent();

    // Real-time subscription for admin updates
    const channel = supabase
      .channel('site_content_poster')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_content',
          filter: 'content_key=eq.homepage_poster',
        },
        (payload: any) => {
          const data = payload.new;
          if (data) {
            setPosterTitle(data.title || 'Earn & Cash Out');
            setPosterSubtitle(data.subtitle || 'MaiTroll Rewards Hub');
            if (Array.isArray(data.cashout_tiers) && data.cashout_tiers.length > 0) {
              setPosterTiers(data.cashout_tiers as PosterTier[]);
            }
            if (Array.isArray(data.featured_packages) && data.featured_packages.length > 0) {
              setFeaturedPkgIds(data.featured_packages as string[]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleQuickBuy = useCallback(
    (pkg: typeof COIN_PACKAGES[number]) => {
      if (!user?.id) {
        navigate('/auth');
        return;
      }
      setShowCoinStore(true);
    },
    [user?.id, navigate]
  );

  // Handlers
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
        <X className="w-3.5 h-3.5" />
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
            <h3 className="text-sm font-bold text-white leading-tight">{posterTitle}</h3>
            <p className="text-[10px] text-slate-400 leading-tight">{posterSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="relative px-3 pb-2">
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {([
            { key: 'tiers' as const, label: 'Cashout', icon: DollarSign },
            { key: 'weekly' as const, label: 'Weekly', icon: TrendingUp },
            { key: 'store' as const, label: 'Buy Coins', icon: ShoppingCart },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                activeSection === key
                  ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Sections */}
      <div className="relative px-4 pb-4">
        {/* ═══ CASHOUT TIERS SECTION ═══ */}
        {activeSection === 'tiers' && (
          <div className="space-y-2.5">
            {loadingBalances ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Current tier progress — uses eligible coins like Wallet.tsx */}
                <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-400">Eligible Coins</span>
                    {eligibleTier && (
                      <span className="text-xs font-bold" style={{ color: eligibleTier.color }}>
                        {eligibleTier.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold text-white">
                      {eligibleCoins.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">coins</span>
                  </div>
                  {availableCoins !== eligibleCoins && (
                    <div className="mt-1 text-[9px] text-slate-500">
                      {availableCoins.toLocaleString()} available · {totalCoins.toLocaleString()} total
                    </div>
                  )}
                  {nextTier && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">
                          Next: ${nextTier.usd} cashout ({nextTier.label})
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {(nextTier.coins - eligibleCoins).toLocaleString()} to go
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(progressToNext, 100)}%`,
                            background:
                              'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {!nextTier && eligibleTier && (
                    <div className="mt-2 text-[10px] text-green-400 font-medium">
                      ✓ Max tier reached!
                    </div>
                  )}
                </div>

                {/* Tier list */}
                <div className="space-y-1">
                  {tierList.slice(0, 5).map((tier, i) => {
                    const isUnlocked = eligibleCoins >= tier.coins;
                    const isNext = nextTier?.coins === tier.coins;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                          isNext
                            ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/20'
                            : isUnlocked
                              ? 'bg-white/[0.03]'
                              : 'bg-white/[0.01] opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: isUnlocked ? tier.color : 'rgba(100,100,100,0.4)',
                              boxShadow: isUnlocked ? `0 0 6px ${tier.color}40` : 'none',
                            }}
                          />
                          <span className={isUnlocked ? 'text-slate-200' : 'text-slate-500'}>
                            {formatCoins(tier.coins)} coins
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isUnlocked ? 'text-green-400' : 'text-slate-500'}`}>
                            ${tier.usd}
                          </span>
                          {isNext && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full font-medium">
                              NEXT
                            </span>
                          )}
                          {isUnlocked && !isNext && (
                            <span className="text-[9px] text-green-500">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => navigate('/mai-pay')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-green-600/80 to-emerald-600/80 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-semibold transition-all"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Go to Mai Pay
                  <ChevronRight className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )}

        {/* ═══ WEEKLY PAY SECTION ═══ */}
        {activeSection === 'weekly' && (
          <div className="space-y-2.5">
            <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">This Week</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {formatCoins(weeklyEarnings)}
                </span>
                <span className="text-[10px] text-slate-400">coins earned</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                ≈ ${((weeklyEarnings / 100) * 0.033).toFixed(2)} est. value
              </div>
            </div>

            {/* Weekly breakdown */}
            <div className="space-y-1.5">
              {[
                { label: 'Gifts Received', value: '70%', color: 'from-pink-500 to-rose-500' },
                { label: 'Battle Winnings', value: '15%', color: 'from-yellow-500 to-orange-500' },
                { label: 'Missions & Tasks', value: '10%', color: 'from-cyan-500 to-blue-500' },
                { label: 'Other', value: '5%', color: 'from-slate-400 to-slate-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-slate-400">{item.label}</span>
                      <span className="text-[10px] text-slate-300 font-medium">{item.value}</span>
                    </div>
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                        style={{ width: item.value }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 rounded-lg p-2.5 border border-purple-500/10">
              <div className="flex items-start gap-2">
                <Star className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    <span className="font-semibold text-white">Weekly payouts</span> are processed
                    on request. Reach a cashout tier to unlock instant payout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ QUICK COIN STORE SECTION ═══ */}
        {activeSection === 'store' && (
          <div className="space-y-2.5">
            <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-semibold text-white">Quick Buy</span>
              </div>
              <p className="text-[10px] text-slate-400">Pay with PayPal — instant coin delivery</p>
            </div>

            <div className="space-y-1">
              {displayPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleQuickBuy(pkg)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-purple-500/20 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-yellow-400 group-hover:text-yellow-300" />
                    <div className="text-left">
                      <span className="text-[11px] font-semibold text-white block leading-tight">
                        {pkg.label}
                      </span>
                      <span className="text-[9px] text-slate-500">{pkg.coins.toLocaleString()} coins</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-green-400">${pkg.usdPrice.toFixed(0)}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/store')}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              View Full Store
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="h-0.5 w-full"
        style={{
          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 25%, #ec4899 50%, #8b5cf6 75%, #06b6d4 100%)',
        }}
      />

      <CoinStoreModal
        isOpen={showCoinStore}
        onClose={() => setShowCoinStore(false)}
        allowCardPayment={false}
      />
    </div>
  );
}
