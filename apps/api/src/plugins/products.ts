import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db, productDrafts, productFacts, productImages, validationIssues, reviewDecisions,
  sourceItems, importBatches, organizationMembers, projects,
} from '@zalisto/database'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { logAudit } from '../lib/audit.js'
import { env } from '../lib/env.js'

const auth = { preHandler: [requireAuth] }

async function assertProjectAccess(userId: string, projectId: string, roles?: string[]) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
  if (!project) return null
  const [member] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId),
    ))
  if (!member) return null
  if (roles && !roles.includes(member.role)) return null
  return { project, member }
}

async function assertDraftAccess(userId: string, draftId: string) {
  const [draft] = await db.select({
    id: productDrafts.id,
    status: productDrafts.status,
    projectId: importBatches.projectId,
    orgId: projects.organizationId,
  })
    .from(productDrafts)
    .innerJoin(sourceItems, eq(sourceItems.id, productDrafts.sourceItemId))
    .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
    .innerJoin(projects, eq(projects.id, importBatches.projectId))
    .where(eq(productDrafts.id, draftId))

  if (!draft) return null

  const [member] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, draft.orgId),
      eq(organizationMembers.userId, userId),
    ))
  if (!member) return null
  return { draft, member }
}

const REVIEW_STATUSES = ['READY_FOR_REVIEW', 'NEEDS_REVIEW', 'BLOCKED', 'APPROVED']

const fieldOverrideSchema = z.object({
  field: z.enum(['titleCs', 'shortDescriptionCs', 'longDescriptionCs', 'brand', 'modelName', 'targetPrice', 'categoryId']),
  value: z.union([z.string(), z.number(), z.null()]),
  note: z.string().optional(),
})

const bulkApproveSchema = z.object({
  draftIds: z.array(z.string().uuid()).min(1).max(200),
})

const productsPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  const fetchQueue = new Queue('fetch-source', { connection: redis })

  fastify.addHook('onClose', async () => {
    await fetchQueue.close()
    await redis.quit()
  })

  // List products in a project
  fastify.get('/projects/:projectId/products', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }
    const { status, page = '1', limit = '50' } = request.query as {
      status?: string
      page?: string
      limit?: string
    }

    const access = await assertProjectAccess(userId, projectId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)))
    const offset = (pageNum - 1) * limitNum

    const query = db
      .select({
        id: productDrafts.id,
        status: productDrafts.status,
        titleCs: productDrafts.titleCs,
        brand: productDrafts.brand,
        modelName: productDrafts.modelName,
        gtin: productDrafts.gtin,
        targetPrice: productDrafts.targetPrice,
        categoryId: productDrafts.categoryId,
        reviewRequired: productDrafts.reviewRequired,
        createdAt: productDrafts.createdAt,
        updatedAt: productDrafts.updatedAt,
        sourceUrl: sourceItems.sourceUrl,
      })
      .from(productDrafts)
      .innerJoin(sourceItems, eq(sourceItems.id, productDrafts.sourceItemId))
      .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
      .where(
        status
          ? and(eq(importBatches.projectId, projectId), eq(productDrafts.status, status as 'PENDING'))
          : eq(importBatches.projectId, projectId),
      )
      .limit(limitNum)
      .offset(offset)

    const rows = await query
    return reply.send({ products: rows, page: pageNum, limit: limitNum })
  })

  // Get product detail
  fastify.get('/products/:draftId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { draftId } = request.params as { draftId: string }

    const access = await assertDraftAccess(userId, draftId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, draftId))

    const facts = await db.select().from(productFacts).where(eq(productFacts.productDraftId, draftId))
    const images = await db.select().from(productImages).where(eq(productImages.productDraftId, draftId))
    const issues = await db.select().from(validationIssues).where(eq(validationIssues.productDraftId, draftId))
    const decisions = await db.select().from(reviewDecisions).where(eq(reviewDecisions.productDraftId, draftId))

    return reply.send({ draft, facts, images, issues, decisions })
  })

  // Field override
  fastify.patch('/products/:draftId/fields', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { draftId } = request.params as { draftId: string }

    const access = await assertDraftAccess(userId, draftId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const parsed = fieldOverrideSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { field, value, note } = parsed.data

    const [current] = await db.select().from(productDrafts).where(eq(productDrafts.id, draftId))
    const oldValue = current[field as keyof typeof current] ?? null

    const fieldMap: Record<string, string> = {
      titleCs: 'title_cs',
      shortDescriptionCs: 'short_description_cs',
      longDescriptionCs: 'long_description_cs',
      brand: 'brand',
      modelName: 'model_name',
      targetPrice: 'target_price',
      categoryId: 'category_id',
    }

    await db.update(productDrafts)
      .set({ [field]: value, updatedAt: sql`now()` })
      .where(eq(productDrafts.id, draftId))

    await db.insert(reviewDecisions).values({
      productDraftId: draftId,
      userId,
      action: 'FIELD_OVERRIDE',
      fieldName: fieldMap[field] ?? field,
      oldValue: oldValue as unknown,
      newValue: value,
      note: note ?? null,
    })

    await logAudit({
      organizationId: access.draft.orgId,
      actorUserId: userId,
      eventType: 'product.field_override',
      entityType: 'product_draft',
      entityId: draftId,
      payload: { field, oldValue, newValue: value },
    })

    return reply.send({ ok: true })
  })

  // Approve single product
  fastify.post('/products/:draftId/approve', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { draftId } = request.params as { draftId: string }

    const access = await assertDraftAccess(userId, draftId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const { draft } = access

    // Cannot approve if BLOCKED
    if (draft.status === 'BLOCKED') {
      return reply.code(422).send({ error: 'Cannot approve a BLOCKED product — resolve all BLOCKER issues first' })
    }

    if (!REVIEW_STATUSES.includes(draft.status)) {
      return reply.code(422).send({ error: `Product is not in a reviewable state (status=${draft.status})` })
    }

    await db.update(productDrafts)
      .set({ status: 'APPROVED', approvedAt: new Date(), approvedBy: userId, updatedAt: sql`now()` })
      .where(eq(productDrafts.id, draftId))

    await db.insert(reviewDecisions).values({
      productDraftId: draftId,
      userId,
      action: 'APPROVE',
    })

    return reply.send({ ok: true })
  })

  // Reject single product
  fastify.post('/products/:draftId/reject', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { draftId } = request.params as { draftId: string }

    const access = await assertDraftAccess(userId, draftId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const body = request.body as { note?: string } | null
    const note = body?.note ?? null

    await db.update(productDrafts)
      .set({ status: 'BLOCKED', updatedAt: sql`now()` })
      .where(eq(productDrafts.id, draftId))

    await db.insert(reviewDecisions).values({
      productDraftId: draftId,
      userId,
      action: 'REJECT',
      note,
    })

    return reply.send({ ok: true })
  })

  // Reprocess product (re-enqueue fetch-source)
  fastify.post('/products/:draftId/reprocess', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { draftId } = request.params as { draftId: string }

    const access = await assertDraftAccess(userId, draftId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const [sourceItem] = await db
      .select({ id: sourceItems.id, sourceUrl: sourceItems.sourceUrl })
      .from(sourceItems)
      .innerJoin(productDrafts, eq(productDrafts.sourceItemId, sourceItems.id))
      .where(eq(productDrafts.id, draftId))

    if (!sourceItem) return reply.code(404).send({ error: 'Source item not found' })

    await db.update(productDrafts)
      .set({ status: 'PENDING', updatedAt: sql`now()` })
      .where(eq(productDrafts.id, draftId))

    await fetchQueue.add('fetch-source', { sourceItemId: sourceItem.id, url: sourceItem.sourceUrl })

    await db.insert(reviewDecisions).values({
      productDraftId: draftId,
      userId,
      action: 'REPROCESS',
    })

    return reply.send({ ok: true })
  })

  // Bulk approve (READY_FOR_REVIEW only, no BLOCKER issues)
  fastify.post('/projects/:projectId/products/bulk-approve', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const access = await assertProjectAccess(userId, projectId)
    if (!access) return reply.code(403).send({ error: 'Forbidden' })

    const parsed = bulkApproveSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { draftIds } = parsed.data

    // Verify all drafts belong to this project and are READY_FOR_REVIEW
    const drafts = await db
      .select({ id: productDrafts.id, status: productDrafts.status })
      .from(productDrafts)
      .innerJoin(sourceItems, eq(sourceItems.id, productDrafts.sourceItemId))
      .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
      .where(and(
        eq(importBatches.projectId, projectId),
        inArray(productDrafts.id, draftIds),
      ))

    const notReady = drafts.filter(d => d.status !== 'READY_FOR_REVIEW')
    if (notReady.length > 0) {
      return reply.code(422).send({
        error: 'Some products are not READY_FOR_REVIEW',
        ids: notReady.map(d => d.id),
      })
    }

    // Check no BLOCKER issues for any of these drafts
    const blockerIssues = await db
      .select({ productDraftId: validationIssues.productDraftId })
      .from(validationIssues)
      .where(and(
        inArray(validationIssues.productDraftId, draftIds),
        eq(validationIssues.severity, 'BLOCKER'),
        eq(validationIssues.resolved, false),
      ))

    if (blockerIssues.length > 0) {
      return reply.code(422).send({
        error: 'Some products have unresolved BLOCKER issues',
        ids: [...new Set(blockerIssues.map(i => i.productDraftId))],
      })
    }

    const now = new Date()
    await db.update(productDrafts)
      .set({ status: 'APPROVED', approvedAt: now, approvedBy: userId, updatedAt: sql`now()` })
      .where(inArray(productDrafts.id, draftIds))

    await db.insert(reviewDecisions).values(
      draftIds.map(id => ({ productDraftId: id, userId, action: 'BULK_APPROVE' })),
    )

    return reply.send({ ok: true, approved: draftIds.length })
  })
}

export default fp(productsPlugin)
