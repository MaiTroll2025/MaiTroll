import React, { memo } from 'react';
import './theme-effect-layer.css';
import type { ThemeEffectType } from './themeEffectMap';

function ThemeEffectLayerInner({
  effectType,
  accentColor,
  isBattle = false,
}: {
  effectType: ThemeEffectType;
  accentColor: string;
  isBattle?: boolean;
}) {
  const style = { ['--theme-accent' as string]: accentColor } as React.CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={`tc-theme-fx tc-theme-fx--${effectType} ${isBattle ? 'tc-theme-fx--battle' : ''}`}
      style={style}
    >
      {effectType === 'cashfall-storm' && (
        <>
          <div className="fx fx-money-rain" />
          <div className="fx fx-money-rain fx-money-rain--alt" />
          <div className="fx fx-coin-sheen" />
          <div className="fx fx-green-pulse" />
        </>
      )}

      {effectType === 'money-rain-vault' && (
        <>
          <div className="fx fx-gold-rain" />
          <div className="fx fx-gold-rain fx-gold-rain--alt" />
          <div className="fx fx-vault-sweep" />
          <div className="fx fx-vault-glow" />
        </>
      )}

      {effectType === 'smoker-cloud-drift' && (
        <>
          <div className="fx-smoke fx-smoke--a" />
          <div className="fx-smoke fx-smoke--b" />
          <div className="fx-smoke fx-smoke--c" />
        </>
      )}

      {effectType === 'blue-haze-roll' && (
        <>
          <div className="fx-haze fx-haze--a" />
          <div className="fx-haze fx-haze--b" />
          <div className="fx-haze fx-haze--c" />
        </>
      )}

      {effectType === 'crystal-rose-shine' && (
        <>
          <div className="fx fx-crystal-facets" />
          <div className="fx fx-crystal-shimmer" />
          <div className="fx fx-crystal-sparkles" />
        </>
      )}

      {effectType === 'butterfly-glitter-sky' && (
        <>
          <div className="fx fx-glitter-sky" />
          <div className="fx-butterfly fx-butterfly--1" />
          <div className="fx-butterfly fx-butterfly--2" />
          <div className="fx-butterfly fx-butterfly--3" />
        </>
      )}

      {effectType === 'neon-bar-pour' && (
        <>
          <div className="fx fx-neon-liquid" />
          <div className="fx fx-neon-liquid fx-neon-liquid--alt" />
          <div className="fx fx-neon-pour" />
        </>
      )}

      {effectType === 'pink-champagne-lounge' && (
        <>
          <div className="fx fx-champagne-bubbles" />
          <div className="fx fx-champagne-bubbles fx-champagne-bubbles--alt" />
          <div className="fx fx-champagne-sheen" />
        </>
      )}

      {effectType === 'parts-and-pistons' && (
        <>
          <div className="fx fx-piston-grid" />
          <div className="fx fx-piston-grid fx-piston-grid--alt" />
          <div className="fx fx-piston-glow" />
        </>
      )}

      {effectType === 'street-roll-motion' && (
        <>
          <div className="fx fx-street-lanes" />
          <div className="fx fx-street-speed" />
          <div className="fx fx-street-wheel" />
        </>
      )}

      {effectType === 'mic-drop-reactor' && (
        <>
          <div className="fx fx-mic-reactor" />
          <div className="fx fx-mic-beat" />
          <div className="fx fx-mic-notes" />
        </>
      )}

      {effectType === 'note-wave-studio' && (
        <>
          <div className="fx fx-note-wave" />
          <div className="fx fx-note-wave fx-note-wave--alt" />
          <div className="fx fx-note-grid" />
        </>
      )}

      {effectType === 'ceo-gold-premium' && (
        <>
          <div className="fx fx-ceo-gold-aura" />
          <div className="fx fx-ceo-gold-sweep" />
          <div className="fx-crown fx-crown--tl" />
          <div className="fx-crown fx-crown--tr" />
          <div className="fx-crown fx-crown--bl" />
          <div className="fx-crown fx-crown--br" />
        </>
      )}

      {effectType === 'default' && <div className="fx fx-default-ambient" />}
    </div>
  );
}

const ThemeEffectLayer = memo(ThemeEffectLayerInner);

export default ThemeEffectLayer;
