import fs from 'fs/promises'
import path from 'path'
import type { ProductDraft, ProcessedImage } from '@zalisto/domain'
import { exportImageFilename } from './image-processor.js'

export async function writeOutput(
  draft: ProductDraft,
  images: ProcessedImage[],
  outputDir: string,
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true })

  await writeProductJson(draft, images, outputDir)
  await writeProductCsv(draft, images, outputDir)
  await writeValidationJson(draft, outputDir)
  await writeImages(draft, images, outputDir)
}

async function writeProductJson(
  draft: ProductDraft,
  images: ProcessedImage[],
  outputDir: string,
): Promise<void> {
  const output = {
    sourceUrl: draft.sourceUrl,
    brand: draft.brand,
    modelName: draft.modelName,
    mpn: draft.manufacturerPartNumber,
    gtin: draft.gtin,
    sourcePrice: draft.sourcePrice,
    sourceCurrency: draft.sourceCurrency,
    title: draft.content?.titleCs,
    shortDescription: draft.content?.shortDescriptionCs,
    longDescription: draft.content?.longDescriptionCs,
    bulletPoints: draft.content?.bulletPoints,
    category: draft.category
      ? { id: draft.category.id, path: draft.category.fullPath, confidence: draft.category.confidence }
      : null,
    variants: draft.variants,
    images: images.map((img, i) => ({
      filename: exportImageFilename(draft.brand, draft.modelName, i + 1),
      sourceUrl: img.sourceUrl,
      width: img.width,
      height: img.height,
      sizeBytes: img.sizeBytes,
      hash: img.hash,
    })),
    facts: draft.facts.map(f => ({
      id: f.id,
      field: f.fieldName,
      value: f.normalizedValue ?? f.valueJson,
      source: f.sourceType,
      confidence: f.confidence,
    })),
    issues: draft.issues,
    generatedAt: new Date().toISOString(),
  }

  await fs.writeFile(
    path.join(outputDir, 'product.json'),
    JSON.stringify(output, null, 2),
    'utf-8',
  )
}

async function writeProductCsv(
  draft: ProductDraft,
  images: ProcessedImage[],
  outputDir: string,
): Promise<void> {
  const imageFilenames = images
    .map((_, i) => exportImageFilename(draft.brand, draft.modelName, i + 1))
    .join('|')

  const rows = [
    ['Field', 'Value'],
    ['Source URL', draft.sourceUrl],
    ['Brand', draft.brand ?? ''],
    ['Model', draft.modelName ?? ''],
    ['MPN', draft.manufacturerPartNumber ?? ''],
    ['GTIN/EAN', draft.gtin ?? ''],
    ['Source Price', String(draft.sourcePrice ?? '')],
    ['Currency', draft.sourceCurrency ?? ''],
    ['Title CZ', draft.content?.titleCs ?? ''],
    ['Short Description CZ', draft.content?.shortDescriptionCs ?? ''],
    ['Long Description CZ', draft.content?.longDescriptionCs ?? ''],
    ['Category', draft.category?.fullPath ?? ''],
    ['Category Confidence', String(draft.category?.confidence ?? '')],
    ['Images', imageFilenames],
    ['Issues', draft.issues.map(i => `${i.severity}: ${i.message}`).join(' | ')],
  ]

  const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n')
  await fs.writeFile(path.join(outputDir, 'product.csv'), '﻿' + csv, 'utf-8')
}

async function writeValidationJson(draft: ProductDraft, outputDir: string): Promise<void> {
  const report = {
    sourceUrl: draft.sourceUrl,
    issueCount: draft.issues.length,
    blockers: draft.issues.filter(i => i.severity === 'BLOCKER'),
    errors: draft.issues.filter(i => i.severity === 'ERROR'),
    warnings: draft.issues.filter(i => i.severity === 'WARNING'),
    infos: draft.issues.filter(i => i.severity === 'INFO'),
    overallStatus: draft.issues.some(i => i.severity === 'BLOCKER')
      ? 'BLOCKED'
      : draft.issues.some(i => i.severity === 'ERROR')
        ? 'NEEDS_REVIEW'
        : 'READY_FOR_REVIEW',
  }

  await fs.writeFile(
    path.join(outputDir, 'validation.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  )
}

async function writeImages(
  draft: ProductDraft,
  images: ProcessedImage[],
  outputDir: string,
): Promise<void> {
  if (images.length === 0) return

  const imagesDir = path.join(outputDir, 'images')
  await fs.mkdir(imagesDir, { recursive: true })

  for (let i = 0; i < images.length; i++) {
    const img = images[i]!
    const filename = exportImageFilename(draft.brand, draft.modelName, i + 1)
    await fs.writeFile(path.join(imagesDir, filename), img.webpBuffer)
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
