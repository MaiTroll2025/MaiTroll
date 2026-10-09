import React from 'react';
import type { TrollEvolutionStage, TrollPersonalityState } from '@/types/feedTheTroll';

interface TrollCharacterProps {
  stage: TrollEvolutionStage;
  state: TrollPersonalityState;
  seasonalTheme?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Layered, independently-animated troll. Each part is a separate element so the
 * head lags the body, arms continue after the torso stops, etc. All movement is
 * driven by the `troll-${stage}` and `troll-state-${state}` classes defined in
 * trollAnimations.css — no JS animation loop required.
 */
const TrollCharacter: React.FC<TrollCharacterProps> = ({
  stage = 'baby',
  state = 'idle',
  seasonalTheme,
  className,
}) => {
  const _skin = 'var(--troll-skin, #6b8e23)';
  return (
    <div
      className={`troll-character troll-${stage} troll-state-${state} ${className ?? ''}`}
      data-stage={stage}
      data-state={state}
      role="img"
      aria-label={`Feed the Troll companion (${stage} stage, ${state})`}
    >
      <div className="troll-shadow" />

      {state === 'evolving' && <div className="troll-glow" />}

      <div className="troll-body">
        {/* Outfit / clothing layer */}
        <div className="troll-outfit" />

        {/* Legs */}
        <div className="troll-leg left" />
        <div className="troll-leg right" />

        {/* Arms + hands */}
        <div className="troll-arm left">
          <div className="troll-hand" />
        </div>
        <div className="troll-arm right">
          <div className="troll-hand" />
        </div>

        {/* Head group (lags body via separate animation) */}
        <div className="troll-head">
          <div className="troll-eye left">
            <div className="troll-eyelid" />
          </div>
          <div className="troll-eye right">
            <div className="troll-eyelid" />
          </div>
          <div className="troll-mouth" />

          {stage === 'king' && (
            <div className="troll-crown" style={{ fontSize: '1.1rem' }}>👑</div>
          )}
          {stage === 'warrior' && (
            <div className="troll-crown" style={{ fontSize: '0.9rem' }}>🛡️</div>
          )}
          {seasonalTheme && (
            <div className="troll-hat" style={{ fontSize: '0.85rem' }}>
              {seasonalTheme}
            </div>
          )}
        </div>

        <div className="troll-zzz">z</div>
      </div>
    </div>
  );
};

export default TrollCharacter;
