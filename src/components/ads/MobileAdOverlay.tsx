import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { X } from 'lucide-react';
import { CityAd } from '@/types/cityAds';
import { queueCityAdImpression } from '@/lib/batchWrites';
import { shouldShowAds, hasActiveNoAdsSubscription, isAdExcludedPage } from '@/lib/adExemption';

const OVERLAY_SHOWN_KEY = 'tc_mobile_ad_overlay_shown';
const OVERLAY_DURATION_MS = 5000;

export default function MobileAdOverlay() {
  const [ad, setAd] = useState<CityAd | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [shownAt, setShownAt] = useState<number>(0);
  const [countdown, setCountdown] = useState(5);
  const { profile } = useAuthStore();

  const fetchAd = useCallback(async () => {
    if (dismissed) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data: officialAds, error: officialError } = await supabase
        .from('city_ads')
        .select('*')
        .eq('is_active', true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true })
        .limit(5);

      const { data: userAds, error: userError } = await supabase
        .from('user_advertisements')
        .select('*')
        .eq('status', 'approved')
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(5);

      const combined = [
        ...(officialAds || []),
        ...(userAds || []).map(ad => ({
          ...ad,
          cta_text: ad.cta_text || 'Learn More',
          cta_link: ad.link_url,
          priority: 0,
          label: ad.label || 'Sponsored',
          isUserAd: true,
        })),
      ];

      if (combined.length > 0) {
        const randomAd = combined[Math.floor(Math.random() * combined.length)];
        setAd(randomAd as CityAd);
      }
    } catch (e) {
      console.error('[MobileAdOverlay] Failed to fetch ad:', e);
    } finally {
      setLoading(false);
    }
  }, [dismissed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alreadyShown = sessionStorage.getItem(OVERLAY_SHOWN_KEY);
    if (alreadyShown) return;

    if (!shouldShowAds(profile, window.location.pathname)) return;

    if (hasActiveNoAdsSubscription(profile)) return;

    const width = window.visualViewport?.width ?? window.innerWidth;
    const isMobileWidth = width < 768;
    const ua = navigator.userAgent;
    const isDesktopOS = /Windows NT|Macintosh|Mac OS X|Linux x86_64|Linux i686|X11/i.test(ua);
    const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari|CriOS|FxiOS/i.test(ua);
    const isMobile = isMobileWidth && isMobileOS && !isDesktopOS;

    if (!isMobile) return;

    fetchAd();
  }, [fetchAd, profile]);

  useEffect(() => {
    if (!ad) return;

    setShownAt(Date.now());
    setCountdown(Math.ceil(OVERLAY_DURATION_MS / 1000));

    const timer = setTimeout(() => {
      setDismissed(true);
      sessionStorage.setItem(OVERLAY_SHOWN_KEY, 'true');
    }, OVERLAY_DURATION_MS);

    const interval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [ad]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem(OVERLAY_SHOWN_KEY, 'true');
  }, []);

  const handleAdClick = useCallback(async () => {
    if (!ad) return;

    try {
      if (ad.isUserAd) {
        await supabase.rpc('increment_user_ad_clicks', { ad_id: ad.id });
      }
    } catch (e) {
      console.error('[MobileAdOverlay] Failed to track click:', e);
    }

    if (ad.cta_link) {
      if (ad.cta_link.startsWith('/')) {
        window.location.href = ad.cta_link;
      } else {
        window.open(ad.cta_link, '_blank', 'noopener,noreferrer');
      }
    }
  }, [ad]);

  useEffect(() => {
    if (ad && !dismissed) {
      if (ad.isUserAd) {
        queueCityAdImpression(ad.id);
      } else {
        queueCityAdImpression(ad.id);
      }
    }
  }, [ad, dismissed]);

  if (!ad || dismissed || loading) return null;

  const backgroundStyle = ad.background_style
    ? { background: ad.background_style }
    : { background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={backgroundStyle}
    >
      <div className="absolute inset-0">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-800 animate-pulse" />
        )}
        <img
          src={ad.image_url}
          alt={ad.title}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-60' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
        {ad.label && (
          <span className="mb-3 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-purple-600/80 text-white border border-purple-400/30">
            {ad.label}
          </span>
        )}
        <h2 className="text-2xl font-black text-white mb-2 drop-shadow-lg">{ad.title}</h2>
        {ad.subtitle && (
          <p className="text-sm text-purple-200 mb-4 drop-shadow-md">{ad.subtitle}</p>
        )}
        {ad.cta_text && (
          <button
            onClick={handleAdClick}
            className="mt-4 px-6 py-3 rounded-xl font-bold text-sm
              bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
              text-white border border-purple-400/30 shadow-lg shadow-purple-900/30
              transition-all duration-200 hover:scale-105"
          >
            {ad.cta_text}
          </button>
        )}
        <p className="mt-4 text-[10px] text-white/50">
          Skip in {countdown}s
        </p>
      </div>

      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur-md border border-white/10 hover:bg-black/70 hover:text-white transition-all"
        aria-label="Skip ad"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
