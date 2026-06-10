'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

export function Nav({ orgId, projectId, projectName }: {
  orgId?: string
  projectId?: string
  projectName?: string
}) {
  const { user, logout } = useAuth()

  return (
    <nav style={{
      background: 'var(--bg-2)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/orgs" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
        Zalisto
      </Link>

      {orgId && (
        <>
          <span style={{ color: 'var(--border)' }}>/</span>
          <Link href={`/orgs/${orgId}`} style={{ color: 'var(--text-2)', fontSize: 13 }}>
            Projekty
          </Link>
        </>
      )}

      {projectId && projectName && (
        <>
          <span style={{ color: 'var(--border)' }}>/</span>
          <Link href={`/projects/${projectId}`} style={{ color: 'var(--text)' , fontSize: 13 }}>
            {projectName}
          </Link>
        </>
      )}

      <div style={{ flex: 1 }} />

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{user.email}</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={logout}>
            Odhlásit
          </button>
        </div>
      )}
    </nav>
  )
}
