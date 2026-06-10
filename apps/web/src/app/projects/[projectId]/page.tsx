'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'
import { api } from '../../../lib/api'
import { Nav } from '../../../components/nav'
import { StatusBadge } from '../../../components/status-badge'
import type { ProductSummary } from '../../../lib/types'

const STATUS_FILTERS = [
  { value: '', label: 'Vše' },
  { value: 'READY_FOR_REVIEW', label: 'Připraveny' },
  { value: 'NEEDS_REVIEW', label: 'Ke kontrole' },
  { value: 'BLOCKED', label: 'Blokovány' },
  { value: 'APPROVED', label: 'Schváleny' },
]

export default function ProjectPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { projectId } = useParams() as { projectId: string }
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [projectName, setProjectName] = useState<string>('')
  const [orgId, setOrgId] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const loadProducts = useCallback(() => {
    const qs = statusFilter ? `?status=${statusFilter}` : ''
    api.get(`/projects/${projectId}/products${qs}`)
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [projectId, statusFilter])

  useEffect(() => {
    if (user && projectId) {
      api.get(`/projects/${projectId}`)
        .then(d => {
          setProjectName(d.project?.name ?? '')
          setOrgId(d.project?.organizationId ?? '')
        })
        .catch(() => {})
      loadProducts()
    }
  }, [user, projectId, loadProducts])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const readyIds = products
      .filter(p => p.status === 'READY_FOR_REVIEW')
      .map(p => p.id)
    setSelectedIds(new Set(readyIds))
  }

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      await api.post(`/projects/${projectId}/products/bulk-approve`, { draftIds: [...selectedIds] })
      setSelectedIds(new Set())
      loadProducts()
    } catch (err: unknown) {
      alert((err as Error).message)
    } finally {
      setBulkLoading(false)
    }
  }

  if (loading || !user) return null

  const readyCount = products.filter(p => p.status === 'READY_FOR_REVIEW').length
  const reviewCount = products.filter(p => p.status === 'NEEDS_REVIEW').length
  const blockedCount = products.filter(p => p.status === 'BLOCKED').length

  return (
    <>
      <Nav orgId={orgId} projectId={projectId} projectName={projectName} />
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Připraveno', value: readyCount, color: 'var(--green)' },
            { label: 'Ke kontrole', value: reviewCount, color: 'var(--yellow)' },
            { label: 'Blokováno', value: blockedCount, color: 'var(--red)' },
            { label: 'Celkem', value: products.length, color: 'var(--text-2)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 20px',
              minWidth: 100,
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: statusFilter === f.value ? 'var(--accent)' : 'var(--bg-2)',
                  color: statusFilter === f.value ? '#fff' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {selectedIds.size > 0 && (
            <button className="btn-success" onClick={bulkApprove} disabled={bulkLoading}>
              {bulkLoading ? 'Schvaluji…' : `Schválit vybrané (${selectedIds.size})`}
            </button>
          )}
          <button className="btn-ghost" onClick={selectAll} style={{ fontSize: 12 }}>
            Vybrat připravené ({readyCount})
          </button>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === readyCount && readyCount > 0}
                    onChange={e => e.target.checked ? selectAll() : setSelectedIds(new Set())}
                    style={{ width: 14, height: 14 }}
                  />
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>STAV</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>NÁZEV</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>ZNAČKA / MODEL</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>EAN/GTIN</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>CENA</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>ZDROJ</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-2)' }}>
                    Žádné produkty
                  </td>
                </tr>
              )}
              {products.map(p => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: selectedIds.has(p.id) ? 'var(--bg-3)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    {p.status === 'READY_FOR_REVIEW' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        style={{ width: 14, height: 14 }}
                      />
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 280 }}>
                    <Link href={`/products/${p.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                      {p.titleCs ?? <span style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>bez názvu</span>}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                    {[p.brand, p.modelName].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)', fontFamily: 'monospace', fontSize: 12 }}>
                    {p.gtin ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                    {p.targetPrice ? `${Number(p.targetPrice).toLocaleString('cs-CZ')} Kč` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden' }}>
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener"
                      style={{ color: 'var(--text-2)', fontSize: 11 }}
                      title={p.sourceUrl}
                    >
                      {new URL(p.sourceUrl).hostname}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
