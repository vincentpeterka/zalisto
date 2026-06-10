import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import type { ProductFact, ProductImage, ProductVariant } from '@zalisto/domain'
import { SourceTrust } from '@zalisto/domain'

export interface ExtractionResult {
  facts: ProductFact[]
  images: ProductImage[]
  variants: ProductVariant[]
}

export function extractFacts(html: string, sourceUrl: string): ExtractionResult {
  const $ = cheerio.load(html)
  const facts: ProductFact[] = []
  const images: ProductImage[] = []
  const variants: ProductVariant[] = []

  // 1. JSON-LD extraction (highest confidence)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html()
      if (!raw) return
      const data = JSON.parse(raw) as unknown

      const products = extractJsonLdProducts(data)
      for (const product of products) {
        pushFacts(facts, parseJsonLdProduct(product, sourceUrl))
        pushImages(images, extractJsonLdImages(product))
        pushVariants(variants, extractJsonLdVariants(product))
      }
    } catch {
      // malformed JSON-LD — skip silently
    }
  })

  // 2. Open Graph
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogTitle) {
    facts.push(fact('title', ogTitle, SourceTrust.SOURCE_PAGE, sourceUrl, 0.6))
  }
  if (ogImage && !images.find(i => i.sourceUrl === ogImage)) {
    images.push({ sourceUrl: ogImage, sortOrder: images.length })
  }

  // 3. HTML heuristics (lower confidence, fill gaps)
  fillFromHtml($, facts, images, variants, sourceUrl)

  // Deduplicate images by URL
  const seen = new Set<string>()
  const dedupedImages = images.filter(img => {
    if (seen.has(img.sourceUrl)) return false
    seen.add(img.sourceUrl)
    return true
  })

  return { facts, images: dedupedImages, variants }
}

function fillFromHtml(
  $: cheerio.CheerioAPI,
  facts: ProductFact[],
  images: ProductImage[],
  _variants: ProductVariant[],
  sourceUrl: string,
): void {
  const hasFact = (field: string) => facts.some(f => f.fieldName === field)

  // Title from page title or h1
  if (!hasFact('title')) {
    const h1 = $('h1').first().text().trim()
    if (h1) facts.push(fact('title', h1, SourceTrust.SOURCE_PAGE, sourceUrl, 0.5))
  }

  // Price selectors (ordered by specificity)
  if (!hasFact('price')) {
    const priceSelectors = [
      '[itemprop="price"]',
      '[data-price]',
      '.price',
      '#price',
      '.product-price',
      '.current-price',
    ]
    for (const sel of priceSelectors) {
      const el = $(sel).first()
      const raw =
        el.attr('content') ?? el.attr('data-price') ?? el.text().trim()
      if (raw) {
        const normalized = parsePrice(raw)
        if (normalized) {
          facts.push(fact('price', raw, SourceTrust.SOURCE_PAGE, sourceUrl, 0.7, normalized))
          break
        }
      }
    }
  }

  // SKU
  if (!hasFact('sku')) {
    const skuEl = $('[itemprop="sku"]').first()
    const skuData = $('[data-sku]').first()
    const sku = skuEl.attr('content') ?? skuEl.text().trim() ?? skuData.attr('data-sku')
    if (sku?.trim()) {
      facts.push(fact('sku', sku.trim(), SourceTrust.SOURCE_PAGE, sourceUrl, 0.8))
    }
  }

  // GTIN — look for patterns in meta or specific elements
  if (!hasFact('gtin')) {
    const gtinEl = $('[itemprop="gtin13"], [itemprop="gtin8"], [itemprop="gtin"]').first()
    const gtinVal = gtinEl.attr('content') ?? gtinEl.text().trim()
    if (gtinVal) {
      facts.push(fact('gtin', gtinVal, SourceTrust.SOURCE_PAGE, sourceUrl, 0.9, cleanGtin(gtinVal)))
    } else {
      // Search page text for EAN-like patterns
      const text = $('body').text()
      const eanMatch = text.match(/\b(EAN|GTIN|čárový kód)[:\s]+(\d{8}|\d{13}|\d{14})\b/i)
      if (eanMatch?.[2]) {
        facts.push(fact('gtin', eanMatch[2], SourceTrust.SOURCE_PAGE, sourceUrl, 0.6, eanMatch[2]))
      }
    }
  }

  // Brand
  if (!hasFact('brand')) {
    const brandEl = $('[itemprop="brand"]').first()
    const brand = brandEl.attr('content') ?? brandEl.find('[itemprop="name"]').text().trim() ?? brandEl.text().trim()
    if (brand?.trim()) {
      facts.push(fact('brand', brand.trim(), SourceTrust.SOURCE_PAGE, sourceUrl, 0.8, brand.trim()))
    }
  }

  // Images from product galleries
  const imgSelectors = [
    '[itemprop="image"]',
    '.product-gallery img',
    '.product-images img',
    '.gallery img',
    '#product-images img',
  ]
  for (const sel of imgSelectors) {
    $(sel).each((i, el) => {
      const src = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-zoom-image')
      if (src && isAbsoluteImageUrl(src, sourceUrl)) {
        const abs = toAbsoluteUrl(src, sourceUrl)
        images.push({ sourceUrl: abs, sortOrder: images.length })
      }
    })
    if (images.length > 0) break
  }

  // Description
  if (!hasFact('description')) {
    const descEl = $('[itemprop="description"]').first()
    const desc = descEl.text().trim()
    if (desc.length > 20) {
      facts.push(fact('description', desc, SourceTrust.SOURCE_PAGE, sourceUrl, 0.7))
    }
  }
}

