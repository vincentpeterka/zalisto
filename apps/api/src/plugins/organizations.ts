import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { db, organizations, organizationMembers, users } from '@zalisto/database'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { logAudit } from '../lib/audit.js'

const createOrgSchema = z.object({ name: z.string().min(1).max(200) })
const updateOrgSchema = z.object({ name: z.string().min(1).max(200) })
const auth = { preHandler: [requireAuth] }

const orgsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/organizations', auth, async (request, reply) => {
    const userId = request.session.userId!
    const rows = await db
      .select({ org: organizations, role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId))
    return reply.send(rows.map((r) => ({ ...r.org, role: r.role })))
  })

  fastify.post('/organizations', auth, async (request, reply) => {
    const userId = request.session.userId!
    const body = createOrgSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const [org] = await db.insert(organizations).values({ name: body.data.name }).returning()
    await db.insert(organizationMembers).values({ organizationId: org!.id, userId, role: 'OWNER' })
    await logAudit({ organizationId: org!.id, actorUserId: userId, eventType: 'org.created', entityType: 'organization', entityId: org!.id, payload: { name: org!.name } })

    return reply.status(201).send(org)
  })

  fastify.get('/organizations/:orgId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    const [member] = await db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    if (!member) return reply.status(403).send({ error: 'Forbidden' })

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
    if (!org) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ...org, role: member.role })
  })

  fastify.patch('/organizations/:orgId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    const [member] = await db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) return reply.status(403).send({ error: 'Forbidden' })

    const body = updateOrgSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const [org] = await db.update(organizations).set({ name: body.data.name }).where(eq(organizations.id, orgId)).returning()
    await logAudit({ organizationId: orgId, actorUserId: userId, eventType: 'org.updated', entityType: 'organization', entityId: orgId, payload: body.data })

    return reply.send(org)
  })

  fastify.delete('/organizations/:orgId', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    const [member] = await db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    if (!member || member.role !== 'OWNER') return reply.status(403).send({ error: 'Only OWNER can delete organization' })

    await db.delete(organizations).where(eq(organizations.id, orgId))
    return reply.status(204).send()
  })

  fastify.get('/organizations/:orgId/members', auth, async (request, reply) => {
    const userId = request.session.userId!
    const { orgId } = request.params as { orgId: string }

    const [member] = await db.select().from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    if (!member) return reply.status(403).send({ error: 'Forbidden' })

    const members = await db
      .select({ userId: organizationMembers.userId, role: organizationMembers.role, email: users.email, displayName: users.displayName })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId))
    return reply.send(members)
  })
}

export default fp(orgsPlugin)
