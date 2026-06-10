'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { api } from '../../lib/api'
import { Nav } from '../../components/nav'

interface Org { id: string; name: string; slug: string }

export default function OrgsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) api.get('/organizations').then(d => setOrgs(d.organizations ?? [])).catch(() => {})
  }, [user])

  if (loading || !user) return null

  return (
    <>
      <Nav />
      <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 20 }}>Organizace</h2>
        {orgs.length === 0
          ? <p style={{ color: 'var(--text-2)' }}>Nemáte žádné organizace.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orgs.map(org => (
                <a
                  key={org.id}
                  href={`/orgs/${org.id}`}
                  style={{
                    display: 'block',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '14px 18px',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{org.slug}</div>
                </a>
              ))}
            </div>
          )
        }
      </div>
    </>
  )
}
