import { MaiTrollTheme } from '../../styles/trollCityTheme';
import { useGlobalEvent } from '../../contexts/GlobalEventContext';
import type { EventTheme } from './types';

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

interface UseEventThemeReturn {
  isActive: boolean;
  theme: EventTheme | undefined;
  primaryColor: string;
  secondaryColor: string;
  backgroundAccent: string;
  textHighlight: string;
  borderAccent: string;
  buttonClass: string;
  badgeBackground: string;
  particleEffect: string;
}

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

export const injectEventThemeCSS = (_theme?: EventTheme): void => {
  // Holiday/event themes disabled.
};
