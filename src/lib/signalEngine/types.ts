export type SignalContentType =
  | 'broadcast'
  | 'hytrogame'
  | 'podcast'
  | 'troll_wall_post'
  | 'profile'
  | 'court_session'
  | 'marketplace_listing'
  | 'tcnn_article'

export type SignalSurface =
  | 'live_now'
  | 'for_you'
  | 'gift_momentum'
  | 'hytrogames'
  | 'podcast'
  | 'troll_wall'
  | 'profile_discovery'

export type EligibilityStatus = 'eligible' | 'review' | 'blocked'
export type TrustState = 'trusted' | 'unknown' | 'review' | 'blocked'
export type TrollEnergyBand =
  | 'low'
  | 'building'
  | 'good'
  | 'high'
  | 'maximum'

export interface ContentEligibility {
  contentType: SignalContentType
  contentId: string
  creatorId: string | null
  isPublic: boolean
  isDeleted: boolean
  isExpired: boolean
  isBanned: boolean
  eligibilityStatus: EligibilityStatus
  trustState: TrustState
  qualityState: 'unknown' | 'accepted' | 'rejected'
  hasRequiredMetadata: boolean
  isDuplicate: boolean
  isRegionRestricted: boolean
}

export interface SignalFeatures {
  viewerInterest: number
  watchQuality: number
  retention: number
  engagement: number
  giftQuality: number
  creatorConsistency: number
  freshness: number
  momentum: number
  exploration: number
  trust: number
  contentQuality: number
  categoryMatch: number
  socialProof: number
  reportPenalty: number
  repeatPenalty: number
  artificialEngagementPenalty: number
}

export interface SignalCandidate {
  contentType: SignalContentType
  contentId: string
  creatorId: string | null
  title?: string | null
  eligibility: ContentEligibility
  features: SignalFeatures
  createdAt?: string | null
  isExplorationCandidate?: boolean
}

export interface RankedCandidate extends SignalCandidate {
  pulseScore: number
  trollEnergy: number
  trollEnergyBand: TrollEnergyBand
  rankingReason: string[]
}

export interface RankOptions {
  limit?: number
  maxPerCreator?: number
  includeExploration?: boolean
}

export const SIGNAL_FEATURE_KEYS: readonly (keyof SignalFeatures)[] = [
  'viewerInterest',
  'watchQuality',
  'retention',
  'engagement',
  'giftQuality',
  'creatorConsistency',
  'freshness',
  'momentum',
  'exploration',
  'trust',
  'contentQuality',
  'categoryMatch',
  'socialProof',
  'reportPenalty',
  'repeatPenalty',
  'artificialEngagementPenalty',
]
