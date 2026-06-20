import { useState } from 'react'
import { useTransactions, useCreateTransaction, useDeleteTransaction } from '../hooks/useTransactions'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Transactions() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', amount: '', type: 'expense', date: '' })

  const { data, isLoading } = useTransactions({ page, type: type || undefined })
  const createMutation = useCreateTransaction()
  const deleteMutation = useDeleteTransaction()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createMutation.mutateAsync({ ...form, amount: Number(form.amount) })
    setForm({ title: '', amount: '', type: 'expense', date: '' })
    setShowForm(false)
  }

  const inp = { padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: 13 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Transações</h2>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600,
        }}>
          {showForm ? 'Cancelar' : '+ Nova transação'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a3e',
          marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          {[
            { label: 'Título', field: 'title', type: 'text' },
            { label: 'Valor (R$)', field: 'amount', type: 'number' },
            { label: 'Data', field: 'date', type: 'date' },
          ].map(({ label, field, type }) => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#aaa', fontSize: 12 }}>{label}</label>
              <input style={inp} type={type} step={field === 'amount' ? '0.01' : undefined}
                value={form[field as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} required />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#aaa', fontSize: 12 }}>Tipo</label>
            <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Salvar
          </button>
        </form>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {['', 'income', 'expense'].map(t => (
          <button key={t} onClick={() => { setType(t); setPage(1) }} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: type === t ? '#6366f1' : '#1a1a2e',
            color: type === t ? '#fff' : '#888', fontSize: 13,
          }}>
            {t === '' ? 'Todos' : t === 'income' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
      </div>

      <div style={{ background: '#1a1a2e', borderRadius: 12, border: '1px solid #2a2a3e', overflow: 'hidden' }}>
        {isLoading
          ? <p style={{ padding: 24, color: '#888' }}>Carregando...</p>
          : data?.data?.length === 0
          ? <p style={{ padding: 24, color: '#555' }}>Nenhuma transação encontrada</p>
          : data?.data?.map((t: { id: string; title: string; amount: string; type: string; date: string; category_name: string }) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #2a2a3e', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{t.type === 'income' ? '📈' : '📉'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                  {new Date(t.date).toLocaleDateString('pt-BR')}{t.category_name ? ` · ${t.category_name}` : ''}
                </p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
              </span>
              <button onClick={() => deleteMutation.mutate(t.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑️</button>
            </div>
          ))
        }
      </div>

      {data?.pagination?.totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a1a2e', color: '#fff', cursor: 'pointer' }}>
            ← Anterior
          </button>
          <span style={{ color: '#888', padding: '8px 16px', fontSize: 13 }}>{page} / {data.pagination.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === data.pagination.totalPages}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a1a2e', color: '#fff', cursor: 'pointer' }}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
