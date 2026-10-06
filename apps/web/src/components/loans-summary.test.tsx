import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoansSummary } from './loans-summary'
import type { Loan } from '@/lib/loans'

const clients: QueryClient[] = []
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.useRealTimers() })
const loan = (person: string, direction: Loan['direction'], remaining_amount: string, due_date: string | null): Loan => ({
  id: person, person, direction, remaining_amount, due_date,
  amount: '1000.00', paid_amount: '0.00', description: '', payments: [], created_at: '2026-01-01T00:00:00Z',
})

function fixture(loans: Loan[]) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T12:00:00'))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  clients.push(client)
  client.setQueryData(['loans', 'alice'], loans)
  return client
}
function render(client: QueryClient, userId = 'alice') {
  return renderToStaticMarkup(<StaticRouter location="/dashboard"><QueryClientProvider client={client}><LoansSummary userId={userId} /></QueryClientProvider></StaticRouter>)
}

describe('Resumo de empréstimos', () => {
  it('soma apenas saldos restantes e prioriza atrasados, hoje e próximos, excluindo quitados', () => {
    const html = render(fixture([
      loan('Sem data', 'payable', '10.10', null),
      loan('Futuro', 'receivable', '30.30', '2026-10-07'),
      loan('Quitado', 'payable', '0.00', '2025-01-01'),
      loan('Hoje', 'payable', '20.20', '2026-10-06'),
      loan('Atrasado', 'receivable', '40.40', '2026-10-05'),
    ]))
    expect(html).toContain('R$ 30,30')
    expect(html).toContain('R$ 70,70')
    expect(html).toContain('R$ 40,40 em atraso')
    const priorities = html.slice(html.indexOf('Pendências prioritárias'))
    expect(priorities.indexOf('Atrasado')).toBeLessThan(priorities.indexOf('Hoje'))
    expect(priorities.indexOf('Hoje')).toBeLessThan(priorities.indexOf('Futuro'))
    expect(priorities).not.toContain('Sem data')
    expect(html).not.toContain('Quitado')
    expect(html).toContain('Vence hoje')
    expect(html).toContain('href="/emprestimos"')
  })

  it('inclui empréstimo sem data depois dos datados quando há espaço', () => {
    const html = render(fixture([loan('Sem vencimento', 'payable', '0.10', null)]))
    expect(html).toContain('R$ 0,10')
    expect(html).toContain('Sem vencimento')
    expect(html).not.toContain('em atraso')
  })

  it('distingue lista vazia de falha e não exibe dados de outra sessão', () => {
    const client = fixture([])
    expect(render(client)).toContain('Nenhum empréstimo em aberto')
    client.getQueryCache().find({ queryKey: ['loans', 'alice'] })!.setState({ status: 'error', error: new Error('offline') })
    expect(render(client)).toContain('Não foi possível carregar os empréstimos')
    expect(render(client)).not.toContain('Tudo em dia')
    expect(render(client, 'bob')).toContain('Carregando empréstimos')
  })
})
