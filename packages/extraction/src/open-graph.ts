import type { CheerioAPI } from 'cheerio'
import { SourceTrust } from '@zalisto/domain'
import type { ExtractionResult } from './types.js'

export function extractOpenGraph($: CheerioAPI, sourceUrl: string): Partial<ExtractionResult> {
  const facts: ExtractionResult['facts'] = []
  const images: ExtractionResult['images'] = []

  const og = (property: string): string | undefined => {
    const val = $(`meta[property="og:${property}"]`).attr('content')
    return val?.trim() || undefined
  }

  const addFact = (fieldName: string, value: unknown, normalized?: string) => {
    facts.push({
      fieldName,
      valueJson: value,
      normalizedValue: normalized,
      sourceType: SourceTrust.SOURCE_PAGE,
      sourceUrl,
      confidence: 0.7,
      isSelected: false,
    })
  }

  const title = og('title')
  if (title) addFact('name', title)

  const description = og('description')
  if (description) addFact('description', description)

  const image = og('image')
  if (image) images.push({ sourceUrl: image, sortOrder: 0 })

  const priceAmount = $('meta[property="product:price:amount"]').attr('content')?.trim()
  const priceCurrency = $('meta[property="product:price:currency"]').attr('content')?.trim()
  if (priceAmount) {
    const price = parseFloat(priceAmount)
    if (!isNaN(price)) {
      addFact('sourcePrice', price, String(price))
      if (priceCurrency) addFact('currency', priceCurrency)
    }
  }

  const brand = $('meta[property="product:brand"]').attr('content')?.trim()
  if (brand) addFact('brand', brand)

  const ean = $('meta[property="product:ean"]').attr('content')?.trim()
  if (ean) addFact('gtin', ean, ean.replace(/\D/g, ''))

  return { facts, images }
}
