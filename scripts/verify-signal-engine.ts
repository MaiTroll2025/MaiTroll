import assert from 'node:assert/strict'
import {
  calculatePulseScore,
  calculateTrollEnergy,
  getTrollEnergyBand,
  isEligibleForDiscovery,
  rankCandidates,
} from '../src/lib/signalEngine/engine.ts'
import type { SignalCandidate, SignalFeatures } from '../src/lib/signalEngine/types.ts'

const strongFeatures: SignalFeatures = {
  viewerInterest: 0.9,
  watchQuality: 0.9,
  retention: 0.9,
  engagement: 0.8,
  giftQuality: 0.8,
  creatorConsistency: 0.8,
  freshness: 0.8,
  momentum: 0.8,
  exploration: 0.2,
  trust: 1,
  contentQuality: 0.9,
  categoryMatch: 0.9,
  socialProof: 0.7,
  reportPenalty: 0,
  repeatPenalty: 0,
  artificialEngagementPenalty: 0,
}

const weakFeatures: SignalFeatures = {
  ...strongFeatures,
  retention: 0.2,
  watchQuality: 0.2,
  engagement: 0.2,
  giftQuality: 0,
  reportPenalty: 0.2,
}

const eligibility = {
  contentType: 'broadcast' as const,
  contentId: 'broadcast-1',
  creatorId: 'creator-1',
  isPublic: true,
  isDeleted: false,
  isExpired: false,
  isBanned: false,
  eligibilityStatus: 'eligible' as const,
  trustState: 'trusted' as const,
  qualityState: 'accepted' as const,
  hasRequiredMetadata: true,
  isDuplicate: false,
  isRegionRestricted: false,
}

const ineligibleCandidate: SignalCandidate = {
  contentType: 'broadcast',
  contentId: 'private-1',
  creatorId: 'creator-private',
  eligibility: { ...eligibility, contentId: 'private-1', isPublic: false },
  features: strongFeatures,
}

const strongCandidate: SignalCandidate = {
  contentType: 'broadcast',
  contentId: 'broadcast-1',
  creatorId: 'creator-1',
  eligibility,
  features: strongFeatures,
  createdAt: '2026-09-07T12:00:00.000Z',
}

const weakCandidate: SignalCandidate = {
  contentType: 'broadcast',
  contentId: 'broadcast-2',
  creatorId: 'creator-2',
  eligibility: { ...eligibility, contentId: 'broadcast-2', creatorId: 'creator-2' },
  features: weakFeatures,
  createdAt: '2026-09-07T13:00:00.000Z',
}

assert.equal(isEligibleForDiscovery(eligibility), true)
assert.equal(isEligibleForDiscovery(ineligibleCandidate.eligibility), false)
assert.ok(calculatePulseScore(strongFeatures, 'live_now') > calculatePulseScore(weakFeatures, 'live_now'))
assert.equal(getTrollEnergyBand(calculateTrollEnergy(strongFeatures)), 'maximum')

const ranked = rankCandidates([ineligibleCandidate, weakCandidate, strongCandidate], 'live_now')
assert.deepEqual(ranked.map((candidate) => candidate.contentId), ['broadcast-1', 'broadcast-2'])

console.log('Signal Engine verification passed')
