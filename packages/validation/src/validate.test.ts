import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateDraft } from './validate.js'
import type { DraftSnapshot, FactSnapshot, ImageSnapshot, ExistingIssue } from './types.js'

const goodDraft: DraftSnapshot = {
  id: 'd1',
  status: 'PROCESSING_IMAGES',
  brand: 'Samsung',
  modelName: 'Galaxy S24',
  manufacturerPartNumber: 'SM-S921B',
  gtin: '1234567890128',
  titleCs: 'Samsung Galaxy S24 256 GB',
  shortDescriptionCs: 'Špičkový smartphone s AMOLED displejem',
  longDescriptionCs: 'Dlouhý popis produktu...',
  targetPrice: '22990.00',
  categoryId: 'cat-1',
  categoryConfidence: '0.92',
}

const goodImage: ImageSnapshot = { id: 'img1', status: 'PROCESSED', rightsConfirmed: false }

describe('validateDraft', () => {
  it('ready_for_review when everything is fine (INFO only)', () => {
    const result = validateDraft(goodDraft, [], [goodImage], [])
    assert.equal(result.finalStatus, 'READY_FOR_REVIEW')
    assert.ok(result.violations.some(v => v.code === 'RIGHTS_NOT_CONFIRMED'))
    assert.ok(result.violations.every(v => v.severity === 'INFO'))
  })

  it('blocked when title missing', () => {
    const draft = { ...goodDraft, titleCs: null }
    const result = validateDraft(draft, [], [goodImage], [])
    assert.equal(result.finalStatus, 'BLOCKED')
    assert.ok(result.violations.some(v => v.code === 'MISSING_TITLE' && v.severity === 'BLOCKER'))
  })

  it('needs_review when price missing', () => {
    const draft = { ...goodDraft, targetPrice: null }
    const result = validateDraft(draft, [], [goodImage], [])
    assert.equal(result.finalStatus, 'NEEDS_REVIEW')
    assert.ok(result.violations.some(v => v.code === 'MISSING_PRICE'))
  })

  it('does not add MISSING_PRICE when PRICE_VAT_UNKNOWN already exists', () => {
    const draft = { ...goodDraft, targetPrice: null }
    const existingIssues: ExistingIssue[] = [
      { code: 'PRICE_VAT_UNKNOWN', severity: 'BLOCKER', resolved: false },
    ]
    const result = validateDraft(draft, [], [goodImage], existingIssues)
    assert.equal(result.finalStatus, 'BLOCKED')
    assert.ok(!result.violations.some(v => v.code === 'MISSING_PRICE'))
  })

  it('needs_review when category missing', () => {
    const draft = { ...goodDraft, categoryId: null }
    const result = validateDraft(draft, [], [goodImage], [])
    assert.equal(result.finalStatus, 'NEEDS_REVIEW')
    assert.ok(result.violations.some(v => v.code === 'MISSING_CATEGORY'))
  })

  it('needs_review when no usable image', () => {
    const failedImage: ImageSnapshot = { id: 'img2', status: 'FAILED', rightsConfirmed: false }
    const result = validateDraft(goodDraft, [], [failedImage], [])
    assert.equal(result.finalStatus, 'NEEDS_REVIEW')
    assert.ok(result.violations.some(v => v.code === 'NO_USABLE_IMAGE'))
  })

  it('no NO_USABLE_IMAGE when ALL_IMAGES_FAILED already flagged', () => {
    const existingIssues: ExistingIssue[] = [
      { code: 'ALL_IMAGES_FAILED', severity: 'ERROR', resolved: false },
    ]
    const result = validateDraft(goodDraft, [], [], existingIssues)
    assert.ok(!result.violations.some(v => v.code === 'NO_USABLE_IMAGE'))
  })

  it('needs_review on existing WARNING issue even if no new violations', () => {
    const draft = { ...goodDraft }
    const existingIssues: ExistingIssue[] = [
      { code: 'IMAGE_TOO_SMALL', severity: 'WARNING', resolved: false },
    ]
    const result = validateDraft(draft, [], [goodImage], existingIssues)
    assert.equal(result.finalStatus, 'NEEDS_REVIEW')
  })

  it('ready_for_review when all existing issues are resolved', () => {
    const existingIssues: ExistingIssue[] = [
      { code: 'IMAGE_TOO_SMALL', severity: 'WARNING', resolved: true },
    ]
    const result = validateDraft(goodDraft, [], [goodImage], existingIssues)
    assert.equal(result.finalStatus, 'READY_FOR_REVIEW')
  })
})
