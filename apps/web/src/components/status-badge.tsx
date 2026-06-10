import type { ProductStatus, IssueSeverity } from '../lib/types'

const STATUS_CLASS: Record<string, string> = {
  READY_FOR_REVIEW: 'badge-ready',
  NEEDS_REVIEW: 'badge-review',
  BLOCKED: 'badge-blocked',
  APPROVED: 'badge-approved',
  EXPORTED: 'badge-approved',
  FAILED: 'badge-blocked',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Čekající',
  FETCHING: 'Stahuje se',
  EXTRACTING: 'Extrakce',
  IDENTIFYING: 'Identifikace',
  ENRICHING: 'Obohacení',
  GENERATING_CONTENT: 'AI obsah',
  PROCESSING_IMAGES: 'Obrázky',
  VALIDATING: 'Validace',
  READY_FOR_REVIEW: 'Připraven',
  NEEDS_REVIEW: 'Ke kontrole',
  BLOCKED: 'Blokován',
  APPROVED: 'Schválen',
  EXPORTED: 'Exportován',
  FAILED: 'Chyba',
}

export function StatusBadge({ status }: { status: ProductStatus | string }) {
  const cls = STATUS_CLASS[status] ?? 'badge-processing'
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status] ?? status}</span>
}

const SEVERITY_CLASS: Record<string, string> = {
  BLOCKER: 'badge-blocker',
  ERROR: 'badge-error',
  WARNING: 'badge-warning',
  INFO: 'badge-info',
}

export function SeverityBadge({ severity }: { severity: IssueSeverity | string }) {
  return <span className={`badge ${SEVERITY_CLASS[severity] ?? 'badge-info'}`}>{severity}</span>
}
