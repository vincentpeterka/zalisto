import * as cheerio from 'cheerio'
import { extractJsonLd } from './json-ld.js'
import { extractOpenGraph } from './open-graph.js'
import { extractHtmlHeuristics } from './html-heuristics.js'
import type { ExtractionResult } from './types.js'

export type { ExtractionResult }

const MIN_FACTS_FOR_CONFIDENCE = 3
const CONFIDENCE_THRESHOLD = 0.4

function mergeResults(results: Partial<ExtractionResult>[]): ExtractionResult {
  const factsByField = new Map<string, ExtractionResult['facts'][0]>()
  const imagesByUrl = new Map<string, ExtractionResult['images'][0]>()
  const variantsBySku = new Map<string, ExtractionResult['variants'][0]>()

  for (const result of results) {
    for (const fact of result.facts ?? []) {
      const existing = factsByField.get(fact.fieldName)
      if (!existing || fact.confidence > existing.confidence) {
        factsByField.set(fact.fieldName, fact)
      }
    }
    for (const img of result.images ?? []) {
      if (!imagesByUrl.has(img.sourceUrl)) {
        imagesByUrl.set(img.sourceUrl, img)
      }
    }
    for (const variant of result.variants ?? []) {
      const key = variant.sku ?? JSON.stringify(variant.optionValues)
      if (!variantsBySku.has(key)) variantsBySku.set(key, variant)
    }
  }

  const facts = Array.from(factsByField.values())
  const keyFacts = facts.filter(f =>
    ['name', 'brand', 'sourcePrice', 'gtin', 'sku'].includes(f.fieldName)
  )
  const avgConfidence = keyFacts.length > 0
    ? keyFacts.reduce((sum, f) => sum + f.confidence, 0) / keyFacts.length
    : 0
  const confidence = Math.min(1, (keyFacts.length / MIN_FACTS_FOR_CONFIDENCE) * avgConfidence)

  return {
    facts,
    images: Array.from(imagesByUrl.values()),
    variants: Array.from(variantsBySku.values()),
    confidence,
    needsBrowserFallback: confidence < CONFIDENCE_THRESHOLD,
  }
}

export function extractProduct(html: string, sourceUrl: string): ExtractionResult {
  const $ = cheerio.load(html)

  const jsonLd = extractJsonLd($, sourceUrl)
  const og = extractOpenGraph($, sourceUrl)
  const heuristics = extractHtmlHeuristics($, sourceUrl)

  return mergeResults([jsonLd, og, heuristics])
}
