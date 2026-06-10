import type { CheerioAPI } from 'cheerio'
import { SourceTrust } from '@zalisto/domain'
import type { ExtractionResult } from './types.js'

type JsonLdNode = Record<string, unknown>

function normalizeType(val: unknown): string[] {
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
  return []
}

function firstString(val: unknown): string | undefined {
  if (typeof val === 'string') return val.trim() || undefined
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0].trim() || undefined
  return undefined
}

function parseOffer(offer: JsonLdNode): { price?: number; currency?: string } {
  const price = typeof offer['price'] === 'number'
    ? offer['price']
    : typeof offer['price'] === 'string'
      ? parseFloat(offer['price'])
      : undefined
  const currency = firstString(offer['priceCurrency'])
  return { price: price !== undefined && !isNaN(price) && price > 0 ? price : undefined, currency }
}

export function extractJsonLd($: CheerioAPI, sourceUrl: string): Partial<ExtractionResult> {
  const facts: ExtractionResult['facts'] = []
  const images: ExtractionResult['images'] = []
  const variants: ExtractionResult['variants'] = []

  const scripts: JsonLdNode[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html()
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        if (node && typeof node === 'object') {
          scripts.push(node as JsonLdNode)
          const graph = (node as JsonLdNode)['@graph']
          if (Array.isArray(graph)) {
            for (const g of graph) {
              if (g && typeof g === 'object') scripts.push(g as JsonLdNode)
            }
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  })

  const addFact = (fieldName: string, value: unknown, normalized?: string) => {
    facts.push({
      fieldName,
      valueJson: value,
      normalizedValue: normalized,
      sourceType: SourceTrust.SOURCE_PAGE,
      sourceUrl,
      confidence: 0.9,
      isSelected: false,
    })
  }

  for (const node of scripts) {
    const types = normalizeType(node['@type'])
    if (!types.some(t => t === 'Product' || t.endsWith('/Product'))) continue

    const name = firstString(node['name'])
    if (name) addFact('name', name)

    const brand = node['brand']
    if (brand && typeof brand === 'object') {
      const brandName = firstString((brand as JsonLdNode)['name'])
      if (brandName) addFact('brand', brandName)
    } else if (typeof brand === 'string' && brand) {
      addFact('brand', brand)
    }

    const description = firstString(node['description'])
    if (description) addFact('description', description)

    const mpn = firstString(node['mpn'])
    if (mpn) addFact('manufacturerPartNumber', mpn)

    const sku = firstString(node['sku'])
    if (sku) addFact('sku', sku)

    for (const gtinKey of ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14']) {
      const gtin = firstString(node[gtinKey])
      if (gtin) {
        addFact('gtin', gtin, gtin.replace(/\D/g, ''))
        break
      }
    }

    const imageNode = node['image']
    const imageUrls: string[] = []
    if (typeof imageNode === 'string') imageUrls.push(imageNode)
    else if (Array.isArray(imageNode)) {
      for (const img of imageNode) {
        if (typeof img === 'string') imageUrls.push(img)
        else if (img && typeof img === 'object' && typeof (img as JsonLdNode)['url'] === 'string') {
          imageUrls.push((img as JsonLdNode)['url'] as string)
        }
      }
    } else if (imageNode && typeof imageNode === 'object') {
      const url = firstString((imageNode as JsonLdNode)['url'])
      if (url) imageUrls.push(url)
    }
    imageUrls.forEach((url, i) => images.push({ sourceUrl: url, sortOrder: i }))

    const offerNode = node['offers']
    const offerList: JsonLdNode[] = []
    if (Array.isArray(offerNode)) {
      offerList.push(...offerNode.filter((o): o is JsonLdNode => !!o && typeof o === 'object'))
    } else if (offerNode && typeof offerNode === 'object') {
      offerList.push(offerNode as JsonLdNode)
    }

    for (const offer of offerList) {
      const { price, currency } = parseOffer(offer)
      if (price !== undefined) {
        addFact('sourcePrice', price, String(price))
        if (currency) addFact('currency', currency)
        break
      }
    }

    if (offerList.length > 1) {
      const variantOffers = offerList.filter(o => firstString(o['sku']))
      for (const offer of variantOffers) {
        const variantSku = firstString(offer['sku'])
        const { price } = parseOffer(offer)
        if (variantSku) {
          variants.push({ sku: variantSku, optionValues: {}, sourcePrice: price })
        }
      }
    }
  }

  return { facts, images, variants }
}
