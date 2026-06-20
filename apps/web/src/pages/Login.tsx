import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/auth.store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      login(data.user, data.accessToken, data.refreshToken)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao fazer login')
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
        <p style={{ color: '#888', textAlign: 'center', marginBottom: 32 }}>Faça login na sua conta</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Senha</label>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            padding: 13, borderRadius: 8, border: 'none',
            background: loading ? '#4f46e5aa' : '#6366f1',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8,
          }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p style={{ color: '#888', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          Não tem conta? <Link to="/register" style={{ color: '#6366f1' }}>Cadastre-se</Link>
        </p>
      </div>
    </div>
  )
}
