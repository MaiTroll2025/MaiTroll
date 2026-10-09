// Animation Components - import for internal use and re-export
import JoinEffect, { JoinEffectsContainer } from './JoinEffect';
import ReactionFloat, { ReactionsFloatContainer } from './ReactionFloat';

import CoinExplosion, { CoinExplosionsContainer } from './CoinExplosion';
import DiamondRain, { DiamondRainsContainer } from './DiamondRain';
import AnimatedButton from './AnimatedButton';
import AnimatedCard from './AnimatedCard';

// Re-export for external use
export { AnimatedButton, AnimatedCard };
export { JoinEffect, JoinEffectsContainer };
export { ReactionFloat, ReactionsFloatContainer };

export { CoinExplosion, CoinExplosionsContainer };
export { DiamondRain, DiamondRainsContainer };

// Main container component that renders all active animations
export function AnimationsContainer() {
  return (
    <>
      <JoinEffectsContainer />
      <ReactionsFloatContainer />

      <CoinExplosionsContainer />
      <DiamondRainsContainer />
    </>
  );
}
