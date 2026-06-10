import type { CheerioAPI } from 'cheerio'
import { SourceTrust } from '@zalisto/domain'
import type { ExtractionResult } from './types.js'

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  '[data-price]',
  '.price',
  '#price',
  '.product-price',
  '.js-price',
]

const SKU_SELECTORS = [
  '[itemprop="sku"]',
  '[data-sku]',
  '.sku',
  '#sku',
]

const GTIN_SELECTORS = [
  '[itemprop="gtin13"]',
  '[itemprop="gtin"]',
  '[data-ean]',
  '[data-gtin]',
]

const IMAGE_SELECTORS = [
  '[itemprop="image"]',
  '.product-image img',
  '.product-gallery img',
  '.gallery img',
  '#product-image',
  '.main-image img',
]

function parsePrice(raw: string): number | undefined {
  // Remove currency symbols and whitespace, normalize decimal separator
  const cleaned = raw.replace(/[^\d,. ]/g, '').trim()
  // Try to detect European format (1.234,56) vs US (1,234.56)
  const hasCommaDecimal = /\d,\d{1,2}$/.test(cleaned)
  const normalized = hasCommaDecimal
    ? cleaned.replace(/[\s.]/g, '').replace(',', '.')
    : cleaned.replace(/[,\s]/g, '')
  const price = parseFloat(normalized)
  return isNaN(price) || price <= 0 ? undefined : price
}

function extractGtinFromText(text: string): string | undefined {
  const match = text.match(/\b(\d{8}|\d{12,14})\b/)
  return match ? match[1] : undefined
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

export function extractHtmlHeuristics($: CheerioAPI, sourceUrl: string): Partial<ExtractionResult> {
  const facts: ExtractionResult['facts'] = []
  const images: ExtractionResult['images'] = []

  const addFact = (fieldName: string, value: unknown, confidence: number, normalized?: string) => {
    facts.push({
      fieldName,
      valueJson: value,
      normalizedValue: normalized,
      sourceType: SourceTrust.SOURCE_PAGE,
      sourceUrl,
      confidence,
      isSelected: false,
    })
  }

  // Title: h1 in product area preferred
  const h1 = $('h1').first().text().trim()
  if (h1) addFact('name', h1, 0.6)

  // Price
  for (const sel of PRICE_SELECTORS) {
    const el = $(sel).first()
    if (!el.length) continue
    const raw = el.attr('content') ?? el.attr('data-price') ?? el.text()
    const price = parsePrice(raw)
    if (price !== undefined) {
      addFact('sourcePrice', price, 0.7, String(price))
      break
    }
  }

  // SKU
  for (const sel of SKU_SELECTORS) {
    const el = $(sel).first()
    if (!el.length) continue
    const val = (el.attr('content') ?? el.text()).trim()
    if (val) { addFact('sku', val, 0.65); break }
  }

  // GTIN
  for (const sel of GTIN_SELECTORS) {
    const el = $(sel).first()
    if (!el.length) continue
    const val = (el.attr('content') ?? el.attr('data-ean') ?? el.attr('data-gtin') ?? el.text()).trim()
    const gtin = extractGtinFromText(val)
    if (gtin) { addFact('gtin', gtin, 0.7, gtin); break }
  }

  // Brand
  const brandEl = $('[itemprop="brand"]').first()
  if (brandEl.length) {
    const brand = (brandEl.attr('content') ?? brandEl.text()).trim()
    if (brand) addFact('brand', brand, 0.75)
  }

  // Breadcrumbs → product type
  const breadcrumbs: string[] = []
  $('[itemtype*="BreadcrumbList"] [itemprop="name"], .breadcrumb li, nav[aria-label*="breadcrumb"] li').each((_, el) => {
    const text = $(el).text().trim()
    if (text) breadcrumbs.push(text)
  })
  if (breadcrumbs.length > 1) {
    addFact('breadcrumbs', breadcrumbs, 0.6)
    const lastCrumb = breadcrumbs[breadcrumbs.length - 2]
    if (lastCrumb) addFact('productType', lastCrumb, 0.5)
  }

  // Images
  const seenUrls = new Set<string>()
  let sortOrder = 0
  for (const sel of IMAGE_SELECTORS) {
    $(sel).each((_, el) => {
      const src = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-lazy')
      if (!src) return
      const url = resolveUrl(src, sourceUrl)
      if (seenUrls.has(url)) return
      seenUrls.add(url)
      images.push({ sourceUrl: url, sortOrder: sortOrder++ })
    })
    if (seenUrls.size > 0) break
  }

  // Tech specs from tables
  const specFacts: Array<{ key: string; value: string }> = []
  $('table tr, .specs tr, .parameters tr').each((_, row) => {
    const cells = $(row).find('td, th')
    if (cells.length === 2) {
      const key = $(cells[0]).text().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const val = $(cells[1]).text().trim()
      if (key && val && key.length < 80 && val.length < 500) {
        specFacts.push({ key, value: val })
      }
    }
  })
  if (specFacts.length > 0) {
    addFact('technicalSpecs', specFacts, 0.55)
  }

  return { facts, images }
}
