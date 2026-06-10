'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../../lib/auth-context'
import { api } from '../../../lib/api'
import { Nav } from '../../../components/nav'
import { StatusBadge, SeverityBadge } from '../../../components/status-badge'
import type { ProductDetail, ProductFact } from '../../../lib/types'

type EditableField = 'titleCs' | 'shortDescriptionCs' | 'longDescriptionCs' | 'brand' | 'modelName' | 'targetPrice' | 'categoryId'

export default function ProductDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { draftId } = useParams() as { draftId: string }
  const [data, setData] = useState<ProductDetail | null>(null)
  const [editField, setEditField] = useState<EditableField | null>(null)
  const [editValue, setEditValue] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const load = useCallback(() => {
    api.get(`/products/${draftId}`).then(setData).catch(() => {})
  }, [draftId])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const startEdit = (field: EditableField) => {
    if (!data) return
    const d = data.draft
    const value = d[field as keyof typeof d] ?? ''
    setEditValue(String(value))
    setEditField(field)
  }

  const saveEdit = async () => {
    if (!editField) return
    setActionLoading(true)
    try {
      await api.patch(`/products/${draftId}/fields`, { field: editField, value: editValue })
      setEditField(null)
      load()
      flash('ok', 'Pole uloženo')
    } catch (err: unknown) {
      flash('err', (err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const approve = async () => {
    setActionLoading(true)
    try {
      await api.post(`/products/${draftId}/approve`)
      load()
      flash('ok', 'Produkt schválen')
    } catch (err: unknown) {
      flash('err', (err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const reject = async () => {
    const note = prompt('Důvod zamítnutí (volitelné):')
    if (note === null) return
    setActionLoading(true)
    try {
      await api.post(`/products/${draftId}/reject`, { note })
      load()
      flash('ok', 'Produkt zamítnut')
    } catch (err: unknown) {
      flash('err', (err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const reprocess = async () => {
    if (!confirm('Znovu zpracovat produkt od začátku?')) return
    setActionLoading(true)
    try {
      await api.post(`/products/${draftId}/reprocess`)
      load()
      flash('ok', 'Produkt zařazen do fronty')
    } catch (err: unknown) {
      flash('err', (err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !user || !data) return (
    <>
      <Nav />
      <div style={{ padding: 32, color: 'var(--text-2)' }}>Načítám…</div>
    </>
  )

  const { draft, facts, images, issues, decisions } = data
  const blockers = issues.filter(i => i.severity === 'BLOCKER' && !i.resolved)
  const canApprove = draft.status !== 'BLOCKED' && ['READY_FOR_REVIEW', 'NEEDS_REVIEW'].includes(draft.status)

  const factsByField = facts.reduce<Record<string, ProductFact[]>>((acc, f) => {
    ;(acc[f.fieldName] ??= []).push(f)
    return acc
  }, {})

  const EDITABLE_FIELDS: { key: EditableField; label: string }[] = [
    { key: 'titleCs', label: 'Název (CS)' },
    { key: 'shortDescriptionCs', label: 'Krátký popis' },
    { key: 'longDescriptionCs', label: 'Dlouhý popis' },
    { key: 'brand', label: 'Značka' },
    { key: 'modelName', label: 'Model' },
    { key: 'targetPrice', label: 'Cílová cena (Kč)' },
    { key: 'categoryId', label: 'Kategorie ID' },
  ]

  return (
    <>
      <Nav />
      <div style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <StatusBadge status={draft.status} />
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>
            {draft.titleCs ?? <span style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>bez názvu</span>}
          </h1>
          <div style={{ flex: 1 }} />
          {msg && (
            <span style={{
              fontSize: 13,
              color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
              padding: '4px 10px',
              background: msg.type === 'ok' ? '#1a3a2a' : '#3a1010',
              borderRadius: 6,
            }}>
              {msg.text}
            </span>
          )}
          <button className="btn-ghost" onClick={reprocess} disabled={actionLoading} style={{ fontSize: 12 }}>
            Znovu zpracovat
          </button>
          <button className="btn-danger" onClick={reject} disabled={actionLoading}>Zamítnout</button>
          <button className="btn-success" onClick={approve} disabled={actionLoading || !canApprove}>
            Schválit
          </button>
        </div>

        {blockers.length > 0 && (
          <div style={{
            background: '#3a1010',
            border: '1px solid #5a2020',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            flexDirection: 'column',
          }}>
            <strong style={{ color: 'var(--red)', fontSize: 13 }}>⚠ BLOCKER — nelze schválit</strong>
            {blockers.map(b => (
              <div key={b.id} style={{ fontSize: 13, color: 'var(--text-2)' }}>
                [{b.code}] {b.message}
              </div>
            ))}
          </div>
        )}

        {/* 3-panel layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Panel 1: Zdroj (fakta) */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Zdroj dat
            </div>
            <div style={{ padding: 14, maxHeight: 600, overflowY: 'auto' }}>
              {Object.entries(factsByField).map(([field, fieldFacts]) => (
                <div key={field} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, textTransform: 'uppercase' }}>{field}</div>
                  {fieldFacts.map(f => (
                    <div key={f.id} style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: f.isSelected ? 'var(--bg-3)' : 'transparent',
                      border: f.isSelected ? '1px solid var(--border)' : '1px solid transparent',
                      marginBottom: 2,
                    }}>
                      <div style={{ color: 'var(--text)' }}>
                        {typeof f.valueJson === 'object'
                          ? JSON.stringify(f.valueJson)
                          : String(f.valueJson)}
                        {f.isSelected && <span style={{ marginLeft: 6, color: 'var(--green)', fontSize: 10 }}>●</span>}
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: 10 }}>
                        {f.sourceType}
                        {f.confidence ? ` · ${(Number(f.confidence) * 100).toFixed(0)}%` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {facts.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Žádná fakta</p>}
            </div>
          </div>

          {/* Panel 2: Návrh (editovatelná pole) */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Produkt
            </div>
            <div style={{ padding: 14 }}>
              {EDITABLE_FIELDS.map(({ key, label }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{label}</span>
                    <button
                      onClick={() => startEdit(key)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, padding: 0, cursor: 'pointer' }}
                    >
                      upravit
                    </button>
                  </div>
                  {editField === key ? (
                    <div>
                      {key === 'longDescriptionCs' ? (
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          rows={4}
                          style={{ marginBottom: 6, resize: 'vertical' }}
                        />
                      ) : (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          style={{ marginBottom: 6 }}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" onClick={saveEdit} disabled={actionLoading} style={{ fontSize: 12, padding: '4px 10px' }}>
                          Uložit
                        </button>
                        <button className="btn-ghost" onClick={() => setEditField(null)} style={{ fontSize: 12, padding: '4px 10px' }}>
                          Zrušit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 13,
                      color: draft[key as keyof typeof draft] ? 'var(--text)' : 'var(--text-2)',
                      fontStyle: draft[key as keyof typeof draft] ? 'normal' : 'italic',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '6px 8px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {String(draft[key as keyof typeof draft] ?? '—')}
                    </div>
                  )}
                </div>
              ))}

              {/* Images */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase' }}>Obrázky</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {images.map(img => (
                    <div key={img.id} style={{
                      width: 64,
                      height: 64,
                      borderRadius: 4,
                      border: `1px solid ${img.status === 'PROCESSED' ? 'var(--green)' : 'var(--red)'}`,
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'var(--bg-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: 'var(--text-2)',
                    }}>
                      {img.status === 'PROCESSED'
                        ? `${img.width}×${img.height}`
                        : img.status
                      }
                    </div>
                  ))}
                  {images.length === 0 && <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Žádné</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Issues + Decisions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Validation issues */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                Validační problémy
              </div>
              <div style={{ padding: 14, maxHeight: 280, overflowY: 'auto' }}>
                {issues.length === 0
                  ? <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Žádné problémy</p>
                  : issues.map(issue => (
                    <div key={issue.id} style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-3)',
                      marginBottom: 6,
                      opacity: issue.resolved ? 0.5 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <SeverityBadge severity={issue.severity} />
                        <code style={{ fontSize: 11, color: 'var(--text-2)' }}>{issue.code}</code>
                        {issue.resolved && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ vyřešeno</span>}
                      </div>
                      <div style={{ fontSize: 12 }}>{issue.message}</div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Review decisions */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                Historie rozhodnutí
              </div>
              <div style={{ padding: 14, maxHeight: 220, overflowY: 'auto' }}>
                {decisions.length === 0
                  ? <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Žádná rozhodnutí</p>
                  : decisions.slice().reverse().map(d => (
                    <div key={d.id} style={{
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{d.action}</strong>
                        <span style={{ color: 'var(--text-2)', fontSize: 11 }}>
                          {new Date(d.createdAt).toLocaleString('cs-CZ')}
                        </span>
                      </div>
                      {d.fieldName && (
                        <div style={{ color: 'var(--text-2)' }}>
                          {d.fieldName}: {String(d.oldValue ?? '—')} → {String(d.newValue ?? '—')}
                        </div>
                      )}
                      {d.note && <div style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>{d.note}</div>}
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Metadata */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 12 }}>
              <div style={{ color: 'var(--text-2)', marginBottom: 6, fontWeight: 600, fontSize: 11 }}>METADATA</div>
              {[
                { label: 'EAN/GTIN', value: draft.gtin },
                { label: 'MPN', value: draft.manufacturerPartNumber },
                { label: 'Kategorie ID', value: draft.categoryId },
                { label: 'Konf. kategorize', value: draft.categoryConfidence ? `${(Number(draft.categoryConfidence) * 100).toFixed(0)}%` : null },
                { label: 'Vytvořen', value: new Date(draft.createdAt).toLocaleString('cs-CZ') },
                { label: 'Aktualizován', value: new Date(draft.updatedAt).toLocaleString('cs-CZ') },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
                  <span style={{ color: r.value ? 'var(--text)' : 'var(--text-2)', fontStyle: r.value ? 'normal' : 'italic' }}>
                    {r.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
