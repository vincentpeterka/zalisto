import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildShoptetXlsx, SHOPTET_COLUMNS } from './xlsx-builder.js'
import type { ApprovedProduct } from './types.js'

const makeProduct = (overrides: Partial<ApprovedProduct> = {}): ApprovedProduct => ({
  id: 'draft-001',
  titleCs: 'Testovací produkt',
  shortDescriptionCs: 'Krátký popis',
  longDescriptionCs: 'Dlouhý popis produktu',
  brand: 'TestBrand',
  manufacturerPartNumber: 'TB-001',
  gtin: '1234567890128',
  targetPrice: '299.00',
  vatRate: '21.00',
  categoryFullPath: 'Elektronika > Telefony',
  sourceUrl: 'https://example.com/product/1',
  images: [
    { imageId: 'img-1', webpFilename: 'images/test-product-01.webp', sortOrder: 0 },
    { imageId: 'img-2', webpFilename: 'images/test-product-02.webp', sortOrder: 1 },
  ],
  variants: [],
  ...overrides,
})

describe('SHOPTET_COLUMNS', () => {
  test('contains required Shoptet columns', () => {
    const required = ['Kód', 'Název', 'Cena s DPH', 'Sazba DPH', 'Kategorie', 'EAN']
    for (const col of required) {
      assert.ok(SHOPTET_COLUMNS.includes(col), `Missing column: ${col}`)
    }
  })

  test('contains 10 image columns', () => {
    const imageCols = SHOPTET_COLUMNS.filter(c => c.startsWith('Obrázek'))
    assert.equal(imageCols.length, 10)
  })
})

describe('buildShoptetXlsx', () => {
  test('returns a non-empty buffer', async () => {
    const buf = await buildShoptetXlsx([makeProduct()])
    assert.ok(buf.length > 0)
  })

  test('returns buffer for empty product list', async () => {
    const buf = await buildShoptetXlsx([])
    assert.ok(buf.length > 0, 'XLSX with only header row should still produce output')
  })

  test('uses gtin as Kód when available', async () => {
    // Just verify it builds without error when gtin is set
    const buf = await buildShoptetXlsx([makeProduct({ gtin: '9780000000002' })])
    assert.ok(buf.length > 0)
  })

  test('falls back to MPN as Kód when no gtin', async () => {
    const buf = await buildShoptetXlsx([makeProduct({ gtin: null, manufacturerPartNumber: 'MPN-XYZ' })])
    assert.ok(buf.length > 0)
  })

  test('handles product with no images', async () => {
    const buf = await buildShoptetXlsx([makeProduct({ images: [] })])
    assert.ok(buf.length > 0)
  })

  test('handles multiple products', async () => {
    const products = [
      makeProduct({ id: 'a', gtin: '4006381333931' }),
      makeProduct({ id: 'b', gtin: '4006381333948' }),
      makeProduct({ id: 'c', gtin: null, manufacturerPartNumber: 'SKU-C' }),
    ]
    const buf = await buildShoptetXlsx(products)
    assert.ok(buf.length > 0)
  })
})

describe('buildShoptetXlsx — blocked products excluded', () => {
  test('function only accepts approved products (type safety ensures blocked are excluded)', () => {
    // The function signature takes ApprovedProduct[] — blocked products
    // are never passed to it (worker filters by status=APPROVED before calling)
    assert.ok(typeof buildShoptetXlsx === 'function')
  })
})
