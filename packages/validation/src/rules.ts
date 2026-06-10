import type { DraftSnapshot, FactSnapshot, ImageSnapshot, ExistingIssue, RuleViolation } from './types.js'

export function runValidationRules(
  draft: DraftSnapshot,
  _facts: FactSnapshot[],
  images: ImageSnapshot[],
  existingIssues: ExistingIssue[],
): RuleViolation[] {
  const violations: RuleViolation[] = []
  const existingCodes = new Set(existingIssues.filter(i => !i.resolved).map(i => i.code))

  if (!draft.titleCs || draft.titleCs.trim().length < 3) {
    violations.push({
      code: 'MISSING_TITLE',
      severity: 'BLOCKER',
      fieldName: 'title_cs',
      message: 'Product title is missing or too short',
    })
  }

  if (!draft.targetPrice || Number(draft.targetPrice) <= 0) {
    if (!existingCodes.has('PRICE_VAT_UNKNOWN')) {
      violations.push({
        code: 'MISSING_PRICE',
        severity: 'ERROR',
        fieldName: 'target_price',
        message: 'Target price is not set',
      })
    }
  }

  if (!draft.brand) {
    violations.push({
      code: 'MISSING_BRAND',
      severity: 'WARNING',
      fieldName: 'brand',
      message: 'Brand is not identified',
    })
  }

  if (!draft.modelName && !draft.manufacturerPartNumber) {
    violations.push({
      code: 'MISSING_MODEL',
      severity: 'WARNING',
      fieldName: 'model_name',
      message: 'Model name or MPN is not identified',
    })
  }

  if (!draft.categoryId) {
    violations.push({
      code: 'MISSING_CATEGORY',
      severity: 'ERROR',
      fieldName: 'category_id',
      message: 'Product category is not assigned',
    })
  }

  if (!draft.shortDescriptionCs || draft.shortDescriptionCs.trim().length < 10) {
    violations.push({
      code: 'MISSING_DESCRIPTION',
      severity: 'WARNING',
      fieldName: 'short_description_cs',
      message: 'Short description is missing or too short',
    })
  }

  const usableImages = images.filter(img => img.status === 'PROCESSED')
  if (usableImages.length === 0 && !existingCodes.has('NO_USABLE_IMAGE') && !existingCodes.has('NO_IMAGES_FOUND') && !existingCodes.has('ALL_IMAGES_FAILED')) {
    violations.push({
      code: 'NO_USABLE_IMAGE',
      severity: 'ERROR',
      message: images.length > 0
        ? 'All images failed processing — no usable image available'
        : 'No images found for this product',
    })
  }

  const unconfirmedImages = images.filter(img => img.status === 'PROCESSED' && !img.rightsConfirmed)
  if (unconfirmedImages.length > 0 && !existingCodes.has('RIGHTS_NOT_CONFIRMED')) {
    violations.push({
      code: 'RIGHTS_NOT_CONFIRMED',
      severity: 'INFO',
      message: `${unconfirmedImages.length} image(s) have unconfirmed rights`,
      details: { imageIds: unconfirmedImages.map(i => i.id) },
    })
  }

  return violations
}
