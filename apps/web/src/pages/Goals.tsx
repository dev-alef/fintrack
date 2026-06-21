import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Goal {
  id: string; title: string; target_amount: string
  current_amount: string; progress_pct: string; deadline?: string
}

export default function Goals() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', target_amount: '', current_amount: '0', deadline: '' })

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.post('/goals', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setForm({ title: '', target_amount: '', current_amount: '0', deadline: '' })
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete('/goals/' + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, current_amount }: { id: string; current_amount: number }) =>
      api.put('/goals/' + id, { current_amount }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createMutation.mutateAsync({
      title: form.title,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount),
      deadline: form.deadline || undefined,
    })
  }

  const inp = { padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: 13 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Metas financeiras</h2>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600,
        }}>
          {showForm ? 'Cancelar' : '+ Nova meta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a3e',
          marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          {[
            { label: 'Título da meta', field: 'title', type: 'text' },
            { label: 'Valor alvo (R$)', field: 'target_amount', type: 'number' },
            { label: 'Já guardado (R$)', field: 'current_amount', type: 'number' },
            { label: 'Prazo (opcional)', field: 'deadline', type: 'date' },
          ].map(({ label, field, type }) => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#aaa', fontSize: 12 }}>{label}</label>
              <input style={inp} type={type} step="0.01"
                value={form[field as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required={field !== 'deadline'} />
            </div>
          ))}
          <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Criar meta
          </button>
        </form>
      )}

      {isLoading ? <p style={{ color: '#888' }}>Carregando...</p>
        : goals.length === 0 ? (
          <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 40, border: '1px solid #2a2a3e', textAlign: 'center' }}>
            <p style={{ fontSize: 40 }}>🎯</p>
            <p style={{ color: '#888' }}>Nenhuma meta criada ainda!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {goals.map((goal: Goal) => {
              const pct = Math.min(100, Number(goal.progress_pct) || 0)
              const done = pct >= 100
              return (
                <div key={goal.id} style={{ background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid ' + (done ? '#10b981' : '#2a2a3e') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: done ? '#10b981' : '#fff' }}>{done ? '✅ ' : '🎯 '}{goal.title}</h3>
                    <button onClick={() => deleteMutation.mutate(goal.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>🗑️</button>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#888', fontSize: 12 }}>{fmt(goal.current_amount)} de {fmt(goal.target_amount)}</span>
                      <span style={{ color: done ? '#10b981' : '#6366f1', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: '#2a2a3e', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: pct + '%', background: done ? '#10b981' : '#6366f1', borderRadius: 3 }} />
                    </div>
                  </div>
                  {goal.deadline && <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px' }}>📅 {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>}
                  {!done && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" step="0.01" placeholder="Valor (R$)" id={'add-' + goal.id}
                        style={{ ...inp, flex: 1, fontSize: 12 }} />
                      <button onClick={() => {
                        const el = document.getElementById('add-' + goal.id) as HTMLInputElement
                        const val = Number(el.value)
                        if (val > 0) { updateMutation.mutate({ id: goal.id, current_amount: Number(goal.current_amount) + val }); el.value = '' }
                      }} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                        + Guardar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
