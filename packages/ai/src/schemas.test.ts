import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ContentOutputSchema } from './schemas/content.js'
import { CategorizationOutputSchema } from './schemas/categorization.js'

describe('ContentOutputSchema', () => {
  const valid = {
    titleCs: 'Testovací produkt',
    shortDescriptionCs: 'Krátký popis',
    longDescriptionCs: 'Dlouhý popis produktu',
    bulletPoints: ['Bod 1', 'Bod 2'],
    warnings: [],
    usedFactIds: ['550e8400-e29b-41d4-a716-446655440000'],
  }

  test('accepts valid content output', () => {
    const result = ContentOutputSchema.safeParse(valid)
    assert.equal(result.success, true)
  })

  test('rejects title shorter than 5 chars', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, titleCs: 'Hi' })
    assert.equal(result.success, false)
  })

  test('rejects title longer than 200 chars', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, titleCs: 'A'.repeat(201) })
    assert.equal(result.success, false)
  })

  test('rejects shortDescription longer than 500 chars', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, shortDescriptionCs: 'A'.repeat(501) })
    assert.equal(result.success, false)
  })

  test('rejects longDescription longer than 5000 chars', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, longDescriptionCs: 'A'.repeat(5001) })
    assert.equal(result.success, false)
  })

  test('rejects more than 10 bullet points', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, bulletPoints: new Array(11).fill('bod') })
    assert.equal(result.success, false)
  })

  test('accepts empty usedFactIds', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, usedFactIds: [] })
    assert.equal(result.success, true)
  })

  test('rejects non-UUID in usedFactIds', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, usedFactIds: ['not-a-uuid'] })
    assert.equal(result.success, false)
  })

  test('rejects missing required fields', () => {
    const { titleCs: _, ...withoutTitle } = valid
    const result = ContentOutputSchema.safeParse(withoutTitle)
    assert.equal(result.success, false)
  })

  test('accepts 10 bullet points exactly', () => {
    const result = ContentOutputSchema.safeParse({ ...valid, bulletPoints: new Array(10).fill('bod') })
    assert.equal(result.success, true)
  })
})

describe('CategorizationOutputSchema', () => {
  const valid = {
    primaryCategoryId: 'cat-uuid-001',
    alternativeCategoryIds: ['cat-uuid-002'],
    confidence: 0.92,
    reason: 'Odpovídá kategorii elektronika',
  }

  test('accepts valid categorization output', () => {
    const result = CategorizationOutputSchema.safeParse(valid)
    assert.equal(result.success, true)
  })

  test('rejects confidence below 0', () => {
    const result = CategorizationOutputSchema.safeParse({ ...valid, confidence: -0.1 })
    assert.equal(result.success, false)
  })

  test('rejects confidence above 1', () => {
    const result = CategorizationOutputSchema.safeParse({ ...valid, confidence: 1.01 })
    assert.equal(result.success, false)
  })

  test('accepts confidence exactly 0', () => {
    const result = CategorizationOutputSchema.safeParse({ ...valid, confidence: 0 })
    assert.equal(result.success, true)
  })

  test('accepts confidence exactly 1', () => {
    const result = CategorizationOutputSchema.safeParse({ ...valid, confidence: 1 })
    assert.equal(result.success, true)
  })

  test('accepts empty alternativeCategoryIds', () => {
    const result = CategorizationOutputSchema.safeParse({ ...valid, alternativeCategoryIds: [] })
    assert.equal(result.success, true)
  })

  test('rejects missing primaryCategoryId', () => {
    const { primaryCategoryId: _, ...without } = valid
    const result = CategorizationOutputSchema.safeParse(without)
    assert.equal(result.success, false)
  })

  test('rejects missing confidence', () => {
    const { confidence: _, ...without } = valid
    const result = CategorizationOutputSchema.safeParse(without)
    assert.equal(result.success, false)
  })
})
