export type FeaturedLivePeriod = 'Live / Current Cycle'

export interface FeaturedBroadcaster {
  stream_id: string
  broadcaster_id: string
  username: string
  avatar_url?: string | null
  current_viewers?: number
  stream_coins?: number
  stream_likes?: number
  featured_score?: number
  featured_rank?: number
  featured_started_at?: string | null
  featured_ends_at?: string | null
  is_featured?: boolean
}

export interface FeaturedLiveState {
  id?: string
  stream_id: string
  broadcaster_id: string
  cycle_id?: string | null
  featured_score?: number
  featured_rank?: number
  featured_started_at?: string | null
  featured_ends_at?: string | null
  is_featured?: boolean
  current_viewers?: number
  stream_coins?: number
  stream_likes?: number
  updated_at?: string | null
}

export interface FeaturedLiveCycle {
  id: string
  cycle_number: number
  status: 'scheduled' | 'active' | 'ended' | 'cancelled'
  started_at?: string | null
  ends_at?: string | null
  winner_stream_id?: string | null
  winner_broadcaster_id?: string | null
  featured_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface FeaturedLiveEvent {
  type: 'featured_started' | 'featured_updated' | 'featured_ended'
  cycle_id?: string | null
  broadcasters: FeaturedBroadcaster[]
  started_at?: string | null
  ends_at?: string | null
}

export interface FeaturedLeaderboardRow {
  rank: number
  username: string
  avatar_url?: string | null
  current_viewers?: number
  stream_coins?: number
  stream_likes?: number
  featured_score?: number
}

export type FeaturedGiftCycleStatus = 'scheduled' | 'active' | 'ended' | 'cancelled'

export interface FeaturedGiftCycle {
  id: string
  cycle_index: number
  status: FeaturedGiftCycleStatus
  current_gift_id?: string | null
  started_at?: string | null
  ends_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface FeaturedGiftLadderItem {
  id: string
  name: string
  price: number
  rarity: string
  animation_type: string
  thumbnail_url?: string | null
  is_active: boolean
}