// ---- JSON-LD helpers ----

function extractJsonLdProducts(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>

  if (Array.isArray(obj['@graph'])) {
    return (obj['@graph'] as unknown[])
      .filter(isProductNode)
      .map(x => x as Record<string, unknown>)
  }

  if (Array.isArray(data)) {
    return (data as unknown[])
      .filter(isProductNode)
      .map(x => x as Record<string, unknown>)
  }

  if (isProductNode(data)) return [obj]

  return []
}

function isProductNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const type = (node as Record<string, unknown>)['@type']
  return type === 'Product' || (Array.isArray(type) && type.includes('Product'))
}

function parseJsonLdProduct(
  product: Record<string, unknown>,
  sourceUrl: string,
): ProductFact[] {
  const facts: ProductFact[] = []
  const src = SourceTrust.SOURCE_PAGE

  const name = getString(product, 'name')
  if (name) facts.push(fact('title', name, src, sourceUrl, 0.9))

  const description = getString(product, 'description')
  if (description) facts.push(fact('description', description, src, sourceUrl, 0.85))

  const brand = getNestedString(product, 'brand', 'name') ?? getString(product, 'brand')
  if (brand) facts.push(fact('brand', brand, src, sourceUrl, 0.95, brand))

  const sku = getString(product, 'sku')
  if (sku) facts.push(fact('sku', sku, src, sourceUrl, 0.95))

  const mpn = getString(product, 'mpn')
  if (mpn) facts.push(fact('mpn', mpn, src, sourceUrl, 0.95))

  for (const field of ['gtin13', 'gtin8', 'gtin14', 'gtin']) {
    const val = getString(product, field)
    if (val) {
      facts.push(fact('gtin', val, src, sourceUrl, 0.98, cleanGtin(val)))
      break
    }
  }

  // Offer price
  const offers = getOffers(product)
  if (offers.length > 0) {
    const firstOffer = offers[0]!
    const price = getString(firstOffer, 'price') ?? getString(firstOffer, 'lowPrice')
    const currency = getString(firstOffer, 'priceCurrency')
    if (price) {
      facts.push(fact('price', price, src, sourceUrl, 0.95, parsePrice(price) ?? price))
    }
    if (currency) {
      facts.push(fact('currency', currency, src, sourceUrl, 0.95))
    }
  }

  return facts
}

