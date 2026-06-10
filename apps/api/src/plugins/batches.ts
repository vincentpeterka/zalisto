import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { db, importBatches, sourceItems, projects, organizationMembers } from '@zalisto/database'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { logAudit } from '../lib/audit.js'
import { env } from '../lib/env.js'

const ALLOWED_SCHEMES = ['http:', 'https:']

function validateUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (!ALLOWED_SCHEMES.includes(u.protocol)) return null
    return u.toString()
  } catch {
    return null
  }
}

const createBatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
})

const addItemsSchema = z.object({
  urls: z.array(z.string()).min(1).max(500),
})

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

const batchesPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  const fetchQueue = new Queue('fetch-source', { connection: redis })

  fastify.addHook('onClose', async () => {
    await fetchQueue.close()
    await redis.quit()
  })

  // Create batch under a project
  fastify.post('/projects/:projectId/batches', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const access = await assertProjectAccess(userId, projectId, ['OWNER', 'ADMIN', 'MEMBER'])
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    const body = createBatchSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const [batch] = await db.insert(importBatches).values({
      projectId,
      createdBy: userId,
      name: body.data.name ?? null,
    }).returning()

    await logAudit({
      organizationId: access.project.organizationId,
      actorUserId: userId,
      eventType: 'batch.created',
      entityType: 'import_batch',
      entityId: batch!.id,
      payload: { projectId, name: body.data.name },
    })

    return reply.status(201).send(batch)
  })

  // Get batch detail + item counts
  fastify.get('/batches/:batchId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { batchId } = request.params as { batchId: string }

    const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId))
    if (!batch) return reply.status(404).send({ error: 'Not found' })

    const access = await assertProjectAccess(userId, batch.projectId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    return reply.send(batch)
  })

  // Add URL items to a batch and enqueue
  fastify.post('/batches/:batchId/items', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { batchId } = request.params as { batchId: string }

    const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId))
    if (!batch) return reply.status(404).send({ error: 'Not found' })

    const access = await assertProjectAccess(userId, batch.projectId, ['OWNER', 'ADMIN', 'MEMBER'])
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    if (batch.status !== 'PENDING') {
      return reply.status(409).send({ error: 'Batch already started' })
    }

    const body = addItemsSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const validUrls: string[] = []
    const invalidUrls: string[] = []

    for (const raw of body.data.urls) {
      const validated = validateUrl(raw)
      if (validated) validUrls.push(validated)
      else invalidUrls.push(raw)
    }

    if (validUrls.length === 0) {
      return reply.status(400).send({ error: 'No valid URLs provided', invalidUrls })
    }

    // Insert source_items
    const inserted = await db.insert(sourceItems).values(
      validUrls.map(url => ({ batchId, sourceUrl: url }))
    ).returning()

    // Update batch item count
    await db.update(importBatches)
      .set({ totalItems: sql`${importBatches.totalItems} + ${inserted.length}` })
      .where(eq(importBatches.id, batchId))

    // Enqueue fetch jobs
    await fetchQueue.addBulk(
      inserted.map(item => ({
        name: 'fetch-source',
        data: { sourceItemId: item.id, url: item.sourceUrl, batchId },
        opts: { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } },
      }))
    )

    return reply.status(201).send({
      enqueued: inserted.length,
      invalid: invalidUrls.length,
      invalidUrls: invalidUrls.length > 0 ? invalidUrls : undefined,
    })
  })

  // Polling status endpoint
  fastify.get('/batches/:batchId/status', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { batchId } = request.params as { batchId: string }

    const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId))
    if (!batch) return reply.status(404).send({ error: 'Not found' })

    const access = await assertProjectAccess(userId, batch.projectId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    // Item breakdown by fetchStatus
    const rows = await db
      .select({ fetchStatus: sourceItems.fetchStatus, count: sql<number>`count(*)::int` })
      .from(sourceItems)
      .where(eq(sourceItems.batchId, batchId))
      .groupBy(sourceItems.fetchStatus)

    const counts = Object.fromEntries(rows.map(r => [r.fetchStatus, r.count]))

    return reply.send({
      batchId,
      status: batch.status,
      totalItems: batch.totalItems,
      processedItems: batch.processedItems,
      failedItems: batch.failedItems,
      items: counts,
    })
  })

  // List batches for a project
  fastify.get('/projects/:projectId/batches', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const access = await assertProjectAccess(userId, projectId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    const rows = await db.select().from(importBatches)
      .where(eq(importBatches.projectId, projectId))
      .orderBy(importBatches.createdAt)

    return reply.send(rows)
  })
}

export default fp(batchesPlugin)
