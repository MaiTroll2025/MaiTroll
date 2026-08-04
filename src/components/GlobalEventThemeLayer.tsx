/**
 * Global Event Theme Layer
 * 
 * Applies event themes to the app without affecting layout.
 * GPU-safe, auto-removes cleanly when event ends.
 */

import React, { useEffect, useMemo } from 'react';
import { useGlobalEvent } from '../contexts/GlobalEventContext';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import type { EventTheme } from '../lib/events/types';

// ============================================================================
// CSS Custom Properties for Event Themes
// ============================================================================

export const getEventCSSVariables = (theme: EventTheme | undefined): Record<string, string> => {
  if (!theme) return {};
  
  const vars: Record<string, string> = {
    '--event-primary': theme.primaryColor,
    '--event-secondary': theme.secondaryColor,
  };
  
  if (theme.cssVariables) {
    Object.assign(vars, theme.cssVariables);
  }
  
  return vars;
};

// ============================================================================
// Event Theme Layer Component
// ============================================================================

interface GlobalEventThemeLayerProps {
  /** Children to wrap */
  children: React.ReactNode;
  /** CSS selector for root element */
  selector?: string;
}

export const GlobalEventThemeLayer: React.FC<GlobalEventThemeLayerProps> = ({
  children,
  selector = ':root',
}) => {
  const { activeEvent, featureFlags } = useGlobalEvent();
  
  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.querySelector(selector);
    if (!root || !(root instanceof HTMLElement)) return;
    
    const vars = getEventCSSVariables(activeEvent?.theme);
    
    // Apply or remove variables
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Cleanup: remove event variables when event ends
    if (!activeEvent?.theme) {
      Object.keys(vars).forEach((key) => {
        root.style.removeProperty(key);
      });
    }
  }, [activeEvent?.theme, selector]);
  
  // Calculate theme classes
  const themeClasses = useMemo(() => {
    if (!activeEvent?.theme) {
      return { background: '', text: '', border: '', button: '', badge: '' };
    }
    
    const t = activeEvent.theme;
    
    return {
      background: t.backgroundAccent,
      text: t.textHighlight,
      border: t.borderAccent,
      button: t.buttonClass || '',
      badge: t.badgeBackground || '',
    };
  }, [activeEvent?.theme]);
  
  // Don't render wrapper if no event theme
  if (!featureFlags.hasEventTheme || !activeEvent?.theme) {
    return <>{children}</>;
  }
  
  return (
    <div 
      className={`event-theme-layer ${themeClasses.background}`}
      data-event-id={activeEvent.id}
      data-event-theme="active"
    >
      {/* GPU-accelerated background effect */}
      {activeEvent.theme.particleEffect && activeEvent.theme.particleEffect !== 'none' && (
        <EventParticles effect={activeEvent.theme.particleEffect} />
      )}
      
      {children}
    </div>
  );
};

// ============================================================================
// GPU-Safe Particle Effects
// ============================================================================

interface EventParticlesProps {
  effect: 'hearts' | 'stars' | 'snow' | 'rainbow' | 'leaves' | 'confetti' | 'none';
}

const EventParticles: React.FC<EventParticlesProps> = ({ effect }) => {
  if (effect === 'none') return null;
  
  const particleEmojis: Record<string, string[]> = {
    hearts: ['❤️', '💕', '💗', '💖', '💓'],
    stars: ['⭐', '✨', '💫', '🌟', '✨'],
    snow: ['❄️', '🌨️', '💠', '🧊', '❅'],
    rainbow: ['🌈', '💖', '💛', '💚', '💙', '💜', '🧡', '❤️'],
    leaves: ['🍂', '🍁', '🌿', '🍃', '🪵'],
    confetti: ['🎊', '🎉', '🧧', '✨', '💫'],
  };
  
  const emojis = particleEmojis[effect] || particleEmojis.stars;
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 event-particles">
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="absolute animate-float-slow opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${15 + Math.random() * 20}s`,
            fontSize: `${0.8 + Math.random() * 1.5}rem`,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  );
};

// ============================================================================
// Theme Hook for Components
// ============================================================================

interface UseEventThemeReturn {
  /** Whether event theme is active */
  isActive: boolean;
  /** Event theme object or undefined */
  theme: EventTheme | undefined;
  /** Primary color */
  primaryColor: string;
  /** Secondary color */
  secondaryColor: string;
  /** Background accent class */
  backgroundAccent: string;
  /** Text highlight class */
  textHighlight: string;
  /** Border accent class */
  borderAccent: string;
  /** Button class */
  buttonClass: string;
  /** Badge background */
  badgeBackground: string;
  /** Particle effect type */
  particleEffect: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEventTheme = (): UseEventThemeReturn => {
  const { activeEvent, featureFlags } = useGlobalEvent();
  
  const theme = activeEvent?.theme;
  
  return {
    isActive: featureFlags.hasEventTheme,
    theme,
    primaryColor: theme?.primaryColor || '',
    secondaryColor: theme?.secondaryColor || '',
    backgroundAccent: theme?.backgroundAccent || '',
    textHighlight: theme?.textHighlight || MaiTrollTheme.text.highlight,
    borderAccent: theme?.borderAccent || '',
    buttonClass: theme?.buttonClass || MaiTrollTheme.buttons.primary,
    badgeBackground: theme?.badgeBackground || '',
    particleEffect: theme?.particleEffect || 'none',
  };
};

// ============================================================================
// Event Theme CSS (injected into document)
// ============================================================================

const cssInjected = false;

// eslint-disable-next-line react-refresh/only-export-components
export const injectEventThemeCSS = (_theme?: EventTheme): void => {
  // Holiday/event themes disabled
  return;
};

// ============================================================================
// Default Export
// ============================================================================

export default GlobalEventThemeLayer;
