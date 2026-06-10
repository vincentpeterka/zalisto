import { db, auditEvents } from '@zalisto/database'

export async function logAudit(opts: {
  organizationId: string
  actorUserId?: string
  eventType: string
  entityType: string
  entityId?: string
  payload?: Record<string, unknown>
}) {
  await db.insert(auditEvents).values({
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId ?? null,
    eventType: opts.eventType,
    entityType: opts.entityType,
    entityId: opts.entityId ?? null,
    payload: opts.payload ?? {},
  })
}
