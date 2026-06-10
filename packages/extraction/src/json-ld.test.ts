import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as cheerio from 'cheerio'
import { extractJsonLd } from './json-ld.js'

const URL = 'https://example.com/product'

function make(json: unknown) {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`
}

function load(html: string) {
  return cheerio.load(html)
}

describe('extractJsonLd', () => {
  test('extracts name, brand, gtin13 from minimal Product', () => {
    const html = make({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Test Widget',
      brand: { '@type': 'Brand', name: 'ACME' },
      gtin13: '8594050012345',
    })
    const result = extractJsonLd(load(html), URL)
    const byField = Object.fromEntries((result.facts ?? []).map(f => [f.fieldName, f]))

    assert.equal(byField['name']?.valueJson, 'Test Widget')
    assert.equal(byField['brand']?.valueJson, 'ACME')
    assert.equal(byField['gtin']?.normalizedValue, '8594050012345')
    assert.equal(byField['name']?.confidence, 0.9)
    assert.equal(byField['name']?.sourceType, 'SOURCE_PAGE')
  })

  test('extracts price and currency from single offer', () => {
    const html = make({
      '@type': 'Product',
      name: 'Widget',
      offers: { '@type': 'Offer', price: '299.90', priceCurrency: 'CZK' },
    })
    const result = extractJsonLd(load(html), URL)
    const byField = Object.fromEntries((result.facts ?? []).map(f => [f.fieldName, f]))

    assert.equal(byField['sourcePrice']?.valueJson, 299.9)
    assert.equal(byField['currency']?.valueJson, 'CZK')
  })

  test('extracts images from array of strings', () => {
    const html = make({
      '@type': 'Product',
      name: 'Widget',
      image: ['https://cdn.example.com/img1.jpg', 'https://cdn.example.com/img2.jpg'],
    })
    const result = extractJsonLd(load(html), URL)
    assert.equal(result.images?.length, 2)
    assert.equal(result.images?.[0]?.sourceUrl, 'https://cdn.example.com/img1.jpg')
    assert.equal(result.images?.[0]?.sortOrder, 0)
  })

  test('extracts image from ImageObject', () => {
    const html = make({
      '@type': 'Product',
      name: 'Widget',
      image: { '@type': 'ImageObject', url: 'https://cdn.example.com/img.jpg' },
    })
    const result = extractJsonLd(load(html), URL)
    assert.equal(result.images?.[0]?.sourceUrl, 'https://cdn.example.com/img.jpg')
  })

  test('extracts variants from multiple offers with sku', () => {
    const html = make({
      '@type': 'Product',
      name: 'Widget',
      offers: [
        { '@type': 'Offer', sku: 'W-RED', price: '199', priceCurrency: 'CZK' },
        { '@type': 'Offer', sku: 'W-BLUE', price: '199', priceCurrency: 'CZK' },
      ],
    })
    const result = extractJsonLd(load(html), URL)
    assert.equal(result.variants?.length, 2)
    assert.equal(result.variants?.[0]?.sku, 'W-RED')
  })

  test('handles string brand', () => {
    const html = make({ '@type': 'Product', name: 'X', brand: 'BrandName' })
    const result = extractJsonLd(load(html), URL)
    const byField = Object.fromEntries((result.facts ?? []).map(f => [f.fieldName, f]))
    assert.equal(byField['brand']?.valueJson, 'BrandName')
  })

  test('handles @graph with Product node', () => {
    const html = make({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Shop' },
        { '@type': 'Product', name: 'GraphProduct', offers: { price: '50', priceCurrency: 'EUR' } },
      ],
    })
    const result = extractJsonLd(load(html), URL)
    const byField = Object.fromEntries((result.facts ?? []).map(f => [f.fieldName, f]))
    assert.equal(byField['name']?.valueJson, 'GraphProduct')
    assert.equal(byField['sourcePrice']?.valueJson, 50)
  })

  test('ignores malformed JSON-LD', () => {
    const html = `<html><head><script type="application/ld+json">{ bad json }</script></head></html>`
    const result = extractJsonLd(load(html), URL)
    assert.equal(result.facts?.length, 0)
  })

  test('ignores non-Product @type', () => {
    const html = make({ '@type': 'WebPage', name: 'Not a product' })
    const result = extractJsonLd(load(html), URL)
    assert.equal(result.facts?.length, 0)
  })
})
