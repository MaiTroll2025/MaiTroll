export const TROMOCODE_PRODUCT_TYPES = [
  'verified_badge',
  'profile_frame',
  'insurance_plan',
  'perk',
  'all_eligible',
  'coin_pack',
]

export function normalizeTromocode(rawCode) {
  if (rawCode === null || rawCode === undefined) return ''
  return String(rawCode).trim().replace(/\s+/g, '').toUpperCase()
}

export function isTromocodeProductEligible(productType) {
  if (!productType) return false

  const normalized = String(productType).trim().toLowerCase()
  return [
    'verified_badge',
    'profile_frame',
    'insurance_plan',
    'perk',
    'all_eligible',
  ].includes(normalized)
}

export function calculateTromocodeDiscount({
  promotionType,
  promotionValue,
  originalAmount,
}) {
  const original = Number(originalAmount || 0)

  if (Number.isNaN(original) || original <= 0) {
    return {
      originalAmount: 0,
      discountAmount: 0,
      finalAmount: 0,
    }
  }

  const value = Number(promotionValue || 0)

  switch (promotionType) {
    case 'percentage_discount': {
      const discount = Math.min(original, original * (Math.max(0, value) / 100))
      return {
        originalAmount: original,
        discountAmount: Number(discount.toFixed(0)),
        finalAmount: Math.max(0, original - discount),
      }
    }
    case 'fixed_coin_discount': {
      const discount = Math.min(original, Math.max(0, value))
      return {
        originalAmount: original,
        discountAmount: Number(discount.toFixed(0)),
        finalAmount: Math.max(0, original - discount),
      }
    }
    default:
      return {
        originalAmount: original,
        discountAmount: 0,
        finalAmount: original,
      }
  }
}

export function getTromocodePromotionLabel(promotionType, promotionValue) {
  switch (String(promotionType || '').toLowerCase()) {
    case 'percentage_discount':
      return `${Number(promotionValue || 0)}% promotional discount`
    case 'fixed_coin_discount':
      return `${Number(promotionValue || 0)} coin discount`
    case 'free_item':
      return 'Free item'
    case 'bonus_coins':
      return 'Bonus coins'
    case 'free_duration':
      return 'Free duration'
    default:
      return 'Promotion available'
  }
}

export function getTromocodeProductLabel(productType) {
  switch (String(productType || '').toLowerCase()) {
    case 'verified_badge':
      return 'Verified Badge'
    case 'profile_frame':
      return 'Profile Frames'
    case 'insurance_plan':
      return 'Insurance Plans'
    case 'perk':
      return 'Perks'
    case 'all_eligible':
      return 'All Eligible Items'
    case 'coin_pack':
      return 'Coin Packs'
    default:
      return 'Eligible Store Item'
  }
}

export function getTabTromocodeProduct(tabId) {
  switch (String(tabId || '').toLowerCase()) {
    case 'verified_badge':
    case 'coins':
      return 'verified_badge'
    case 'frames':
      return 'profile_frame'
    case 'insurance':
      return 'insurance_plan'
    case 'perks':
      return 'perk'
    default:
      return 'perk'
  }
}
