import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTransactions, useCreateTransaction, useDeleteTransaction } from '../hooks/useTransactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Transactions() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', amount: '', type: 'expense', date: '' })

  const { data, isLoading, isError, error } = useTransactions({ page, type: type || undefined })
  const createMutation = useCreateTransaction()
  const deleteMutation = useDeleteTransaction()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createMutation.mutateAsync({ ...form, amount: Number(form.amount) })
    setForm({ title: '', amount: '', type: 'expense', date: '' })
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-2xl font-semibold tracking-tight text-text">Transações</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {showForm ? 'Cancelar' : 'Nova transação'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-col gap-1.5">
                <Label htmlFor="t-title">Título</Label>
                <Input
                  id="t-title"
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="t-amount">Valor (R$)</Label>
                <Input
                  id="t-amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="t-date">Data</Label>
                <Input
                  id="t-date"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <Label htmlFor="t-type">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger id="t-type">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="bg-success text-primary-fg hover:opacity-90">
                Salvar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {[
          { value: '', label: 'Todos' },
          { value: 'income', label: 'Receitas' },
          { value: 'expense', label: 'Despesas' },
        ].map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setType(f.value); setPage(1) }}
            className={
              type === f.value
                ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                : 'rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {isError ? (
          <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
            {(error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao carregar transações'}
          </div>
        ) : isLoading ? (
          <p className="p-6 text-muted">Carregando...</p>
        ) : data?.data?.length === 0 ? (
          <p className="p-6 text-muted">Nenhuma transação encontrada</p>
        ) : (
          <Table>
            <TableBody>
              {data?.data?.map((t: { id: string; title: string; amount: string; type: string; date: string; category_name: string }) => (
                <TableRow key={t.id}>
                  <TableCell className="w-10">
                    <span className={t.type === 'income' ? 'text-income' : 'text-expense'} aria-hidden="true">
                      {t.type === 'income' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="m-0 text-sm font-medium text-text">{t.title}</p>
                    <p className="m-0 text-xs text-muted">
                      {new Date(t.date).toLocaleDateString('pt-BR')}{t.category_name ? ` · ${t.category_name}` : ''}
                    </p>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                  </TableCell>
                  <TableCell className="w-10 text-right">
                    <button
                      type="button"
                      aria-label={`Excluir ${t.title}`}
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data?.pagination?.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>
          <span className="px-4 text-sm text-muted">{page} / {data.pagination.totalPages}</span>
          <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page === data.pagination.totalPages}>
            Próxima
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
