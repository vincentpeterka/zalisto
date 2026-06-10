import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calculatePrice } from './calculate.js'
import type { PricingConfig } from '@zalisto/domain'

const baseConfig: PricingConfig = {
  sourcePriceIncludesVat: false,
  exchangeRate: 1,
  targetCurrency: 'CZK',
  marginMode: 'MULTIPLIER',
  marginValue: 1.3,
  targetVatRate: 21,
  rounding: 'NONE',
}

describe('calculatePrice — guards', () => {
  test('no source price → NO_PRICE', () => {
    const r = calculatePrice(null, 'EUR', baseConfig)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, 'NO_PRICE')
  })

  test('zero price → NO_PRICE', () => {
    const r = calculatePrice(0, 'EUR', baseConfig)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, 'NO_PRICE')
  })

  test('VAT status null → VAT_STATUS_UNKNOWN', () => {
    const r = calculatePrice(100, 'EUR', { ...baseConfig, sourcePriceIncludesVat: null })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, 'VAT_STATUS_UNKNOWN')
  })

  test('negative exchange rate → INVALID_CONFIG', () => {
    const r = calculatePrice(100, 'EUR', { ...baseConfig, exchangeRate: -1 })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, 'INVALID_CONFIG')
  })
})

describe('calculatePrice — basic EUR→CZK', () => {
  test('EUR→CZK, no source VAT, MULTIPLIER 1.3, VAT 21%, NONE rounding', () => {
    const r = calculatePrice(100, 'EUR', { ...baseConfig, exchangeRate: 25 })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const { breakdown: b } = r
    assert.equal(b.priceInTargetCurrency, 2500)
    assert.equal(b.priceExcludingVat, 2500)
    assert.equal(b.priceAfterMargin, 3250)
    assert.ok(Math.abs(b.vatAmount - 682.5) < 0.001)
    assert.ok(Math.abs(b.priceBeforeRounding - 3932.5) < 0.001)
    assert.ok(Math.abs(b.finalPrice - 3932.5) < 0.001)
    assert.equal(b.sourceCurrency, 'EUR')
    assert.equal(b.targetCurrency, 'CZK')
  })
})

describe('calculatePrice — source price includes VAT', () => {
  test('strip source VAT before applying margin', () => {
    // source: 121 CZK incl. 21% VAT → ex-VAT = 100
    const r = calculatePrice(121, 'CZK', { ...baseConfig, sourcePriceIncludesVat: true })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const { breakdown: b } = r
    assert.ok(Math.abs(b.priceExcludingVat - 100) < 0.01)
    assert.ok(Math.abs(b.priceAfterMargin - 130) < 0.01)
    assert.ok(Math.abs(b.vatAmount - 27.3) < 0.01)
    assert.ok(Math.abs(b.finalPrice - 157.3) < 0.01)
  })
})

describe('calculatePrice — FIXED margin', () => {
  test('add fixed amount to ex-VAT price', () => {
    const r = calculatePrice(100, 'CZK', { ...baseConfig, marginMode: 'FIXED', marginValue: 50 })
    assert.equal(r.ok, true)
    if (!r.ok) return
    const { breakdown: b } = r
    assert.equal(b.priceAfterMargin, 150)
    assert.ok(Math.abs(b.finalPrice - 181.5) < 0.01)
  })
})

describe('calculatePrice — rounding', () => {
  const config157 = { ...baseConfig, sourcePriceIncludesVat: true }

  test('NONE — no rounding', () => {
    const r = calculatePrice(121, 'CZK', { ...config157, rounding: 'NONE' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.breakdown.finalPrice - 157.3) < 0.01)
  })

  test('UP — Math.ceil', () => {
    const r = calculatePrice(121, 'CZK', { ...config157, rounding: 'UP' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.breakdown.finalPrice, 158)
  })

  test('DOWN — Math.floor', () => {
    const r = calculatePrice(121, 'CZK', { ...config157, rounding: 'DOWN' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.breakdown.finalPrice, 157)
  })

  test('TO_9 — nearest _9 price', () => {
    const r = calculatePrice(121, 'CZK', { ...config157, rounding: 'TO_9' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.breakdown.finalPrice % 10, 9)
  })

  test('TO_0 — nearest multiple of 10', () => {
    const r = calculatePrice(121, 'CZK', { ...config157, rounding: 'TO_0' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.breakdown.finalPrice % 10, 0)
  })

  test('TO_9 round-trip: 995 CZK ex-VAT, MULTIPLIER 1, VAT 0%, rounding TO_9', () => {
    const r = calculatePrice(995, 'CZK', {
      ...baseConfig,
      sourcePriceIncludesVat: false,
      marginMode: 'MULTIPLIER',
      marginValue: 1,
      targetVatRate: 0,
      rounding: 'TO_9',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.breakdown.finalPrice, 999)
  })
})
