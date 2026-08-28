export { default as MaiBag } from './MaiBag'
export { default as MaiBagAnimation } from './MaiBagAnimation'
export { default as MaiBagProgress } from './MaiBagProgress'

export {
  MAI_BAG_TIERS,
  BASE_CAPACITY,
  getTierByLevel,
  getTierByMultiplier,
  formatMultiplier,
  getFillPercent,
} from './maiBagConfig'

export type { MaiBagTier } from './maiBagConfig'

export type {
  MaiBagState,
  MaiBagEvent,
  MaiBagAnimationState,
  MaiBagProps,
  MaiBagProgressProps,
  MaiBagAnimationProps,
} from './types'