function extractJsonLdImages(product: Record<string, unknown>): ProductImage[] {
  const images: ProductImage[] = []
  const imgField = product['image']

  if (typeof imgField === 'string') {
    images.push({ sourceUrl: imgField, sortOrder: 0 })
  } else if (Array.isArray(imgField)) {
    imgField.forEach((img, i) => {
      const url = typeof img === 'string' ? img : getString(img as Record<string, unknown>, 'url')
      if (url) images.push({ sourceUrl: url, sortOrder: i })
    })
  } else if (imgField && typeof imgField === 'object') {
    const url = getString(imgField as Record<string, unknown>, 'url')
    if (url) images.push({ sourceUrl: url, sortOrder: 0 })
  }

  return images
}

function extractJsonLdVariants(product: Record<string, unknown>): ProductVariant[] {
  const variants: ProductVariant[] = []
  const hasVariant = product['hasVariant']
  if (!Array.isArray(hasVariant)) return variants

  for (const v of hasVariant as unknown[]) {
    if (!v || typeof v !== 'object') continue
    const vObj = v as Record<string, unknown>

    const sku = getString(vObj, 'sku')
    const gtin = getString(vObj, 'gtin13') ?? getString(vObj, 'gtin')
    const name = getString(vObj, 'name')

    const optionValues: Record<string, string> = {}
    const additionalProperty = vObj['additionalProperty']
    if (Array.isArray(additionalProperty)) {
      for (const prop of additionalProperty as unknown[]) {
        if (prop && typeof prop === 'object') {
          const p = prop as Record<string, unknown>
          const pName = getString(p, 'name')
          const pValue = getString(p, 'value')
          if (pName && pValue) optionValues[pName] = pValue
        }
      }
    }

    if (name && Object.keys(optionValues).length === 0) {
      optionValues['name'] = name
    }

    variants.push({
      variantKey: sku ?? gtin ?? name ?? String(variants.length),
      sku: sku ?? undefined,
      gtin: gtin ?? undefined,
      optionValues,
    })
  }

  return variants
}

// ---- Utility ----

function fact(
  fieldName: string,
  value: unknown,
  sourceType: SourceTrust,
  sourceUrl: string,
  confidence: number,
  normalizedValue?: string,
): ProductFact {
  return {
    id: randomUUID(),
    fieldName,
    valueJson: value,
    normalizedValue,
    sourceType,
    sourceUrl,
    confidence,
    isSelected: true,
  }
}

function pushFacts(target: ProductFact[], incoming: ProductFact[]): void {
  for (const f of incoming) {
    if (!target.find(e => e.fieldName === f.fieldName)) {
      target.push(f)
    }
  }
}

function pushImages(target: ProductImage[], incoming: ProductImage[]): void {
  target.push(...incoming)
}

function pushVariants(target: ProductVariant[], incoming: ProductVariant[]): void {
  for (const v of incoming) {
    if (!target.find(e => e.variantKey === v.variantKey)) {
      target.push(v)
    }
  }
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key]
  return typeof val === 'string' && val.trim() ? val.trim() : undefined
}

function getNestedString(
  obj: Record<string, unknown>,
  key: string,
  subKey: string,
): string | undefined {
  const sub = obj[key]
  if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
    return getString(sub as Record<string, unknown>, subKey)
  }
  return undefined
}

function getOffers(product: Record<string, unknown>): Record<string, unknown>[] {
  const offers = product['offers']
  if (!offers) return []
  if (Array.isArray(offers)) return offers.filter(o => o && typeof o === 'object') as Record<string, unknown>[]
  if (typeof offers === 'object') return [offers as Record<string, unknown>]
  return []
}

function parsePrice(raw: string): string | undefined {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? undefined : num.toFixed(2)
}

function cleanGtin(val: string): string {
  return val.replace(/\D/g, '')
}

function isAbsoluteImageUrl(src: string, base: string): boolean {
  try {
    new URL(src, base)
    return true
  } catch {
    return false
  }
}

function toAbsoluteUrl(src: string, base: string): string {
  return new URL(src, base).toString()
}
