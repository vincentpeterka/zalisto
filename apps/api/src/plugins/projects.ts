import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { db, projects, organizationMembers } from '@zalisto/database'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { logAudit } from '../lib/audit.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  targetLanguage: z.string().default('cs'),
  targetCurrency: z.string().default('CZK'),
  vatRate: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  pricingConfig: z.record(z.unknown()).optional(),
  textStyleConfig: z.record(z.unknown()).optional(),
  imageConfig: z.record(z.unknown()).optional(),
  categoryConfidenceThreshold: z.string().regex(/^0\.\d{1,3}$/).optional(),
})

const updateProjectSchema = createProjectSchema.partial()
const auth = { preHandler: [requireAuth] }

async function assertOrgAccess(userId: string, orgId: string, roles?: string[]) {
  const [member] = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
  if (!member) return null
  if (roles && !roles.includes(member.role)) return null
  return member
}

const projectsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/organizations/:orgId/projects', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    if (!await assertOrgAccess(userId, orgId)) return reply.status(403).send({ error: 'Forbidden' })

    const rows = await db.select().from(projects).where(eq(projects.organizationId, orgId))
    return reply.send(rows)
  })

  fastify.post('/organizations/:orgId/projects', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    if (!await assertOrgAccess(userId, orgId, ['OWNER', 'ADMIN'])) return reply.status(403).send({ error: 'Forbidden' })

    const body = createProjectSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const [project] = await db.insert(projects).values({
      organizationId: orgId,
      name: body.data.name,
      targetLanguage: body.data.targetLanguage,
      targetCurrency: body.data.targetCurrency,
      vatRate: body.data.vatRate,
      pricingConfig: body.data.pricingConfig ?? {},
      textStyleConfig: body.data.textStyleConfig ?? {},
      imageConfig: body.data.imageConfig ?? {},
      categoryConfidenceThreshold: body.data.categoryConfidenceThreshold,
    }).returning()

    await logAudit({ organizationId: orgId, actorUserId: userId, eventType: 'project.created', entityType: 'project', entityId: project!.id, payload: { name: project!.name } })

    return reply.status(201).send(project)
  })

  fastify.get('/projects/:projectId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project) return reply.status(404).send({ error: 'Not found' })

    if (!await assertOrgAccess(userId, project.organizationId)) return reply.status(403).send({ error: 'Forbidden' })
    return reply.send(project)
  })

  fastify.patch('/projects/:projectId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    if (!await assertOrgAccess(userId, existing.organizationId, ['OWNER', 'ADMIN'])) return reply.status(403).send({ error: 'Forbidden' })

    const body = updateProjectSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { pricingConfig, textStyleConfig, imageConfig, ...rest } = body.data
    const [project] = await db.update(projects).set({
      ...rest,
      ...(pricingConfig !== undefined ? { pricingConfig } : {}),
      ...(textStyleConfig !== undefined ? { textStyleConfig } : {}),
      ...(imageConfig !== undefined ? { imageConfig } : {}),
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId)).returning()

    await logAudit({ organizationId: existing.organizationId, actorUserId: userId, eventType: 'project.updated', entityType: 'project', entityId: projectId, payload: body.data as Record<string, unknown> })

    return reply.send(project)
  })

  fastify.delete('/projects/:projectId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { projectId } = request.params as { projectId: string }

    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    if (!await assertOrgAccess(userId, existing.organizationId, ['OWNER', 'ADMIN'])) return reply.status(403).send({ error: 'Forbidden' })

    await db.delete(projects).where(eq(projects.id, projectId))
    await logAudit({ organizationId: existing.organizationId, actorUserId: userId, eventType: 'project.deleted', entityType: 'project', entityId: projectId, payload: {} })

    return reply.status(204).send()
  })
}

export default fp(projectsPlugin)
