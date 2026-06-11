import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { buildValidationReport, buildSourceReport } from './csv-builder.js'
import { buildManifest } from './manifest.js'
import { buildExportZip } from './zip-builder.js'
import { buildShoptetXlsx } from './xlsx-builder.js'
import type { BlockedProduct, SourceReportRow, ApprovedProduct } from './types.js'

// ── csv-builder ──────────────────────────────────────────────────────────────

describe('buildValidationReport', () => {
  test('returns Buffer with header', () => {
    const buf = buildValidationReport([])
    const text = buf.toString('utf-8')
    assert.ok(text.startsWith('ID,EAN,'))
  })

  test('includes one row per blocked product', () => {
    const blocked: BlockedProduct[] = [
      {
        id: 'draft-1',
        titleCs: 'Produkt A',
        brand: 'BrandX',
        gtin: '4006381333931',
        sourceUrl: 'https://example.com/a',
        blockerCodes: ['MISSING_TITLE'],
        errorCodes: ['MISSING_PRICE'],
      },
      {
        id: 'draft-2',
        titleCs: null,
        brand: null,
        gtin: null,
        sourceUrl: 'https://example.com/b',
        blockerCodes: ['GTIN_INVALID_CHECKSUM', 'MISSING_TITLE'],
        errorCodes: [],
      },
    ]
    const text = buildValidationReport(blocked).toString('utf-8')
    const lines = text.split('\n')
    assert.equal(lines.length, 3) // header + 2 rows
    assert.ok(lines[1]!.includes('draft-1'))
    assert.ok(lines[2]!.includes('draft-2'))
  })

  test('escapes commas in title', () => {
    const blocked: BlockedProduct[] = [{
      id: 'x',
      titleCs: 'Produkt, s čárkou',
      brand: null,
      gtin: null,
      sourceUrl: 'https://example.com',
      blockerCodes: [],
      errorCodes: [],
    }]
    const text = buildValidationReport(blocked).toString('utf-8')
    assert.ok(text.includes('"Produkt, s čárkou"'))
  })

  test('escapes double quotes in values', () => {
    const blocked: BlockedProduct[] = [{
      id: 'x',
      titleCs: 'He said "hello"',
      brand: null,
      gtin: null,
      sourceUrl: 'https://example.com',
      blockerCodes: [],
      errorCodes: [],
    }]
    const text = buildValidationReport(blocked).toString('utf-8')
    assert.ok(text.includes('"He said ""hello"""'))
  })
})

describe('buildSourceReport', () => {
  test('returns Buffer with header', () => {
    const buf = buildSourceReport([])
    assert.ok(buf.toString('utf-8').startsWith('Zdroj URL,'))
  })

  test('includes all source items', () => {
    const rows: SourceReportRow[] = [
      { sourceUrl: 'https://a.com', productId: 'id-1', title: 'A', status: 'APPROVED', gtin: '123' },
      { sourceUrl: 'https://b.com', productId: '', title: null, status: 'FAILED', gtin: null },
    ]
    const lines = buildSourceReport(rows).toString('utf-8').split('\n')
    assert.equal(lines.length, 3)
    assert.ok(lines[1]!.includes('https://a.com'))
    assert.ok(lines[2]!.includes('FAILED'))
  })
})

// ── manifest ─────────────────────────────────────────────────────────────────

describe('buildManifest', () => {
  test('productCount = approvedCount + blockedCount', () => {
    const m = buildManifest({
      batchId: 'b-1',
      exportId: 'e-1',
      approvedCount: 10,
      blockedCount: 3,
      imageCount: 25,
      exportedBy: 'user@test.com',
    })
    assert.equal(m.productCount, 13)
    assert.equal(m.approvedCount, 10)
    assert.equal(m.blockedCount, 3)
  })

  test('createdAt is an ISO date string', () => {
    const m = buildManifest({ batchId: 'b', exportId: 'e', approvedCount: 0, blockedCount: 0, imageCount: 0, exportedBy: 'x' })
    assert.doesNotThrow(() => new Date(m.createdAt))
    assert.ok(m.createdAt.endsWith('Z'))
  })

  test('passes through all fields', () => {
    const m = buildManifest({ batchId: 'batch-123', exportId: 'exp-456', approvedCount: 5, blockedCount: 1, imageCount: 12, exportedBy: 'admin@co.cz' })
    assert.equal(m.batchId, 'batch-123')
    assert.equal(m.exportId, 'exp-456')
    assert.equal(m.imageCount, 12)
    assert.equal(m.exportedBy, 'admin@co.cz')
  })
})

// ── zip-builder ───────────────────────────────────────────────────────────────

describe('buildExportZip', () => {
  const manifest = buildManifest({ batchId: 'b', exportId: 'e', approvedCount: 1, blockedCount: 0, imageCount: 1, exportedBy: 'test' })
  const dummyXlsx = Buffer.from('xlsx-placeholder')
  const dummyReport = Buffer.from('report-content')
  const dummyImage = Buffer.from('image-bytes')

  test('returns non-empty buffer', async () => {
    const buf = await buildExportZip(dummyXlsx, [], [], manifest)
    assert.ok(buf.length > 0)
  })

  test('ZIP contains shoptet-import.xlsx', async () => {
    const buf = await buildExportZip(dummyXlsx, [], [], manifest)
    const zip = await JSZip.loadAsync(buf)
    assert.ok(zip.file('shoptet-import.xlsx') !== null)
  })

  test('ZIP contains manifest.json with correct batchId', async () => {
    const buf = await buildExportZip(dummyXlsx, [], [], manifest)
    const zip = await JSZip.loadAsync(buf)
    const manifestJson = await zip.file('manifest.json')!.async('string')
    const parsed = JSON.parse(manifestJson)
    assert.equal(parsed.batchId, 'b')
  })

  test('ZIP contains report files at root level', async () => {
    const buf = await buildExportZip(
      dummyXlsx,
      [],
      [{ filename: 'validation-report.csv', buffer: dummyReport }],
      manifest,
    )
    const zip = await JSZip.loadAsync(buf)
    assert.ok(zip.file('validation-report.csv') !== null)
  })

  test('ZIP places images in images/ folder', async () => {
    const buf = await buildExportZip(
      dummyXlsx,
      [{ filename: 'product-01.webp', buffer: dummyImage }],
      [],
      manifest,
    )
    const zip = await JSZip.loadAsync(buf)
    assert.ok(zip.file('images/product-01.webp') !== null)
  })

  test('ZIP contains correct number of images', async () => {
    const images = [
      { filename: 'a-01.webp', buffer: dummyImage },
      { filename: 'b-01.webp', buffer: dummyImage },
      { filename: 'c-01.webp', buffer: dummyImage },
    ]
    const buf = await buildExportZip(dummyXlsx, images, [], manifest)
    const zip = await JSZip.loadAsync(buf)
    const imageFiles = Object.keys(zip.files).filter(f => f.startsWith('images/') && !f.endsWith('/'))
    assert.equal(imageFiles.length, 3)
  })
})
