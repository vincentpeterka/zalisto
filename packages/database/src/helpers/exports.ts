import { db } from '../client.js'
import { exports as exportsTable } from '../schema/review.js'
import { eq } from 'drizzle-orm'

export async function insertExportRecord(data: {
  batchId: string
  format: 'SHOPTET_XLSX' | 'CSV' | 'ZIP'
  createdBy: string
}) {
  const [row] = await db.insert(exportsTable).values({
    batchId: data.batchId,
    format: data.format,
    createdBy: data.createdBy,
    status: 'PENDING',
    productCount: 0,
  }).returning()
  return row!
}

export async function updateExportRecord(id: string, updates: {
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  storageKey?: string
  productCount?: number
}) {
  await db.update(exportsTable).set(updates).where(eq(exportsTable.id, id))
}

export async function findExportById(id: string) {
  const [row] = await db.select().from(exportsTable).where(eq(exportsTable.id, id))
  return row ?? null
}

export async function findExportsByBatchId(batchId: string) {
  return db.select().from(exportsTable)
    .where(eq(exportsTable.batchId, batchId))
    .orderBy(exportsTable.createdAt)
}
