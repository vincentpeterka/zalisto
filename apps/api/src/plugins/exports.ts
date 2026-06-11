import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db, importBatches, projects, organizationMembers,
  insertExportRecord, findExportById, findExportsByBatchId,
} from '@zalisto/database'
import { eq, and } from 'drizzle-orm'
import { createStorageClient } from '@zalisto/storage'
import { requireAuth } from './auth.js'
import { env } from '../lib/env.js'

const auth = { preHandler: [requireAuth] }

async function assertBatchAccess(userId: string, batchId: string) {
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId))
  if (!batch) return null

  const [project] = await db.select().from(projects).where(eq(projects.id, batch.projectId))
  if (!project) return null

  const [member] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId),
    ))
  if (!member) return null

  return { batch, project, member }
}

const exportsPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  const exportQueue = new Queue('generate-export', { connection: redis })

  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  })

  fastify.addHook('onClose', async () => {
    await exportQueue.close()
    await redis.quit()
  })

  // Trigger export generation for a batch
  fastify.post('/batches/:batchId/exports', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { batchId } = request.params as { batchId: string }

    const access = await assertBatchAccess(userId, batchId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    const exportRecord = await insertExportRecord({
      batchId,
      format: 'ZIP',
      createdBy: userId,
    })

    await exportQueue.add('generate-export', {
      batchId,
      exportId: exportRecord.id,
      requestedBy: userId,
    })

    return reply.status(202).send({
      exportId: exportRecord.id,
      status: exportRecord.status,
      message: 'Export queued',
    })
  })

  // List exports for a batch
  fastify.get('/batches/:batchId/exports', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { batchId } = request.params as { batchId: string }

    const access = await assertBatchAccess(userId, batchId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    const rows = await findExportsByBatchId(batchId)
    return reply.send(rows)
  })

  // Get signed download URL for a completed export
  fastify.get('/exports/:exportId/download', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { exportId } = request.params as { exportId: string }

    const exportRecord = await findExportById(exportId)
    if (!exportRecord) return reply.status(404).send({ error: 'Not found' })

    const access = await assertBatchAccess(userId, exportRecord.batchId)
    if (!access) return reply.status(403).send({ error: 'Forbidden' })

    if (exportRecord.status === 'PENDING' || exportRecord.status === 'PROCESSING') {
      return reply.status(202).send({ status: exportRecord.status, message: 'Export still in progress' })
    }

    if (exportRecord.status === 'FAILED') {
      return reply.status(500).send({ error: 'Export failed' })
    }

    if (!exportRecord.storageKey) {
      return reply.status(500).send({ error: 'Export has no storage key' })
    }

    const url = await storage.getSignedDownloadUrl(exportRecord.storageKey, 3600)
    return reply.send({
      exportId: exportRecord.id,
      downloadUrl: url,
      expiresIn: 3600,
      productCount: exportRecord.productCount,
      createdAt: exportRecord.createdAt,
    })
  })
}

export default fp(exportsPlugin)
