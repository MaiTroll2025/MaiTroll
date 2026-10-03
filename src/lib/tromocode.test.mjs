import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeTromocode,
  calculateTromocodeDiscount,
  isTromocodeProductEligible,
} from './tromocode.js'

test('normalizeTromocode collapses case and whitespace', () => {
  assert.equal(normalizeTromocode('  troMo50  '), 'TROMO50')
})

test('percentage discount is calculated from original amount', () => {
  assert.deepEqual(calculateTromocodeDiscount({
    promotionType: 'percentage_discount',
    promotionValue: 50,
    originalAmount: 500,
  }), {
    originalAmount: 500,
    discountAmount: 250,
    finalAmount: 250,
  })
})

test('fixed coin discount subtracts from the total without dropping below zero', () => {
  assert.deepEqual(calculateTromocodeDiscount({
    promotionType: 'fixed_coin_discount',
    promotionValue: 100,
    originalAmount: 80,
  }), {
    originalAmount: 80,
    discountAmount: 80,
    finalAmount: 0,
  })
})

test('coin pack is explicitly blocked from TromoCode eligibility', () => {
  assert.equal(isTromocodeProductEligible('coin_pack'), false)
  assert.equal(isTromocodeProductEligible('perk'), true)
})
