import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

type Period = { year: number; month: number }
export type Forecast = { start: Period; current_balance: string | null; months: (Period & {
  opening_balance: string | null; income: string | null; fixed_bills: string; card_expenses: string; balance: string | null
  missing: (Period & { fields: string[] })[]
})[] }
const label = (p: Period) => new Date(p.year, p.month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const fmt = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function ThreeMonthForecastView({ data }: { data: Forecast }) {
  return <section aria-labelledby="three-month-title">
    <h3 id="three-month-title" className="font-semibold text-text">Sobra prevista para os próximos 3 meses</h3>
    <p className="mt-1 text-sm text-muted">A partir de {label(data.start)}: Saldo Atual + receitas estimadas − contas fixas − faturas. O resultado de cada mês passa para o seguinte; o Saldo Atual entra uma única vez.</p>
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {data.months.map(m => <div key={`${m.year}-${m.month}`} className="min-w-0 rounded-xl border border-border p-3">
        <h4 className="text-sm capitalize text-muted">{label(m)}</h4>
        {m.balance === null ? <p className="mt-2 text-sm text-muted">Planejamento incompleto</p> : <>
          <p className="mt-2 break-words text-xl font-semibold tabular-nums" style={{ color: Number(m.balance) < 0 ? 'var(--expense)' : 'var(--income)' }}>{fmt(m.balance)}</p>
          <p className="text-xs text-muted">{Number(m.balance) < 0 ? 'Previsão de saldo negativo' : 'Saldo acumulado previsto'}</p>
        </>}
        <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer">{m.missing.length ? 'Ver o que falta' : 'Ver cálculo'}</summary>
          {m.missing.length ? m.missing.map(p => <p key={`${p.year}-${p.month}`} className="mt-2">{label(p)}: {p.fields.join(', ')}.</p>) : <dl className="mt-2 space-y-1">
            {[['Saldo previsto anterior', m.opening_balance], ['+ Receita', m.income], ['− Contas fixas', m.fixed_bills], ['− Faturas', m.card_expenses]].map(([name, value]) => <div key={name} className="flex flex-wrap justify-between gap-1"><dt>{name}</dt><dd>{value == null ? 'Não informado' : fmt(value)}</dd></div>)}
          </dl>}
        </details>
      </div>)}
    </div>
    <p className="mt-2 text-xs text-muted">Considera contas fixas ativas repetidas mensalmente e todas as faturas, inclusive pagas, seguindo a Sobra prevista no mês. Não inclui investimentos, metas ou caixa profissional. Preencha as receitas e faturas no Planejamento do ano; informe zero quando não houver valor.</p>
  </section>
}
export function ThreeMonthForecast({ userId, month, year }: { userId: string; month: number; year: number }) {
  const q = useQuery<Forecast>({ queryKey: ['threeMonthForecast', userId, month, year], queryFn: () => api.get(`/finance/forecast/three-months?month=${month}&year=${year}`).then(r => r.data) })
  if (q.isPending) return <p className="text-sm text-muted">Calculando os próximos três meses…</p>
  if (q.isError) return <p role="alert" className="text-sm text-muted">Não foi possível carregar a previsão. <button onClick={() => q.refetch()} className="underline">Tentar novamente</button></p>
  return <ThreeMonthForecastView data={q.data} />
}
