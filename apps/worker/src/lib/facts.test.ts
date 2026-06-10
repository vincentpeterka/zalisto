import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bestFactValue } from './facts.js'

describe('bestFactValue', () => {
  it('returns null for empty array', () => {
    assert.equal(bestFactValue([], 'gtin'), null)
  })

  it('returns null when field not present', () => {
    const facts = [{ fieldName: 'brand', valueJson: 'Samsung', confidence: '0.9' }]
    assert.equal(bestFactValue(facts, 'gtin'), null)
  })

  it('returns value of the single matching fact', () => {
    const facts = [{ fieldName: 'gtin', valueJson: '4006381333931', confidence: '0.9' }]
    assert.equal(bestFactValue(facts, 'gtin'), '4006381333931')
  })

  it('picks fact with highest confidence', () => {
    const facts = [
      { fieldName: 'brand', valueJson: 'SAMSUNG', confidence: '0.5' },
      { fieldName: 'brand', valueJson: 'Samsung', confidence: '0.9' },
      { fieldName: 'brand', valueJson: 'samsung inc', confidence: '0.7' },
    ]
    assert.equal(bestFactValue(facts, 'brand'), 'Samsung')
  })

  it('treats null confidence as 0', () => {
    const facts = [
      { fieldName: 'sku', valueJson: 'LOW', confidence: null },
      { fieldName: 'sku', valueJson: 'HIGH', confidence: '0.8' },
    ]
    assert.equal(bestFactValue(facts, 'sku'), 'HIGH')
  })

  it('ignores facts with null valueJson', () => {
    const facts = [
      { fieldName: 'gtin', valueJson: null, confidence: '0.9' },
      { fieldName: 'gtin', valueJson: '4006381333931', confidence: '0.5' },
    ]
    assert.equal(bestFactValue(facts, 'gtin'), '4006381333931')
  })

  it('converts non-string valueJson to string', () => {
    const facts = [{ fieldName: 'price', valueJson: 299.99, confidence: '0.8' }]
    assert.equal(bestFactValue(facts, 'price'), '299.99')
  })

  it('ignores facts for other fields', () => {
    const facts = [
      { fieldName: 'brand', valueJson: 'Sony', confidence: '0.9' },
      { fieldName: 'gtin', valueJson: '4006381333931', confidence: '0.8' },
    ]
    assert.equal(bestFactValue(facts, 'brand'), 'Sony')
    assert.equal(bestFactValue(facts, 'gtin'), '4006381333931')
  })
})
