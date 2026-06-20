import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: '1px solid #333', background: '#0f0f1a',
    color: '#fff', fontSize: 14, boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 40, background: '#1a1a2e', borderRadius: 16, border: '1px solid #2a2a3e' }}>
        <h1 style={{ color: '#6366f1', textAlign: 'center', marginBottom: 8 }}>💰 FinTrack</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: 32 }}>Crie sua conta gratuita</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['name', 'email', 'password'] as const).map(field => (
            <div key={field}>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {field === 'name' ? 'Nome' : field === 'email' ? 'Email' : 'Senha'}
              </label>
              <input style={inp}
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required />
            </div>
          ))}
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            padding: 13, borderRadius: 8, border: 'none',
            background: loading ? '#4f46e5aa' : '#6366f1',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8,
          }}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>
        <p style={{ color: '#888', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          Já tem conta? <Link to="/login" style={{ color: '#6366f1' }}>Entrar</Link>
        </p>
      </div>
    </div>
  )
}
