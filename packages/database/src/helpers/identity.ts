import { db, productDrafts, validationIssues, sourceItems, importBatches } from '../index.js'
import { eq, and, ne, sql } from 'drizzle-orm'

export interface ValidationIssueInput {
  productDraftId: string
  code: string
  fieldName?: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'
  message: string
  details?: Record<string, unknown>
}

export async function insertValidationIssue(issue: ValidationIssueInput): Promise<void> {
  await db.insert(validationIssues).values({
    productDraftId: issue.productDraftId,
    code: issue.code,
    fieldName: issue.fieldName ?? null,
    severity: issue.severity,
    message: issue.message,
    details: issue.details ?? {},
  })
}

export interface DraftIdentityUpdate {
  gtin?: string | null
  brand?: string | null
  manufacturerPartNumber?: string | null
  status?: string
}

export async function updateDraftIdentity(draftId: string, data: DraftIdentityUpdate): Promise<void> {
  await db.update(productDrafts)
    .set({
      ...(data.gtin !== undefined && { gtin: data.gtin }),
      ...(data.brand !== undefined && { brand: data.brand }),
      ...(data.manufacturerPartNumber !== undefined && { manufacturerPartNumber: data.manufacturerPartNumber }),
      ...(data.status !== undefined && { status: data.status as 'BLOCKED' | 'NEEDS_REVIEW' | 'GENERATING_CONTENT' }),
      updatedAt: sql`now()`,
    })
    .where(eq(productDrafts.id, draftId))
}

/**
 * Find another draft in the same project that already has this GTIN.
 * Returns the conflicting draft id, or null.
 */
export async function findDraftByGtinInProject(
  projectId: string,
  gtin: string,
  excludeDraftId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: productDrafts.id })
    .from(productDrafts)
    .innerJoin(sourceItems, eq(sourceItems.id, productDrafts.sourceItemId))
    .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
    .where(
      and(
        eq(importBatches.projectId, projectId),
        eq(productDrafts.gtin, gtin),
        ne(productDrafts.id, excludeDraftId),
      ),
    )
    .limit(1)

  return rows[0]?.id ?? null
}

/**
 * Find another draft in the same project with same normalized brand + MPN.
 * Returns the conflicting draft id, or null.
 */
export async function findDraftByBrandMpnInProject(
  projectId: string,
  brand: string,
  mpn: string,
  excludeDraftId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: productDrafts.id })
    .from(productDrafts)
    .innerJoin(sourceItems, eq(sourceItems.id, productDrafts.sourceItemId))
    .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
    .where(
      and(
        eq(importBatches.projectId, projectId),
        eq(productDrafts.brand, brand),
        eq(productDrafts.manufacturerPartNumber, mpn),
        ne(productDrafts.id, excludeDraftId),
      ),
    )
    .limit(1)

  return rows[0]?.id ?? null
}
