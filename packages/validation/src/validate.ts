import { runValidationRules } from './rules.js'
import type { DraftSnapshot, FactSnapshot, ImageSnapshot, ExistingIssue, ValidationResult } from './types.js'

export function validateDraft(
  draft: DraftSnapshot,
  facts: FactSnapshot[],
  images: ImageSnapshot[],
  existingIssues: ExistingIssue[],
): ValidationResult {
  const newViolations = runValidationRules(draft, facts, images, existingIssues)

  const allActiveIssues = [
    ...existingIssues.filter(i => !i.resolved).map(i => ({ severity: i.severity })),
    ...newViolations.map(v => ({ severity: v.severity })),
  ]

  let finalStatus: ValidationResult['finalStatus'] = 'READY_FOR_REVIEW'

  if (allActiveIssues.some(i => i.severity === 'BLOCKER')) {
    finalStatus = 'BLOCKED'
  } else if (allActiveIssues.some(i => i.severity === 'ERROR' || i.severity === 'WARNING')) {
    finalStatus = 'NEEDS_REVIEW'
  }

  return { violations: newViolations, finalStatus }
}
