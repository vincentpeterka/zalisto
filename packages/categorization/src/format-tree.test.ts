import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatCategoryTree, type FlatCategory } from './format-tree.js'

const cat = (id: string, fullPath: string, active = true): FlatCategory => ({
  id,
  name: fullPath.split(' > ').at(-1) ?? fullPath,
  fullPath,
  active,
})

describe('formatCategoryTree', () => {
  test('formats active categories as id: fullPath lines', () => {
    const result = formatCategoryTree([cat('a1', 'Elektronika > Telefony')])
    assert.equal(result, 'a1: Elektronika > Telefony')
  })

  test('filters out inactive categories', () => {
    const cats = [cat('a1', 'Elektronika'), cat('a2', 'Archivováno', false)]
    const result = formatCategoryTree(cats)
    assert.ok(result.includes('a1:'))
    assert.ok(!result.includes('a2:'))
  })

  test('truncates to maxItems', () => {
    const cats = Array.from({ length: 10 }, (_, i) => cat(`id${i}`, `Cat ${i}`))
    const result = formatCategoryTree(cats, 5)
    const lines = result.split('\n')
    assert.equal(lines.length, 5)
  })

  test('default maxItems is 200', () => {
    const cats = Array.from({ length: 250 }, (_, i) => cat(`id${i}`, `Cat ${i}`))
    const result = formatCategoryTree(cats)
    const lines = result.split('\n')
    assert.equal(lines.length, 200)
  })

  test('returns empty string for empty list', () => {
    assert.equal(formatCategoryTree([]), '')
  })

  test('returns empty string when all categories inactive', () => {
    const cats = [cat('a1', 'Elektronika', false), cat('a2', 'Nábytek', false)]
    assert.equal(formatCategoryTree(cats), '')
  })

  test('each line contains id and fullPath', () => {
    const cats = [
      cat('uuid-001', 'Elektronika > Televize'),
      cat('uuid-002', 'Elektronika > Audio'),
    ]
    const lines = formatCategoryTree(cats).split('\n')
    assert.equal(lines[0], 'uuid-001: Elektronika > Televize')
    assert.equal(lines[1], 'uuid-002: Elektronika > Audio')
  })

  test('preserves order after filtering inactive', () => {
    const cats = [
      cat('first', 'A'),
      cat('skip', 'B', false),
      cat('second', 'C'),
    ]
    const lines = formatCategoryTree(cats).split('\n')
    assert.equal(lines[0]!.startsWith('first:'), true)
    assert.equal(lines[1]!.startsWith('second:'), true)
  })
})
