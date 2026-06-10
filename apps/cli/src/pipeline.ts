import path from 'path'
import { fetchPage } from './fetcher.js'
import { extractFacts } from './extractor.js'
import { validateEan } from './ean-validator.js'
import { generateContent } from './ai-content.js'
import { processImages } from './image-processor.js'
import { categorize } from './categorizer.js'
import { writeOutput } from './reporter.js'
import type { ProductDraft, ValidationIssue } from '@zalisto/domain'
import { IssueSeverity, ValidationIssueCode } from '@zalisto/domain'

interface PipelineOptions {
  url: string
  categories?: string
  output: string
  lang: string
}

export async function runPipeline(options: PipelineOptions): Promise<void> {
  const outputDir = path.resolve(options.output)
  console.log(`\n=== AI Product Importer ===`)
  console.log(`URL:    ${options.url}`)
  console.log(`Output: ${outputDir}\n`)

  const draft: ProductDraft = {
    sourceUrl: options.url,
    facts: [],
    variants: [],
    images: [],
    issues: [],
  }

  // Step 1: Fetch
  console.log('[1/7] Fetching page...')
  const fetched = await fetchPage(options.url)
  console.log(`      Status: ${fetched.statusCode}, Size: ${Math.round(fetched.html.length / 1024)}KB`)

  // Step 2: Extract facts
  console.log('[2/7] Extracting product facts...')
  const { facts, images, variants } = extractFacts(fetched.html, options.url)
  draft.facts = facts
  draft.images = images
  draft.variants = variants

  const gtin = facts.find(f => f.fieldName === 'gtin')?.normalizedValue
  const brand = facts.find(f => f.fieldName === 'brand')?.normalizedValue
  const model = facts.find(f => f.fieldName === 'model')?.normalizedValue
  const price = facts.find(f => f.fieldName === 'price')

  draft.gtin = gtin
  draft.brand = brand
  draft.modelName = model
  if (price?.normalizedValue) {
    const parsed = parseFloat(price.normalizedValue)
    if (!isNaN(parsed)) draft.sourcePrice = parsed
  }

  console.log(`      Facts: ${facts.length}, Images: ${images.length}, Variants: ${variants.length}`)
  if (brand) console.log(`      Brand: ${brand}`)
  if (model) console.log(`      Model: ${model}`)
  if (gtin) console.log(`      GTIN:  ${gtin}`)

  // Step 3: EAN validation
  console.log('[3/7] Validating GTIN/EAN...')
  if (gtin) {
    const eanResult = validateEan(gtin)
    if (!eanResult.valid) {
      const issue: ValidationIssue = {
        code: ValidationIssueCode.GTIN_INVALID_CHECKSUM,
        severity: IssueSeverity.BLOCKER,
        fieldName: 'gtin',
        message: `EAN/GTIN "${gtin}" has invalid checksum`,
      }
      draft.issues.push(issue)
      console.log(`      ❌ BLOCKER: ${issue.message}`)
    } else {
      console.log(`      ✓ Valid ${eanResult.type}: ${gtin}`)
    }
  } else {
    draft.issues.push({
      code: ValidationIssueCode.MISSING_SOURCE,
      severity: IssueSeverity.WARNING,
      fieldName: 'gtin',
      message: 'No GTIN/EAN found on page',
    })
    console.log('      ⚠ No GTIN found')
  }

  if (!brand) {
    draft.issues.push({
      code: ValidationIssueCode.MISSING_BRAND,
      severity: IssueSeverity.ERROR,
      fieldName: 'brand',
      message: 'Brand not found',
    })
  }
  if (!model) {
    draft.issues.push({
      code: ValidationIssueCode.MISSING_MODEL,
      severity: IssueSeverity.WARNING,
      fieldName: 'model',
      message: 'Model name not found',
    })
  }

  // Step 4: AI content generation
  console.log('[4/7] Generating Czech content via AI...')
  try {
    const content = await generateContent(draft.facts, options.lang)
    draft.content = content
    console.log(`      ✓ Title: ${content.titleCs.slice(0, 60)}...`)
    console.log(`      ✓ Used ${content.usedFactIds.length} facts`)
    if (content.warnings.length > 0) {
      console.log(`      ⚠ AI warnings: ${content.warnings.join(', ')}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    draft.issues.push({
      code: ValidationIssueCode.MISSING_SOURCE,
      severity: IssueSeverity.ERROR,
      fieldName: 'content',
      message: `AI content generation failed: ${msg}`,
    })
    console.log(`      ❌ AI failed: ${msg}`)
  }

  // Step 5: Categorization
  console.log('[5/7] Categorizing product...')
  if (options.categories) {
    try {
      const category = await categorize(draft.facts, options.categories)
      draft.category = category
      console.log(`      ✓ Category: ${category.fullPath} (confidence: ${(category.confidence * 100).toFixed(0)}%)`)
      if (category.confidence < 0.8) {
        draft.issues.push({
          code: ValidationIssueCode.CATEGORY_LOW_CONFIDENCE,
          severity: IssueSeverity.WARNING,
          message: `Category confidence ${(category.confidence * 100).toFixed(0)}% is below threshold 80%`,
        })
      }
    } catch (err) {
      console.log(`      ⚠ Categorization failed: ${err instanceof Error ? err.message : err}`)
    }
  } else {
    console.log('      ⚠ No categories file provided, skipping')
  }

  // Step 6: Image processing
  console.log('[6/7] Processing images...')
  const processedImages = await processImages(draft.images.slice(0, 10))
  console.log(`      Processed: ${processedImages.length}/${draft.images.length}`)

  if (processedImages.length === 0 && draft.images.length > 0) {
    draft.issues.push({
      code: ValidationIssueCode.NO_USABLE_IMAGE,
      severity: IssueSeverity.ERROR,
      message: 'All image downloads failed',
    })
  }

  for (const img of processedImages) {
    if (img.width < 400 || img.height < 400) {
      draft.issues.push({
        code: ValidationIssueCode.IMAGE_TOO_SMALL,
        severity: IssueSeverity.WARNING,
        message: `Image ${img.sourceUrl} is too small (${img.width}×${img.height})`,
      })
    }
  }

  // Step 7: Write output
  console.log('[7/7] Writing output...')
  await writeOutput(draft, processedImages, outputDir)

  // Summary
  const blockers = draft.issues.filter(i => i.severity === IssueSeverity.BLOCKER)
  const errors = draft.issues.filter(i => i.severity === IssueSeverity.ERROR)
  const warnings = draft.issues.filter(i => i.severity === IssueSeverity.WARNING)

  console.log(`\n=== Result ===`)
  console.log(`Issues: ${blockers.length} blockers, ${errors.length} errors, ${warnings.length} warnings`)
  console.log(`Output: ${outputDir}/`)
  console.log(`  product.json`)
  console.log(`  product.csv`)
  console.log(`  validation.json`)
  if (processedImages.length > 0) {
    console.log(`  images/ (${processedImages.length} files)`)
  }

  if (blockers.length > 0) {
    console.log(`\n🔴 BLOCKED — resolve these issues before import:`)
    blockers.forEach(b => console.log(`   • ${b.message}`))
  } else if (errors.length > 0) {
    console.log(`\n⚠  Needs review — check errors in validation.json`)
  } else {
    console.log(`\n✅ Ready for review`)
  }
}
