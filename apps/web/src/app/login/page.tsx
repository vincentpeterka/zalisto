'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/login', { email, password })
      router.push('/')
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Přihlášení selhalo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '40px 36px',
        width: 360,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Zalisto</h1>
        <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>AI Product Importer — přihlášení</p>

        {error && (
          <div style={{
            background: '#3a1010',
            color: 'var(--red)',
            border: '1px solid #5a2020',
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 16,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-2)', fontSize: 12 }}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ marginBottom: 16 }}
            placeholder="vas@email.cz"
          />

          <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-2)', fontSize: 12 }}>Heslo</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ marginBottom: 24 }}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '10px' }}
          >
            {loading ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  )
}
