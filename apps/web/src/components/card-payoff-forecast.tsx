import { useQuery } from '@tanstack/react-query'
import { CalendarCheck } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'

type Period = { month: number; year: number }
interface PayoffMonth extends Period { amount: string; invoice_count: number }
type Projection = { start: Period; end: Period | null } & (
  | { status: 'not_applicable' }
  | { status: 'past_due' }
  | { status: 'out_of_range' }
  | { status: 'incomplete'; missingBalance: boolean; missingMonths: (Period & { income: boolean; cards: string[] })[] }
  | { status: 'ready'; opening_balance: string; income: string; fixed_bills: string; card_expenses: string; balance: string }
)
export interface PayoffResponse {
  months: PayoffMonth[]
  timeline: (Period & { total: string; paid: string; open: string; invoice_count: number; missing_count: number })[]
  projection: Projection
}
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const label = (p: Period) => `${months[p.month - 1]} de ${p.year}`
const monthIndex = (p: Period) => p.year * 12 + p.month - 1
const fmt = (value: string | number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function BalanceProjection({ projection: p }: { projection: Projection }) {
  if (p.status === 'not_applicable') return null
  return <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
    <h4 className="text-sm font-semibold text-text">Saldo previsto ao final do mês de quitação</h4>
    {p.status === 'past_due' ? <p className="text-sm text-warning">Regularize as faturas de meses anteriores antes de calcular o saldo: confirme os pagamentos ou ajuste o planejamento para o mês em que vai pagá-las.</p>
      : p.status === 'out_of_range' ? <p className="text-sm text-warning">Revise as faturas: há valores fora dos anos aceitos pelo planejamento (até 2100).</p>
      : p.status === 'incomplete' ? <>
        <p className="text-sm text-warning">Planejamento incompleto. Preencha os dados abaixo para calcular o saldo; informe 0 quando não houver receita ou fatura.</p>
        {p.missingBalance && <p className="text-sm text-muted">Falta o saldo base no início de {label(p.start)}, na Configuração do mês.</p>}
        {p.missingMonths.length > 0 && <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium">Ver {p.missingMonths.length} {p.missingMonths.length === 1 ? 'mês com dados faltantes' : 'meses com dados faltantes'}</summary>
          <ul className="mt-2 max-h-56 space-y-2 overflow-auto pl-4 list-disc">
            {p.missingMonths.map(m => <li key={`${m.year}-${m.month}`} className="break-words">{label(m)}: {[m.income ? 'receita estimada' : '', m.cards.length ? `faturas de ${m.cards.join(', ')}` : ''].filter(Boolean).join('; ')}.</li>)}
          </ul>
        </details>}
      </> : <>
        <p className={`text-2xl font-bold tabular-nums ${Number(p.balance) < 0 ? 'text-expense' : 'text-income'}`}>{fmt(p.balance)}</p>
        <p className="text-xs text-muted">De {label(p.start)} até o fim de {label(p.end!)}.</p>
        <dl className="space-y-2 text-sm">
          {[
            ['Saldo base no início do período', p.opening_balance],
            ['+ Receitas previstas', p.income],
            ['− Contas fixas do período', p.fixed_bills],
            ['− Faturas do período (pagas e em aberto)', p.card_expenses],
          ].map(([title, value]) => <div key={title} className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">{title}</dt><dd className="tabular-nums text-text">{fmt(value)}</dd></div>)}
        </dl>
        {Number(p.balance) < 0 && <p className="text-sm text-expense">O planejamento termina com saldo negativo. Será necessário ajustar receitas ou despesas para quitar as faturas.</p>}
      </>}
    <p className="text-xs text-muted">O saldo usa o planejamento desde o início do mês atual e repete as contas fixas ativas até a quitação. Investimentos, metas, empréstimos e lançamentos avulsos ficam fora desta conta.</p>
  </div>
}

export function CardPayoffForecast({ userId }: { userId: string }) {
  const now = new Date()
  const month = now.getMonth() + 1, year = now.getFullYear()
  const query = useQuery({ queryKey: ['cardPayoff', userId, year, month], enabled: !!userId, queryFn: () => api.get<PayoffResponse>(`/finance/cards/payoff/projection?month=${month}&year=${year}`).then(response => response.data) })
  const entries = query.data?.months ?? []
  const timeline = query.data?.timeline ?? []
  const maxTimelineAmount = Math.max(...timeline.map(period => Number(period.total)), 0)
  const last = entries.at(-1)
  const currentMonth = monthIndex({ year, month })
  const totalInvoices = entries.reduce((sum, entry) => sum + entry.invoice_count, 0)
  const total = entries.reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0) / 100
  const onlyOlder = last && monthIndex(last) < currentMonth

  return <section className="space-y-3 min-w-0" aria-labelledby="card-payoff-title">
    <h3 id="card-payoff-title" className="flex items-center gap-2 text-sm font-semibold text-text"><CalendarCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> Previsão de quitação dos cartões</h3>
    <p className="text-xs text-muted">Todos os cartões e anos cadastrados, independentemente do mês selecionado no Dashboard.</p>
    {query.isPending ? <p role="status" className="text-sm text-muted">Calculando previsão…</p> : query.isError ? (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
        Não foi possível carregar a previsão.
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button>
      </div>
    ) : !last ? <p className="text-sm text-muted">Nenhuma fatura em aberto cadastrada.</p> : <>
      <p className="text-xl font-bold text-primary">{onlyOlder ? 'Regularize as faturas pendentes' : label(last)}</p>
      <p className="text-sm text-muted">{fmt(total)} em {totalInvoices} {totalInvoices === 1 ? 'fatura em aberto' : 'faturas em aberto'}.</p>
      <p className="text-xs text-muted">{onlyOlder ? 'Só há faturas de meses anteriores em aberto.' : 'Pelas faturas cadastradas, esse é o último mês com valor a quitar, se você pagar todas elas.'}</p>
      {timeline.length > 0 && <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text">Faturas mensais até a quitação</h4>
          <p className="mt-1 text-xs text-muted">Total somado de todos os cartões nos últimos {timeline.length} meses até {label(timeline.at(-1)!)}. A barra compara os totais registrados mês a mês.</p>
        </div>
        <ol className="space-y-3">
          {timeline.map(period => {
            const width = maxTimelineAmount > 0 ? Number(period.total) / maxTimelineAmount * 100 : 0
            return <li key={`${period.year}-${period.month}`} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="text-text">{label(period)}</span>
                <span className="font-semibold tabular-nums text-text">{fmt(period.total)}</span>
              </div>
              <div role="img" aria-label={`Total das faturas: ${fmt(period.total)}`} className="h-2 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${width}%` }} />
              </div>
              <p className="text-xs text-muted">{fmt(period.paid)} pagas · {fmt(period.open)} em aberto{period.missing_count > 0 ? ` · faltam ${period.missing_count} ${period.missing_count === 1 ? 'cartão' : 'cartões'} neste mês` : ''}</p>
            </li>
          })}
        </ol>
      </div>}
      {query.data && <BalanceProjection projection={query.data.projection} />}
    </>}
    <p className="text-xs text-muted">Inclua todas as parcelas futuras no Planejamento do ano. Novas compras alteram a previsão. As contas fixas não definem a data de quitação, mas são descontadas do saldo previsto.</p>
    <a href="#annual-planning" className="inline-block text-xs text-primary underline underline-offset-2">Ir para o planejamento</a>
  </section>
}
