import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractProduct } from './index.js'

const URL = 'https://eshop.cz/produkt/widget-pro'

describe('extractProduct (integration)', () => {
  test('full product page with JSON-LD → high confidence, no browser fallback', () => {
    const html = `<html>
      <head>
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Product',
          name: 'Widget Pro',
          brand: { '@type': 'Brand', name: 'ACME' },
          gtin13: '8594050012345',
          offers: { '@type': 'Offer', price: '499', priceCurrency: 'CZK' },
          image: 'https://cdn.eshop.cz/widget.jpg',
        })}</script>
      </head>
      <body><h1>Widget Pro</h1></body>
    </html>`

    const result = extractProduct(html, URL)

    assert.ok(result.confidence > 0.4, `confidence ${result.confidence} should be > 0.4`)
    assert.equal(result.needsBrowserFallback, false)

    const byField = Object.fromEntries(result.facts.map(f => [f.fieldName, f]))
    assert.equal(byField['name']?.valueJson, 'Widget Pro')
    assert.equal(byField['brand']?.valueJson, 'ACME')
    assert.equal(byField['sourcePrice']?.valueJson, 499)
    assert.equal(byField['gtin']?.normalizedValue, '8594050012345')
    assert.equal(result.images[0]?.sourceUrl, 'https://cdn.eshop.cz/widget.jpg')
  })

  test('JSON-LD overrides heuristics for same field (higher confidence)', () => {
    const html = `<html>
      <head>
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Product',
          name: 'JSON-LD Name',
          offers: { price: '999', priceCurrency: 'CZK' },
        })}</script>
      </head>
      <body>
        <h1>Heuristic H1 Name</h1>
        <span class="price">888 Kč</span>
      </body>
    </html>`

    const result = extractProduct(html, URL)
    const byField = Object.fromEntries(result.facts.map(f => [f.fieldName, f]))

    // JSON-LD (0.9) wins over heuristics (0.6)
    assert.equal(byField['name']?.valueJson, 'JSON-LD Name')
    // JSON-LD (0.9) wins over heuristics (0.7) for price
    assert.equal(byField['sourcePrice']?.valueJson, 999)
  })

  test('minimal HTML with only h1 → low confidence, needs browser fallback', () => {
    const html = '<html><body><h1>Produkt</h1></body></html>'
    const result = extractProduct(html, URL)

    assert.ok(result.confidence < 0.4, `confidence ${result.confidence} should be < 0.4`)
    assert.equal(result.needsBrowserFallback, true)
  })

  test('OG tags fill gaps when JSON-LD missing', () => {
    const html = `<html>
      <head>
        <meta property="og:title" content="OG Product" />
        <meta property="og:image" content="https://cdn.example.com/og.jpg" />
        <meta property="product:price:amount" content="299" />
        <meta property="product:price:currency" content="EUR" />
      </head>
      <body></body>
    </html>`

    const result = extractProduct(html, URL)
    const byField = Object.fromEntries(result.facts.map(f => [f.fieldName, f]))

    assert.equal(byField['name']?.valueJson, 'OG Product')
    assert.equal(byField['sourcePrice']?.valueJson, 299)
    assert.equal(byField['currency']?.valueJson, 'EUR')
    assert.equal(result.images[0]?.sourceUrl, 'https://cdn.example.com/og.jpg')
  })

  test('deduplicates images from JSON-LD and OG pointing to same URL', () => {
    const imgUrl = 'https://cdn.example.com/product.jpg'
    const html = `<html>
      <head>
        <meta property="og:image" content="${imgUrl}" />
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Product', name: 'X', image: imgUrl,
        })}</script>
      </head>
    </html>`

    const result = extractProduct(html, URL)
    assert.equal(result.images.length, 1)
  })

  test('empty html produces empty result with zero confidence', () => {
    const result = extractProduct('<html><body></body></html>', URL)
    assert.equal(result.facts.length, 0)
    assert.equal(result.images.length, 0)
    assert.equal(result.confidence, 0)
    assert.equal(result.needsBrowserFallback, true)
  })
})
