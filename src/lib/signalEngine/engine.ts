import type {
  ContentEligibility,
  RankedCandidate,
  RankOptions,
  SignalCandidate,
  SignalFeatures,
  SignalSurface,
  TrollEnergyBand,
} from './types'
import { SIGNAL_FEATURE_KEYS } from './types'

const SURFACE_WEIGHTS: Record<SignalSurface, Partial<Record<keyof SignalFeatures, number>>> = {
  live_now: {
    viewerInterest: 0.15,
    watchQuality: 0.25,
    retention: 0.2,
    engagement: 0.1,
    creatorConsistency: 0.1,
    freshness: 0.05,
    momentum: 0.1,
    exploration: 0.05,
  },
  for_you: {
    viewerInterest: 0.3,
    watchQuality: 0.2,
    retention: 0.15,
    categoryMatch: 0.1,
    creatorConsistency: 0.1,
    freshness: 0.05,
    exploration: 0.1,
  },
  gift_momentum: {
    viewerInterest: 0.1,
    watchQuality: 0.15,
    retention: 0.2,
    engagement: 0.15,
    giftQuality: 0.2,
    creatorConsistency: 0.1,
    momentum: 0.05,
    exploration: 0.05,
  },
  hytrogames: {
    viewerInterest: 0.1,
    watchQuality: 0.25,
    retention: 0.2,
    engagement: 0.1,
    freshness: 0.05,
    momentum: 0.15,
    categoryMatch: 0.1,
    exploration: 0.05,
  },
  podcast: {
    viewerInterest: 0.15,
    watchQuality: 0.3,
    retention: 0.2,
    creatorConsistency: 0.1,
    freshness: 0.05,
    categoryMatch: 0.1,
    exploration: 0.1,
  },
  troll_wall: {
    viewerInterest: 0.15,
    watchQuality: 0.25,
    retention: 0.1,
    engagement: 0.2,
    creatorConsistency: 0.1,
    freshness: 0.1,
    categoryMatch: 0.05,
    exploration: 0.05,
  },
  profile_discovery: {
    viewerInterest: 0.2,
    watchQuality: 0.15,
    engagement: 0.15,
    creatorConsistency: 0.2,
    freshness: 0.05,
    categoryMatch: 0.1,
    socialProof: 0.1,
    exploration: 0.05,
  },
}

const POSITIVE_FEATURE_KEYS: readonly (keyof SignalFeatures)[] = [
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
]

const PENALTY_FEATURE_KEYS: readonly (keyof SignalFeatures)[] = [
  'reportPenalty',
  'repeatPenalty',
  'artificialEngagementPenalty',
]

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, minimum), maximum)
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100) * 100) / 100
}

export function isEligibleForDiscovery(eligibility: ContentEligibility): boolean {
  return (
    eligibility.isPublic &&
    !eligibility.isDeleted &&
    !eligibility.isExpired &&
    !eligibility.isBanned &&
    eligibility.eligibilityStatus === 'eligible' &&
    eligibility.trustState !== 'blocked' &&
    eligibility.qualityState === 'accepted' &&
    eligibility.hasRequiredMetadata &&
    !eligibility.isDuplicate &&
    !eligibility.isRegionRestricted
  )
}

export function calculatePulseScore(features: SignalFeatures, surface: SignalSurface): number {
  const weights = SURFACE_WEIGHTS[surface]
  const positiveScore = POSITIVE_FEATURE_KEYS.reduce((total, key) => {
    const weight = weights[key] ?? 0
    return total + clamp(features[key]) * weight
  }, 0)
  const penaltyScore = PENALTY_FEATURE_KEYS.reduce(
    (total, key) => total + clamp(features[key]) * 0.1,
    0,
  )

  return roundScore((positiveScore - penaltyScore) * 100)
}

export function calculateTrollEnergy(features: SignalFeatures): number {
  const score =
    clamp(features.engagement) * 0.2 +
    clamp(features.retention) * 0.25 +
    clamp(features.giftQuality) * 0.15 +
    clamp(features.contentQuality) * 0.15 +
    clamp(features.creatorConsistency) * 0.15 +
    clamp(features.trust) * 0.1 -
    clamp(features.reportPenalty) * 0.05 -
    clamp(features.artificialEngagementPenalty) * 0.1

  return roundScore(score * 100)
}

export function getTrollEnergyBand(score: number): TrollEnergyBand {
  if (score >= 85) return 'maximum'
  if (score >= 70) return 'high'
  if (score >= 50) return 'good'
  if (score >= 25) return 'building'
  return 'low'
}

function buildRankingReason(candidate: SignalCandidate, pulseScore: number): string[] {
  const reasons: string[] = []
  const { features } = candidate

  if (features.retention >= 0.7) reasons.push('strong viewer retention')
  if (features.watchQuality >= 0.7) reasons.push('high watch quality')
  if (features.engagement >= 0.7) reasons.push('active community engagement')
  if (features.giftQuality >= 0.7) reasons.push('healthy gift participation')
  if (features.momentum >= 0.7) reasons.push('rising momentum')
  if (candidate.isExplorationCandidate) reasons.push('new creator discovery')
  if (reasons.length === 0) reasons.push(`pulse score ${pulseScore}`)

  return reasons.slice(0, 3)
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  if (right.pulseScore !== left.pulseScore) return right.pulseScore - left.pulseScore
  if (right.trollEnergy !== left.trollEnergy) return right.trollEnergy - left.trollEnergy
  return (right.createdAt || '').localeCompare(left.createdAt || '')
}

export function rankCandidates(
  candidates: readonly SignalCandidate[],
  surface: SignalSurface,
  options: RankOptions = {},
): RankedCandidate[] {
  const limit = Math.max(1, options.limit ?? 50)
  const maxPerCreator = Math.max(1, options.maxPerCreator ?? 2)
  const includeExploration = options.includeExploration ?? true
  const eligibleCandidates = candidates.filter((candidate) => {
    if (!isEligibleForDiscovery(candidate.eligibility)) return false
    return includeExploration || !candidate.isExplorationCandidate
  })

  const ranked = eligibleCandidates
    .map((candidate) => {
      const pulseScore = calculatePulseScore(candidate.features, surface)
      const trollEnergy = calculateTrollEnergy(candidate.features)
      return {
        ...candidate,
        pulseScore,
        trollEnergy,
        trollEnergyBand: getTrollEnergyBand(trollEnergy),
        rankingReason: buildRankingReason(candidate, pulseScore),
      }
    })
    .sort(compareCandidates)

  const creatorCounts = new Map<string, number>()
  const selected: RankedCandidate[] = []

  for (const candidate of ranked) {
    const creatorKey = candidate.creatorId || `content:${candidate.contentId}`
    const creatorCount = creatorCounts.get(creatorKey) ?? 0
    if (creatorCount >= maxPerCreator) continue
    creatorCounts.set(creatorKey, creatorCount + 1)
    selected.push(candidate)
    if (selected.length >= limit) break
  }

  return selected
}

export function normalizeFeature(value: number | null | undefined): number {
  return clamp(value ?? 0)
}

export function normalizeFeatures(
  features: Partial<SignalFeatures>,
): SignalFeatures {
  const normalized = {} as SignalFeatures
  for (const key of SIGNAL_FEATURE_KEYS) {
    normalized[key] = normalizeFeature(features[key])
  }
  return normalized
}
