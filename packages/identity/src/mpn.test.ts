import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMpn, normalizeBrand } from './mpn.js'

describe('normalizeMpn', () => {
  it('lowercases and strips special chars', () => {
    assert.equal(normalizeMpn('ABC-123/XYZ'), 'abc-123xyz')
  })

  it('keeps hyphens', () => {
    assert.equal(normalizeMpn('MPN-456-A'), 'mpn-456-a')
  })

  it('trims whitespace', () => {
    assert.equal(normalizeMpn('  ABC123  '), 'abc123')
  })
})

describe('normalizeBrand', () => {
  it('lowercases', () => {
    assert.equal(normalizeBrand('Samsung'), 'samsung')
  })

  it('collapses multiple spaces', () => {
    assert.equal(normalizeBrand('Canon  EOS'), 'canon eos')
  })

  it('trims', () => {
    assert.equal(normalizeBrand('  Sony  '), 'sony')
  })
})
