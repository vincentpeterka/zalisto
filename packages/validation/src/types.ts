import type { IssueSeverity, ValidationIssueCode } from '@zalisto/domain'

export interface DraftSnapshot {
  id: string
  status: string
  brand: string | null
  modelName: string | null
  manufacturerPartNumber: string | null
  gtin: string | null
  titleCs: string | null
  shortDescriptionCs: string | null
  longDescriptionCs: string | null
  targetPrice: string | null
  categoryId: string | null
  categoryConfidence: string | null
}

export interface FactSnapshot {
  id: string
  fieldName: string
  isSelected: boolean
}

export interface ImageSnapshot {
  id: string
  status: string
  rightsConfirmed: boolean
}

export interface ExistingIssue {
  code: string
  severity: string
  resolved: boolean
}

export interface RuleViolation {
  code: string
  severity: IssueSeverity
  fieldName?: string
  message: string
  details?: Record<string, unknown>
}

export interface ValidationResult {
  violations: RuleViolation[]
  finalStatus: 'READY_FOR_REVIEW' | 'NEEDS_REVIEW' | 'BLOCKED'
}
