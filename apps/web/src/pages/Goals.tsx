import { useState } from 'react'
import { Target, CheckCircle2, Trash2, Calendar, PiggyBank, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Goal {
  id: string; title: string; target_amount: string
  current_amount: string; progress_pct: string; deadline?: string
}

export default function Goals() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', target_amount: '', current_amount: '0', deadline: '' })
  // Estado controlado para o input "Guardar" de cada meta (evita getElementById).
  const [addValues, setAddValues] = useState<Record<string, string>>({})

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

  function handleAdd(goal: Goal) {
    const val = Number(addValues[goal.id])
    if (val > 0) {
      updateMutation.mutate({ id: goal.id, current_amount: Number(goal.current_amount) + val })
      setAddValues(v => ({ ...v, [goal.id]: '' }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-2xl font-semibold tracking-tight text-text">Metas financeiras</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {showForm ? 'Cancelar' : 'Nova meta'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-col gap-1.5">
                <Label htmlFor="g-title">Título da meta</Label>
                <Input
                  id="g-title"
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="g-target">Valor alvo (R$)</Label>
                <Input
                  id="g-target"
                  type="number"
                  step="0.01"
                  value={form.target_amount}
                  onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                  required
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="g-current">Já guardado (R$)</Label>
                <Input
                  id="g-current"
                  type="number"
                  step="0.01"
                  value={form.current_amount}
                  onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="g-deadline">Prazo (opcional)</Label>
                <Input
                  id="g-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                />
              </div>
              <Button type="submit" className="bg-success text-primary-fg hover:opacity-90">
                Criar meta
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted">Carregando...</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="mb-2 text-4xl" aria-hidden="true"><Target className="mx-auto h-10 w-10 text-muted" /></p>
            <p className="text-muted">Nenhuma meta criada ainda!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {goals.map((goal: Goal) => {
            const pct = Math.min(100, Number(goal.progress_pct) || 0)
            const done = pct >= 100
            return (
              <Card key={goal.id} className={done ? 'border-success' : ''}>
                <CardContent className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className={`m-0 text-base font-medium ${done ? 'text-success' : 'text-text'}`}>
                      {done ? <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden="true" /> : <Target className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                      {goal.title}
                    </h3>
                    <button
                      type="button"
                      aria-label={`Excluir ${goal.title}`}
                      onClick={() => deleteMutation.mutate(goal.id)}
                      className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-xs text-muted">{fmt(goal.current_amount || 0)} de {fmt(goal.target_amount || 0)}</span>
                      <span className={`text-xs font-semibold ${done ? 'text-success' : 'text-primary'}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${done ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {goal.deadline && (
                    <p className="mb-3 flex items-center gap-1 text-xs text-muted">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  {!done && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valor (R$)"
                        aria-label={`Valor a guardar em ${goal.title}`}
                        className="flex-1 text-xs"
                        value={addValues[goal.id] ?? ''}
                        onChange={e => setAddValues(v => ({ ...v, [goal.id]: e.target.value }))}
                      />
                      <Button size="sm" onClick={() => handleAdd(goal)}>
                        <PiggyBank className="h-4 w-4" aria-hidden="true" />
                        Guardar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
