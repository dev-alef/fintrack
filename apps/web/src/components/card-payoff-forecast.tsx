import { useQuery } from '@tanstack/react-query'
import { CalendarCheck } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PayoffMonth { month: number; year: number; amount: string; invoice_count: number }
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const monthIndex = ({ year, month }: { year: number; month: number }) => year * 12 + month - 1
const fmt = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CardPayoffForecast({ userId }: { userId: string }) {
  const query = useQuery({ queryKey: ['cardPayoff', userId], enabled: !!userId, queryFn: () => api.get<PayoffMonth[]>('/finance/cards/payoff').then(response => response.data) })
  const entries = query.data ?? []
  const last = entries[entries.length - 1]
  const now = new Date()
  const currentMonth = monthIndex({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const olderInvoices = entries.filter(entry => monthIndex(entry) < currentMonth).reduce((sum, entry) => sum + entry.invoice_count, 0)
  const totalInvoices = entries.reduce((sum, entry) => sum + entry.invoice_count, 0)
  const total = entries.reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0)
  const onlyOlder = last && monthIndex(last) < currentMonth

  return (
    <Card>
      <CardContent className="space-y-3 p-5" aria-labelledby="card-payoff-title">
        <h2 id="card-payoff-title" className="flex items-center gap-2 text-sm font-semibold text-text"><CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Previsão de quitação dos cartões</h2>
        {query.isPending ? <p role="status" className="text-sm text-muted">Calculando previsão…</p> : query.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
            Não foi possível carregar a previsão.
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button>
          </div>
        ) : !last ? (
          <p className="text-sm text-muted">Nenhuma fatura em aberto cadastrada.</p>
        ) : (
          <>
            <p className="text-xl font-bold text-primary">{onlyOlder ? 'Regularize as faturas pendentes' : `${months[last.month - 1]} de ${last.year}`}</p>
            <p className="text-sm text-muted">{fmt(total)} em {totalInvoices} {totalInvoices === 1 ? 'fatura em aberto' : 'faturas em aberto'}.</p>
            <p className="text-xs text-muted">{onlyOlder ? 'Só há faturas de meses anteriores em aberto. Marque os pagamentos já feitos e planeje as faturas futuras para atualizar a previsão.' : 'Pelas faturas cadastradas, esse é o último mês com valor a quitar, se você pagar todas elas.'}</p>
            {!onlyOlder && olderInvoices > 0 && <p className="text-xs text-warning">Também há {olderInvoices} {olderInvoices === 1 ? 'fatura de mês anterior em aberto' : 'faturas de meses anteriores em aberto'} para regularizar.</p>}
          </>
        )}
        <p className="text-xs text-muted">Inclua todas as parcelas futuras no Planejamento do ano. Novas compras alteram esta previsão; contas fixas ficam fora dela.</p>
        <a href="#annual-planning" className="inline-block text-xs text-primary underline underline-offset-2">Ir para o planejamento</a>
      </CardContent>
    </Card>
  )
}
