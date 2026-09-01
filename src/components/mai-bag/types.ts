export interface MaiBagState {
  bag_id: string
  broadcaster_id?: string
  bag_level: number
  multiplier: number
  current_value: number
  capacity: number
  fill_percent: number
  tier_name: string
  visual_type: string
  completed_count: number
  updated_at: string
  has_bag: boolean
}

export interface MaiBagEvent {
  event_id: string
  bag_id: string
  old_multiplier: number
  new_multiplier: number
  reward_coins: number
  broadcaster_bonus: number
}

export type MaiBagAnimationState = 'idle' | 'filling' | 'full' | 'shaking' | 'breaking' | 'coins' | 'reward' | 'revealing-next'

export interface MaiBagProps {
  streamId: string
  className?: string
  compact?: boolean
  onAnimationComplete?: () => void
}

export interface MaiBagGiftOption {
  id: string
  name: string
  icon?: string | null
  coin_cost?: number | null
  value?: number | null
}

export interface MaiBagProgressProps {
  fillPercent: number
  tier: import('./maiBagConfig').MaiBagTier
  compact?: boolean
}

export interface MaiBagAnimationProps {
  state: MaiBagAnimationState
  tier: import('./maiBagConfig').MaiBagTier
  reward?: {
    coins: number
    bonus: number
    newMultiplier: number
    newTierName: string
  }
  onComplete?: () => void
  compact?: boolean
}
