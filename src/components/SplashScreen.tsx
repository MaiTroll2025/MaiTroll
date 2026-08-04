import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../lib/store';

const SPLASH_MIN_DURATION_MS = 2500;

const REMOTE_SPLASH_URL =
  'https://chatgpt.com/backend-api/estuary/content?id=file_000000001b4081fbb13aa6b11d69cfe6&cp=pri&ma=90000&ts=20664&p=igh&cid=1&sig=30ecb3e43ae8970d07d56e9c34658c41122c9c050b4d5c88b378c0bbe6595948&v=0';

const LOCAL_SPLASH_URL = '/splash/splash.png';

export default function SplashScreen() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);

  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();

    const tryLoad = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load splash image: ${src}`));
        img.src = src;
      });

    (async () => {
      try {
        await tryLoad(REMOTE_SPLASH_URL);
        if (!cancelled) {
          setImageSrc(REMOTE_SPLASH_URL);
          setImageLoaded(true);
        }
      } catch {
        try {
          await tryLoad(LOCAL_SPLASH_URL);
          if (!cancelled) {
            setImageSrc(LOCAL_SPLASH_URL);
            setImageLoaded(true);
          }
        } catch {
          if (!cancelled) {
            setImageError(true);
            setImageLoaded(true);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  const hide = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    clearTimeout(minTimerRef.current);
    setVisible(false);
    setTimeout(() => setMounted(false), 400);
  }, []);

  useEffect(() => {
    if (!imageLoaded) return;

    setMounted(true);
    setVisible(true);

    const startTime = Date.now();
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - (Date.now() - startTime));

    const tryHide = () => {
      if (!authLoading && !initializedRef.current) {
        hide();
      }
    };

    minTimerRef.current = setTimeout(tryHide, remaining);

    return () => clearTimeout(minTimerRef.current);
  }, [imageLoaded, authLoading, hide]);

  useEffect(() => {
    if (!mounted || !imageLoaded || authLoading || initializedRef.current) return;

    const startTime = Date.now();
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - (Date.now() - startTime));

    const tryHide = () => {
      if (!authLoading && !initializedRef.current) {
        hide();
      }
    };

    clearTimeout(minTimerRef.current);
    minTimerRef.current = setTimeout(tryHide, remaining);

    return () => clearTimeout(minTimerRef.current);
  }, [mounted, imageLoaded, authLoading, hide]);

  useEffect(() => {
    return () => clearTimeout(minTimerRef.current);
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#06030e',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        transition: 'opacity 350ms ease-out',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {!imageError && imageSrc && (
        <img
          src={imageSrc}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      )}
    </div>
  );
}
