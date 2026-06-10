import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as cheerio from 'cheerio'
import { extractHtmlHeuristics } from './html-heuristics.js'

const URL = 'https://shop.cz/produkt/widget'

function load(html: string) {
  return cheerio.load(html)
}

describe('extractHtmlHeuristics', () => {
  test('extracts product name from h1', () => {
    const $ = load('<html><body><h1>Awesome Gadget</h1></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const name = result.facts?.find(f => f.fieldName === 'name')
    assert.equal(name?.valueJson, 'Awesome Gadget')
    assert.equal(name?.confidence, 0.6)
  })

  test('extracts price from itemprop=price content attribute', () => {
    const $ = load('<html><body><span itemprop="price" content="1299.00">1 299 Kč</span></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const price = result.facts?.find(f => f.fieldName === 'sourcePrice')
    assert.equal(price?.valueJson, 1299)
    assert.equal(price?.normalizedValue, '1299')
  })

  test('extracts European price with space thousands separator from .price text', () => {
    const $ = load('<html><body><p class="price">1 234,56 Kč</p></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const price = result.facts?.find(f => f.fieldName === 'sourcePrice')
    assert.equal(price?.valueJson, 1234.56)
  })

  test('extracts European price with dot thousands separator', () => {
    const $ = load('<html><body><p class="price">1.234,56 €</p></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const price = result.facts?.find(f => f.fieldName === 'sourcePrice')
    assert.equal(price?.valueJson, 1234.56)
  })

  test('extracts US/decimal price', () => {
    const $ = load('<html><body><p class="price">$1,234.56</p></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const price = result.facts?.find(f => f.fieldName === 'sourcePrice')
    assert.equal(price?.valueJson, 1234.56)
  })

  test('extracts gtin from itemprop=gtin13', () => {
    const $ = load('<html><body><span itemprop="gtin13">8594050012345</span></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const gtin = result.facts?.find(f => f.fieldName === 'gtin')
    assert.equal(gtin?.valueJson, '8594050012345')
    assert.equal(gtin?.normalizedValue, '8594050012345')
  })

  test('extracts brand from itemprop=brand', () => {
    const $ = load('<html><body><span itemprop="brand">ACME Corp</span></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const brand = result.facts?.find(f => f.fieldName === 'brand')
    assert.equal(brand?.valueJson, 'ACME Corp')
    assert.equal(brand?.confidence, 0.75)
  })

  test('extracts SKU from itemprop=sku', () => {
    const $ = load('<html><body><span itemprop="sku">SKU-001</span></body></html>')
    const result = extractHtmlHeuristics($, URL)
    const sku = result.facts?.find(f => f.fieldName === 'sku')
    assert.equal(sku?.valueJson, 'SKU-001')
  })

  test('resolves relative image URL against base', () => {
    const $ = load('<html><body><img itemprop="image" src="/img/product.jpg"></body></html>')
    const result = extractHtmlHeuristics($, URL)
    assert.equal(result.images?.[0]?.sourceUrl, 'https://shop.cz/img/product.jpg')
  })

  test('deduplicates image URLs', () => {
    const $ = load(`<html><body>
      <img itemprop="image" src="https://cdn.example.com/img.jpg">
      <img itemprop="image" src="https://cdn.example.com/img.jpg">
    </body></html>`)
    const result = extractHtmlHeuristics($, URL)
    assert.equal(result.images?.length, 1)
  })

  test('extracts breadcrumbs and productType', () => {
    const $ = load(`<html><body>
      <nav aria-label="breadcrumb">
        <li>Domů</li><li>Elektronika</li><li>Widget Pro</li>
      </nav>
    </body></html>`)
    const result = extractHtmlHeuristics($, URL)
    const breadcrumbs = result.facts?.find(f => f.fieldName === 'breadcrumbs')
    const productType = result.facts?.find(f => f.fieldName === 'productType')
    assert.ok(Array.isArray(breadcrumbs?.valueJson))
    assert.equal(productType?.valueJson, 'Elektronika')
  })

  test('extracts spec table as technicalSpecs', () => {
    const $ = load(`<html><body><table>
      <tr><td>Materiál</td><td>Hliník</td></tr>
      <tr><td>Hmotnost</td><td>500 g</td></tr>
    </table></body></html>`)
    const result = extractHtmlHeuristics($, URL)
    const specs = result.facts?.find(f => f.fieldName === 'technicalSpecs') as { valueJson: Array<{ key: string; value: string }> } | undefined
    assert.ok(specs)
    assert.equal((specs?.valueJson as Array<{ key: string; value: string }>).length, 2)
  })

  test('returns empty facts for empty html', () => {
    const $ = load('<html><body></body></html>')
    const result = extractHtmlHeuristics($, URL)
    assert.equal(result.facts?.length, 0)
    assert.equal(result.images?.length, 0)
  })
})
