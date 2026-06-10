import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { db, users } from '@zalisto/database'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

declare module 'fastify' {
  interface Session {
    userId?: string
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.userId) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { email, password, displayName } = body.data
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) return reply.status(409).send({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, 12)
    const [user] = await db.insert(users).values({ email, passwordHash, displayName }).returning()

    request.session.userId = user!.id
    return reply.status(201).send({ id: user!.id, email: user!.email, displayName: user!.displayName })
  })

  fastify.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { email, password } = body.data
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user || !user.passwordHash) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    request.session.userId = user.id
    return reply.send({ id: user.id, email: user.email, displayName: user.displayName })
  })

  fastify.post('/auth/logout', async (request, reply) => {
    await request.session.destroy()
    return reply.send({ ok: true })
  })

  fastify.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, request.session.userId!)).limit(1)

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  })
}

export default fp(authPlugin)
