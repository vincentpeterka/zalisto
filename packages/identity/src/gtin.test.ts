import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateGtin, toGtin14 } from './gtin.js'

describe('validateGtin', () => {
  it('accepts valid EAN-13', () => {
    const r = validateGtin('4006381333931')
    assert.equal(r.valid, true)
    assert.equal(r.type, 'EAN-13')
    assert.equal(r.normalized, '4006381333931')
    assert.equal(r.error, undefined)
  })

  it('accepts valid EAN-8', () => {
    // 96385074 — standard test EAN-8
    const r = validateGtin('96385074')
    assert.equal(r.valid, true)
    assert.equal(r.type, 'EAN-8')
  })

  it('accepts valid GTIN-14', () => {
    // pad EAN-13 with leading 0 → GTIN-14
    const r = validateGtin('04006381333931')
    assert.equal(r.valid, true)
    assert.equal(r.type, 'GTIN-14')
  })

  it('rejects EAN-13 with wrong check digit', () => {
    const r = validateGtin('4006381333932')
    assert.equal(r.valid, false)
    assert.equal(r.error, 'GTIN_INVALID_CHECKSUM')
    assert.equal(r.type, 'EAN-13')
  })

  it('rejects EAN-8 with wrong check digit', () => {
    const r = validateGtin('96385075')
    assert.equal(r.valid, false)
    assert.equal(r.error, 'GTIN_INVALID_CHECKSUM')
  })

  it('rejects non-numeric', () => {
    const r = validateGtin('400ABC1333931')
    assert.equal(r.valid, false)
    assert.equal(r.error, 'GTIN_NON_NUMERIC')
  })

  it('rejects invalid length', () => {
    const r = validateGtin('123456')
    assert.equal(r.valid, false)
    assert.equal(r.error, 'GTIN_INVALID_LENGTH')
  })

  it('strips whitespace and dashes before validating', () => {
    const r = validateGtin('4006381 333931')
    assert.equal(r.valid, true)
    assert.equal(r.normalized, '4006381333931')
  })
})

describe('toGtin14', () => {
  it('pads EAN-13 to GTIN-14', () => {
    assert.equal(toGtin14('4006381333931'), '04006381333931')
  })

  it('pads EAN-8 to GTIN-14', () => {
    assert.equal(toGtin14('96385074'), '00000096385074')
  })

  it('leaves GTIN-14 unchanged', () => {
    assert.equal(toGtin14('04006381333931'), '04006381333931')
  })
})
