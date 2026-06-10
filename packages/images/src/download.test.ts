import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'

// Test the MIME type validation logic in isolation
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

function parseMimeType(contentType: string | null): string {
  return contentType?.split(';')[0]?.toLowerCase().trim() ?? ''
}

describe('MIME type validation', () => {
  test('accepts image/jpeg', () => {
    assert.ok(ALLOWED_MIME_TYPES.has(parseMimeType('image/jpeg')))
  })

  test('accepts image/png with charset', () => {
    assert.ok(ALLOWED_MIME_TYPES.has(parseMimeType('image/png; charset=utf-8')))
  })

  test('accepts image/webp', () => {
    assert.ok(ALLOWED_MIME_TYPES.has(parseMimeType('image/webp')))
  })

  test('rejects text/html', () => {
    assert.ok(!ALLOWED_MIME_TYPES.has(parseMimeType('text/html')))
  })

  test('rejects application/pdf', () => {
    assert.ok(!ALLOWED_MIME_TYPES.has(parseMimeType('application/pdf')))
  })

  test('rejects empty content-type', () => {
    assert.ok(!ALLOWED_MIME_TYPES.has(parseMimeType(null)))
  })

  test('rejects image/svg+xml', () => {
    assert.ok(!ALLOWED_MIME_TYPES.has(parseMimeType('image/svg+xml')))
  })
})
