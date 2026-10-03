import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateTromocodeDiscount,
  isTromocodeProductEligible,
  normalizeTromocode,
  getTromocodePromotionLabel,
} from '../src/lib/tromocode.js'

test('normalizeTromocode normalizes spacing and case', () => {
  assert.equal(normalizeTromocode('  tro mo 50  '), 'TROMO50')
  assert.equal(normalizeTromocode('Tromo50'), 'TROMO50')
})

test('percentage promo is eligible only for allowed product types', () => {
  assert.equal(isTromocodeProductEligible('verified_badge'), true)
  assert.equal(isTromocodeProductEligible('coin_pack'), false)
  assert.equal(isTromocodeProductEligible('all_eligible'), true)
})

test('fixed and percentage discounts calculate final amounts correctly', () => {
  assert.deepEqual(calculateTromocodeDiscount({
    promotionType: 'percentage_discount',
    promotionValue: 50,
    originalAmount: 500,
  }), {
    originalAmount: 500,
    discountAmount: 250,
    finalAmount: 250,
  })

  assert.deepEqual(calculateTromocodeDiscount({
    promotionType: 'fixed_coin_discount',
    promotionValue: 100,
    originalAmount: 500,
  }), {
    originalAmount: 500,
    discountAmount: 100,
    finalAmount: 400,
  })
})

test('promotion labels render human-friendly text for both supported promotion types', () => {
  assert.equal(getTromocodePromotionLabel('percentage_discount', 50), '50% promotional discount')
  assert.equal(getTromocodePromotionLabel('fixed_coin_discount', 100), '100 coin discount')
})
