import { useState } from 'react'
import api from '../services/api'

export default function Insights() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ insights: string; summary: { total_income: string; total_expense: string; balance: string } } | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/insights')
      setResult(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao gerar insights')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Insights com IA</h2>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Análise inteligente dos seus gastos usando Claude AI</p>

      <button onClick={handleGenerate} disabled={loading} style={{
        padding: '12px 28px', borderRadius: 8, border: 'none',
        background: loading ? '#4f46e5aa' : '#6366f1',
        color: '#fff', fontSize: 15, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 24,
      }}>
        {loading ? '🤔 Analisando seus dados...' : '✨ Gerar análise com IA'}
      </button>

      {error && (
        <div style={{ background: '#2a1a1a', border: '1px solid #ef4444', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          {error.includes('ANTHROPIC_API_KEY') && (
            <p style={{ color: '#888', margin: '8px 0 0', fontSize: 13 }}>
              Adicione sua chave no arquivo <code style={{ color: '#6366f1' }}>apps/api/.env</code>: ANTHROPIC_API_KEY=sua_chave
            </p>
          )}
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Receitas', value: result.summary.total_income, color: '#10b981' },
              { label: 'Despesas', value: result.summary.total_expense, color: '#ef4444' },
              { label: 'Saldo', value: result.summary.balance, color: '#6366f1' },
            ].map(item => (
              <div key={item.label} style={{ background: '#1a1a2e', borderRadius: 10, padding: '14px 20px', border: '1px solid #2a2a3e', flex: 1, minWidth: 140 }}>
                <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>{item.label}</p>
                <p style={{ color: item.color, fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {Number(item.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            ))}
          </div>

          <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 28, border: '1px solid #2a2a3e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <h3 style={{ margin: 0, fontSize: 15, color: '#6366f1' }}>Análise do Claude AI</h3>
            </div>
            <p style={{ color: '#ccc', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>
              {result.insights}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
