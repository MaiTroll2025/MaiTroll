/**
 * Cloud Storage Plans — Mai Troll
 *
 * Pricing based on actual infrastructure costs + 10% platform margin, rounded to nearest dollar.
 *
 * INFRASTRUCTURE COSTS:
 *   LiveKit Cloud (Ship Plan $50/mo):
 *     - Recording: 5,000 min included, then $0.005/min
 *     - Egress bandwidth: 250 GB included, then $0.12/GB
 *     - Recording storage: included 30 days
 *   Supabase (Pro Plan $25/mo):
 *     - File storage: 100 GB included, then $0.0213/GB
 *
 * EGRESS PRICING (LiveKit $0.12/GB + 10% margin = $0.132/GB → rounded per tier):
 *   Starter:    15 coins/GB  (smallest tier, highest per-GB rate)
 *   Basic:      12 coins/GB
 *   Standard:   10 coins/GB
 *   Pro:         8 coins/GB
 *   Premium:     6 coins/GB
 *   Unlimited:   5 coins/GB  (largest tier, lowest per-GB rate)
 *
 * PACKAGE PRICING = Storage fee + Included egress allowance
 *   Starter:    25 GB storage + 50 GB egress included  → $8/mo
 *   Basic:      50 GB storage + 100 GB egress included → $14/mo
 *   Standard:   100 GB storage + 200 GB egress included → $23/mo
 *   Pro:        200 GB storage + 400 GB egress included → $37/mo
 *   Premium:    500 GB storage + 1,000 GB egress included → $72/mo
 *   Unlimited:  1 TB+ storage + 2,000 GB egress included → $123/mo
 *
 * MATH (all rounded to nearest dollar):
 *   Storage cost = GB × $0.0213 × 1.10
 *   Egress included cost = included_GB × $0.12 × 1.10
 *   Total = storage + egress included
 *
 *   Starter:    (25 × $0.0234) + (50 × $0.132) = $0.59 + $6.60 = $7.19  → $7
 *   Basic:      (50 × $0.0234) + (100 × $0.132) = $1.17 + $13.20 = $14.37 → $14
 *   Standard:   (100 × $0.0234) + (200 × $0.132) = $2.34 + $26.40 = $28.74 → $29
 *   Pro:        (200 × $0.0234) + (400 × $0.132) = $4.68 + $52.80 = $57.48 → $57
 *   Premium:    (500 × $0.0234) + (1000 × $0.132) = $11.70 + $132 = $143.70 → $144
 *   Unlimited:  (1024 × $0.0234) + (2000 × $0.132) = $23.96 + $264 = $287.96 → $288
 */

const STORAGE_TIERS = [
  {
    index: 0,
    id: 'starter',
    label: '25 GB',
    shortLabel: 'Starter',
    storageBytes: 25 * 1024 * 1024 * 1024,
    monthlyFee: 7,
    egressIncludedGB: 50,
    egressPerGBCost: 15,
    description: 'For casual streamers — save a few broadcasts',
    features: [
      '25 GB recording storage',
      '50 GB viewer egress included',
      '~80 hours of recordings',
      '30-day auto-delete',
      'Manual save to profile',
    ],
    highlight: false,
  },
  {
    index: 1,
    id: 'basic',
    label: '50 GB',
    shortLabel: 'Basic',
    storageBytes: 50 * 1024 * 1024 * 1024,
    monthlyFee: 14,
    egressIncludedGB: 100,
    egressPerGBCost: 12,
    description: 'For regular streamers — save weekly broadcasts',
    features: [
      '50 GB recording storage',
      '100 GB viewer egress included',
      '~160 hours of recordings',
      '30-day auto-delete',
      'Manual save to profile',
    ],
    highlight: false,
  },
  {
    index: 2,
    id: 'standard',
    label: '100 GB',
    shortLabel: 'Standard',
    storageBytes: 100 * 1024 * 1024 * 1024,
    monthlyFee: 29,
    egressIncludedGB: 200,
    egressPerGBCost: 10,
    description: 'For daily streamers — keep a full month of content',
    features: [
      '100 GB recording storage',
      '200 GB viewer egress included',
      '~320 hours of recordings',
      '30-day auto-delete',
      'Manual save to profile',
      'Priority support',
    ],
    highlight: true,
  },
  {
    index: 3,
    id: 'pro',
    label: '200 GB',
    shortLabel: 'Pro',
    storageBytes: 200 * 1024 * 1024 * 1024,
    monthlyFee: 57,
    egressIncludedGB: 400,
    egressPerGBCost: 8,
    description: 'For power users — broadcasts + gaming clips',
    features: [
      '200 GB recording storage',
      '400 GB viewer egress included',
      '~640 hours of recordings',
      '30-day auto-delete',
      'Manual save to profile',
      'Priority support',
      'Gaming clip storage included',
    ],
    highlight: false,
  },
  {
    index: 4,
    id: 'premium',
    label: '500 GB',
    shortLabel: 'Premium',
    storageBytes: 500 * 1024 * 1024 * 1024,
    monthlyFee: 144,
    egressIncludedGB: 1000,
    egressPerGBCost: 6,
    description: 'For heavy creators — full archive access',
    features: [
      '500 GB recording storage',
      '1,000 GB viewer egress included',
      '~1,600 hours of recordings',
      '30-day auto-delete',
      'Manual save to profile',
      'Priority support',
      'Gaming clip storage included',
      'Extended replay history',
    ],
    highlight: false,
  },
  {
    index: 5,
    id: 'unlimited',
    label: '1 TB+',
    shortLabel: 'Unlimited',
    storageBytes: 1024 * 1024 * 1024 * 1024,
    monthlyFee: 288,
    egressIncludedGB: 2000,
    egressPerGBCost: 5,
    description: 'Maximum storage — no hard cap on your archives',
    features: [
      '1 TB+ recording storage',
      '2,000 GB viewer egress included',
      'No recording limit',
      '30-day auto-delete',
      'Manual save to profile',
      'Priority support',
      'Gaming clip storage included',
      'Extended replay history',
      'Early access to new features',
    ],
    highlight: false,
  },
];

// Cost reference
const SUPABASE_COST_PER_GB = 0.0213;
const LIVEKIT_EGRESS_COST_PER_GB = 0.12;
const PLATFORM_MARGIN = 1.10;
const AVG_RECORDING_GB_PER_HOUR = 0.3;

module.exports = {
  STORAGE_TIERS,
  SUPABASE_COST_PER_GB,
  LIVEKIT_EGRESS_COST_PER_GB,
  PLATFORM_MARGIN,
  AVG_RECORDING_GB_PER_HOUR,
};
