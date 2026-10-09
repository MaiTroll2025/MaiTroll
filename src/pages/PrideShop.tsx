import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useBank as useBankHook } from '@/lib/hooks/useBank';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Lock, ShoppingCart, Sparkles, Palette, CreditCard, Image, User } from 'lucide-react';
import { formatCoins } from '@/lib/coinMath';
import { trackPrideAction } from '@/services/prideChallengeTracker';
import { isPrideMonth } from '@/lib/prideMonth';

const PRIDE_RARITY_COLORS: Record<string, string> = {
  common: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  rare: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  epic: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  legendary: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function ThemePreview({ theme, size = 'large' }: { theme: any; size?: 'small' | 'large' }) {
  const hasImage = !!(theme.preview_url || theme.image_url);
  const bgCss = theme.background_css || '';
  const isSmall = size === 'small';
  const wrapperSize = isSmall ? 'h-11 w-11' : 'h-20 w-20';
  const containerSize = isSmall ? 'h-14 w-14' : 'h-24 w-24';
  const iconSize = isSmall ? 'h-5 w-5' : 'h-8 w-8';

  const gradientMatch = bgCss.match(/linear-gradient\([^)]+\)/)?.[0];
  const radialMatch = bgCss.match(/radial-gradient\([^)]+\)/)?.[0];
  const animStyle = theme.reactive_style === 'pulse' ? 'pulse 4s ease-in-out infinite'
    : theme.reactive_style === 'gradient' ? 'gradientShift 8s linear infinite'
    : theme.reactive_style === 'aurora' ? 'auroraShift 12s ease-in-out infinite'
    : theme.reactive_style === 'prismatic' ? 'prismaticShift 10s linear infinite'
    : theme.reactive_style === 'stars' ? 'starsTwinkle 9s infinite'
    : undefined;

  if (hasImage) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={theme.preview_url || theme.image_url}
          alt={theme.name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  if (theme.reactive_style === 'stars') {
    const starColors = ['#ff0057', '#ff7a00', '#ffd300', '#00d158', '#0096ff', '#7a00ff'];
    return (
      <div className={`relative ${containerSize} mx-auto flex items-center justify-center overflow-hidden rounded-full`}>
        <div className="absolute inset-0 rounded-full" style={{
          background: gradientMatch || 'linear-gradient(90deg, #ff0057, #ff7a00, #ffd300, #00d158, #0096ff, #7a00ff)',
          backgroundSize: '400% 400%',
          animation: animStyle,
          filter: 'blur(3px)',
          opacity: 0.6,
        }} />
        <div className={`relative ${wrapperSize} rounded-full p-[3px]`} style={{
          background: gradientMatch || 'linear-gradient(90deg, #ff0057, #ff7a00, #ffd300, #00d158, #0096ff, #7a00ff)',
          backgroundSize: '400% 400%',
          animation: animStyle,
        }}>
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-900 overflow-hidden">
            {starColors.map((color, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: isSmall ? 3 : 5,
                  height: isSmall ? 3 : 5,
                  background: color,
                  top: `${15 + ((i * 37) % 70)}%`,
                  left: `${10 + ((i * 43) % 80)}%`,
                  animation: `starsTwinkle ${2 + i * 0.7}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                  boxShadow: `0 0 ${isSmall ? 3 : 6}px ${color}`,
                }}
              />
            ))}
            <User className={`${iconSize} text-white/50 relative z-10`} />
          </div>
        </div>
      </div>
    );
  }

  if (theme.reactive_style === 'aurora') {
    return (
      <div className={`relative ${containerSize} mx-auto flex items-center justify-center overflow-hidden rounded-full`}>
        <div className="absolute inset-0 rounded-full" style={{
          background: 'linear-gradient(135deg, #ff4d8d, #ffb14d, #fff44d, #4dff9e, #4db7ff, #b84dff, #ff4d8d)',
          backgroundSize: '600% 600%',
          animation: 'auroraShift 12s ease-in-out infinite',
          filter: 'blur(6px)',
          opacity: 0.6,
        }} />
        <div className="absolute inset-0 rounded-full" style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
          backgroundSize: '200% 200%',
          animation: 'auroraShift 8s ease-in-out infinite reverse',
        }} />
        <div className={`relative ${wrapperSize} rounded-full p-[3px]`} style={{
          background: 'linear-gradient(135deg, #ff4d8d, #ffb14d, #fff44d, #4dff9e, #4db7ff, #b84dff)',
          backgroundSize: '400% 400%',
          animation: 'auroraShift 12s ease-in-out infinite',
        }}>
          <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
            <User className={`${iconSize} text-white/60`} />
          </div>
        </div>
      </div>
    );
  }

  if (theme.reactive_style === 'prismatic') {
    return (
      <div className={`relative ${containerSize} mx-auto flex items-center justify-center overflow-hidden rounded-full`}>
        <div className="absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(from 0deg, #ff6aa3, #ffb86a, #ffe86a, #7ef0a6, #66c7ff, #b06bff, #ff6aa3)',
          animation: 'prismaticShift 10s linear infinite',
          filter: 'blur(5px)',
          opacity: 0.6,
        }} />
        <div className={`relative ${wrapperSize} rounded-full p-[3px]`} style={{
          background: 'conic-gradient(from 0deg, #ff6aa3, #ffb86a, #ffe86a, #7ef0a6, #66c7ff, #b06bff, #ff6aa3)',
          animation: 'prismaticShift 10s linear infinite',
        }}>
          <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
            <User className={`${iconSize} text-white/60`} />
          </div>
        </div>
      </div>
    );
  }

  if (gradientMatch || theme.background_type !== 'image') {
    return (
      <div className={`relative ${containerSize} mx-auto flex items-center justify-center overflow-hidden rounded-full`}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: gradientMatch || radialMatch || 'linear-gradient(90deg, #ff0057, #ff7a00, #ffd300, #00d158, #0096ff, #7a00ff)',
            backgroundSize: '400% 400%',
            animation: animStyle,
            filter: 'blur(3px)',
            opacity: 0.7,
          }}
        />
        <div
          className={`relative ${wrapperSize} rounded-full p-[3px]`}
          style={{
            background: gradientMatch || radialMatch || 'linear-gradient(90deg, #ff0057, #ff7a00, #ffd300, #00d158, #0096ff, #7a00ff)',
            backgroundSize: '400% 400%',
            animation: animStyle,
          }}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-lg">
            <User className={`${iconSize} text-white/60`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${containerSize} mx-auto flex items-center justify-center`}>
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 opacity-40 blur-md"
        style={{ animation: 'pulse 4s ease-in-out infinite' }}
      />
      <div className={`relative ${wrapperSize} rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 p-[2px]`}>
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
          <User className={`${iconSize} text-white/40`} />
        </div>
      </div>
    </div>
  );
}

export default function PrideShop() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { balances, refreshCoins } = useCoins();
  const { creditInfo } = useBankHook();
  const [prideThemes, setPrideThemes] = useState([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState(new Set());
  const [activeThemeId, setActiveThemeId] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [equipping, setEquipping] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useCredit, setUseCredit] = useState(false);

  useEffect(() => {
    if (!isPrideMonth()) navigate('/store');
  }, [navigate]);

  const loadData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: themes } = await supabase
        .from('broadcast_background_themes')
        .select('*')
        .eq('is_active', true)
        .order('price_coins', { ascending: true });

      const pride = (themes || []).filter((t) => {
        const s = (t.slug || '').toLowerCase();
        const n = (t.name || '').toLowerCase();
        return s.includes('pride') || n.includes('pride');
      });
      setPrideThemes(pride);

      const { data: purchases } = await supabase
        .from('user_broadcast_theme_purchases')
        .select('theme_id')
        .eq('user_id', user.id);
      setOwnedThemeIds(new Set((purchases || []).map((p) => p.theme_id)));

      const { data: state } = await supabase
        .from('user_broadcast_theme_state')
        .select('active_theme_id')
        .eq('user_id', user.id)
        .maybeSingle();
      setActiveThemeId(state?.active_theme_id || null);
    } catch (err) {
      console.error('[PrideShop] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const canAfford = (price) => {
    if (useCredit) return (creditInfo?.available || 0) >= price;
    return (balances?.troll_coins || 0) >= price;
  };

  const handleBuyTheme = async (theme) => {
    if (!user?.id) { toast.error('Sign in to purchase'); return; }
    const price = theme.price_coins;

    if (!useCredit && (balances?.troll_coins || 0) < price) {
      toast.error(`Not enough Troll Coins. Need ${formatCoins(price)}, have ${formatCoins(balances?.troll_coins || 0)}`);
      return;
    }
    if (useCredit && (creditInfo?.available || 0) < price) {
      toast.error(`Not enough Credit. Need ${formatCoins(price)}, available ${formatCoins(creditInfo?.available || 0)}`);
      return;
    }

    setPurchasing(theme.id);
    try {
      const { data, error } = await supabase.rpc('purchase_broadcast_theme_with_credit', {
        p_user_id: user.id,
        p_theme_id: theme.id,
        p_set_active: true,
        p_use_credit: useCredit,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Purchase failed');

      setOwnedThemeIds((prev) => new Set(prev).add(theme.id));
      setActiveThemeId(theme.id);
      await refreshCoins();
      toast.success(`${theme.name} purchased & equipped!`);
      try { await trackPrideAction(user.id, 'purchase_item'); } catch (_e) { /* silent */ }
      try { await trackPrideAction(user.id, 'equip_frame'); } catch (_e) { /* silent */ }
    } catch (err) {
      toast.error(err?.message || 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const handleEquipTheme = async (theme) => {
    if (!user?.id) return;
    setEquipping(theme.id);
    try {
      const { error } = await supabase.rpc('set_active_broadcast_theme', {
        p_user_id: user.id,
        p_theme_id: theme.id,
      });
      if (error) throw error;
      setActiveThemeId(theme.id);
      toast.success(`${theme.name} equipped!`);
      try { await trackPrideAction(user.id, 'equip_frame'); } catch (_e) { /* silent */ }
    } catch (_err) {
      toast.error('Failed to equip theme');
    } finally {
      setEquipping(null);
    }
  };

  const canUseCredit = (creditInfo?.available || 0) > 0;

  if (!isPrideMonth()) return null;

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes auroraShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes prismaticShift {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes starsTwinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#050715]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/10 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black">Pride Collection</h1>
            <p className="text-xs text-white/60">Limited Edition Profile Frames & Badges</p>
          </div>
          <div className="flex items-center gap-2">
            {useCredit ? (
              <div className="flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 rounded-full px-3 py-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-bold text-purple-300">{formatCoins(creditInfo?.available || 0)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full px-3 py-1">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-300">{formatCoins(balances?.troll_coins || 0)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Payment toggle */}
        {canUseCredit && (
          <button
            onClick={() => setUseCredit(!useCredit)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border mb-6 ${
              useCredit
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {useCredit ? 'Paying with Credit Card' : 'Use Credit Card'}
            <span className="text-xs opacity-70">({formatCoins(creditInfo?.available || 0)} available)</span>
          </button>
        )}

        {/* Rainbow divider */}
        <div className="h-1 w-full rounded-full bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-400 via-blue-500 to-purple-600 mb-6" />

        {/* What are these? Info banner */}
        <div className="rounded-xl border border-pink-400/20 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-cyan-500/5 p-4 mb-6">
          <div className="flex items-start gap-3">
            <Palette className="w-5 h-5 text-pink-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-white mb-1">What are Pride Profile Frames?</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Pride Profile Frames add a colorful animated border effect around your profile picture across the entire site — in the bottom nav bar, on your profile page, in chat, and everywhere your avatar appears. Wear them during June to show your pride and complete challenges!
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
          </div>
        ) : prideThemes.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No Pride frames available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prideThemes.map((theme) => {
              const owned = ownedThemeIds.has(theme.id);
              const isActive = activeThemeId === theme.id;
              const isPurchasing = purchasing === theme.id;
              const isEquipping = equipping === theme.id;
              const affordable = canAfford(theme.price_coins);
              const rarityClass = PRIDE_RARITY_COLORS[theme.rarity] || PRIDE_RARITY_COLORS.common;

              return (
                <div
                  key={theme.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isActive ? 'border-green-400/40 bg-green-500/5' : 'border-white/10 bg-white/[0.03] hover:border-purple-400/30'
                  }`}
                >
                  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 to-purple-600" />

                  {/* Preview area — shows the frame effect on a sample avatar */}
                  <div className="relative p-4 pb-0">
                    <div className="flex items-center justify-center py-4 rounded-xl bg-slate-900/50 border border-white/5 mb-3">
                      <ThemePreview theme={theme} size="large" />
                    </div>
                  </div>

                  <div className="p-4 pt-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-black text-white">{theme.name}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${rarityClass}`}>
                        {theme.rarity}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>

                    {theme.description && (
                      <p className="text-sm text-white/50 mb-1">{theme.description}</p>
                    )}

                    <p className="text-[11px] text-white/30 mb-3 flex items-center gap-1">
                      <Image className="w-3 h-3" />
                      Applied to your profile picture across the site
                    </p>

                    <div className="flex items-center justify-between">
                      {owned ? (
                        isActive ? (
                          <span className="flex items-center gap-1 text-green-400 text-sm font-bold">
                            <Check className="w-4 h-4" /> Equipped
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEquipTheme(theme)}
                            disabled={isEquipping}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold text-white transition disabled:opacity-50"
                          >
                            {isEquipping ? 'Equipping...' : 'Equip'}
                          </button>
                        )
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-300 font-black text-base">{formatCoins(theme.price_coins)}</span>
                            {useCredit && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <button
                            onClick={() => handleBuyTheme(theme)}
                            disabled={isPurchasing || !affordable}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg text-sm font-bold text-white hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPurchasing ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : !affordable ? (
                              <><Lock className="w-3.5 h-3.5" /> Need more</>
                            ) : (
                              <><ShoppingCart className="w-3.5 h-3.5" /> Buy</>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom info */}
        <div className="mt-8 rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4 text-center">
          <p className="text-sm text-white/60">
            🏳️‍🌈 All Pride frames are available during June. Purchase and equip frames to complete Pride Challenges and earn bonus XP!
          </p>
        </div>
      </div>
    </div>
  );
}
