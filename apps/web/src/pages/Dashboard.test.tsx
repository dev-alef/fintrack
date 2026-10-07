import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './Dashboard'

const auth = vi.hoisted(() => ({ userId: 'alice' }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: auth.userId, name: 'Alice' } } }) }))

const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const clients: QueryClient[] = []
afterEach(() => { clients.splice(0).forEach(client => client.clear()); auth.userId = 'alice' })

function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  clients.push(client)
  const now = new Date()
  const month = now.getMonth() + 1, year = now.getFullYear()
  const seed = (key: string, suffix: unknown[], data: unknown) => {
    client.setQueryData([key, 'alice', ...suffix], data)
  }
  seed('cards', [], [])
  seed('payments', [month, year], [{ id: 'bill', name: 'Luz', amount: '100.00' }])
  seed('expenses', [month, year], [{ card_id: 'card', card_name: 'Cartão', amount: '200.00' }])
  seed('config', [month, year], { estimated_income: '1000.00', balance: '100.00', investments: '99999.00' })
  seed('annual', [year], [])
  seed('annualSummary', [year], [])
  seed('summary', [String(month), String(year)], { byCategory: [] })
  seed('goals', [], [{ id: 'goal', title: 'Reserva', current_amount: '300.00', target_amount: '600.00', progress_pct: '50' }])
  seed('portfolio', [], [{ total_current: '1000.00' }, { total_current: '200.00' }])
  seed('loans', [], [])
  return client
}

function render(client: QueryClient) {
  return renderToStaticMarkup(<StaticRouter location="/dashboard"><QueryClientProvider client={client}><Dashboard /></QueryClientProvider></StaticRouter>)
}

function cardValue(html: string, label: string) {
  return html.slice(html.indexOf(label)).match(/<p[^>]*>(.*?)<\/p>/)?.[1]
}

describe('Patrimônio no Dashboard', () => {
  it('soma saldo do mês, valor atual da carteira e metas uma única vez, ignorando o investimento manual antigo', () => {
    const html = render(fixture())
    expect(cardValue(html, 'Patrimônio total')).toBe(fmt(2300))
    expect(cardValue(html, '> Investimentos')).toBe(fmt(1200))
    expect(html).not.toContain('id="dash-investments"')
  })

  it('carteira vazia vale zero mesmo quando existe valor manual antigo', () => {
    const client = fixture()
    client.setQueryData(['portfolio', 'alice'], [])
    expect(cardValue(render(client), 'Patrimônio total')).toBe(fmt(1100))
  })

  it('aguarda metas e carteira para não apresentar um patrimônio incompleto', () => {
    const client = fixture()
    client.removeQueries({ queryKey: ['goals', 'alice'] })
    expect(render(client)).not.toContain('Patrimônio total')
  })

  it('falha na carteira não se transforma em patrimônio calculado com zero', () => {
    const client = fixture()
    client.getQueryCache().find({ queryKey: ['portfolio', 'alice'] })!.setState({ status: 'error', error: new Error('offline') })
    const html = render(client)
    expect(html).toContain('Erro ao carregar dados do dashboard')
    expect(html).not.toContain('Patrimônio total')
  })

  it('trocar de conta não reutiliza os valores financeiros da sessão anterior', () => {
    const client = fixture()
    auth.userId = 'bob'
    const html = render(client)
    expect(html).not.toContain(fmt(2300))
    expect(html).not.toContain('Patrimônio total')
  })
})
