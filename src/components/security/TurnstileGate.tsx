import React, { useEffect, useRef } from 'react';

interface TurnstileGateProps {
  action: string;
  onVerified: (token: string) => void;
  disabled?: boolean;
  className?: string;
}

const TurnstileGate: React.FC<TurnstileGateProps> = ({
  action,
  onVerified,
  disabled = false,
  className = '',
}) => {
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Turnstile site key not configured. TurnstileGate will not render.');
      }
      return;
    }

    // Load the Turnstile script if not already loaded
    if (!(window as any).grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://challenges.cloudflare.com/turnstile/v0/${siteKey}?onload=onloadTurnstileCallback`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      // Define the callback function
      (window as any).onloadTurnstileCallback = () => {
        if (turnstileRef.current) {
          (window as any).turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            action,
            callback: (token: string) => {
              onVerified(token);
            },
          });
        }
      };
    } else if (turnstileRef.current) {
      // If grecaptcha is already loaded, render the widget
      (window as any).turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        action,
        callback: (token: string) => {
          onVerified(token);
        },
      });
    }

    // Cleanup
    return () => {
      if (turnstileRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileRef.current);
      }
    };
  }, [action, onVerified, disabled]);

  if (disabled) {
    return null;
  }

  return <div ref={turnstileRef} className={className} />;
};

export default TurnstileGate;