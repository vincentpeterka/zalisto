import { type FastifyInstance } from 'fastify'
import { createApp } from '../app.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = await createApp({ logger: false })
  await app.ready()
  return app
}

let counter = 0

export function uniqueEmail(): string {
  return `test-${Date.now()}-${++counter}@zalisto-test.invalid`
}

export interface TestSession {
  cookie: string
  userId: string
}

export async function registerAndLogin(app: FastifyInstance, email = uniqueEmail()): Promise<TestSession> {
  const reg = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'Test1234!', displayName: 'Test User' },
  })
  const userId = JSON.parse(reg.body).id as string

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'Test1234!' },
  })
  const cookie = login.headers['set-cookie'] as string

  return { cookie, userId }
}

export async function createOrg(app: FastifyInstance, cookie: string, name = 'Test Org'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/organizations',
    headers: { cookie },
    payload: { name },
  })
  return JSON.parse(res.body).id as string
}

export async function createProject(app: FastifyInstance, cookie: string, orgId: string, name = 'Test Project'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/organizations/${orgId}/projects`,
    headers: { cookie },
    payload: { name },
  })
  return JSON.parse(res.body).id as string
}
