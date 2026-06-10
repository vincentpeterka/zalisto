'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../../lib/auth-context'
import { api } from '../../../lib/api'
import { Nav } from '../../../components/nav'
import Link from 'next/link'

interface Project { id: string; name: string; slug: string }

export default function OrgPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { orgId } = useParams() as { orgId: string }
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && orgId) {
      api.get(`/organizations/${orgId}/projects`)
        .then(d => setProjects(d.projects ?? []))
        .catch(() => {})
    }
  }, [user, orgId])

  if (loading || !user) return null

  return (
    <>
      <Nav orgId={orgId} />
      <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 20 }}>Projekty</h2>
        {projects.length === 0
          ? <p style={{ color: 'var(--text-2)' }}>Žádné projekty v této organizaci.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map(p => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  style={{
                    display: 'block',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '14px 18px',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{p.slug}</div>
                </Link>
              ))}
            </div>
          )
        }
      </div>
    </>
  )
}
