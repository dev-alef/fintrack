import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Business from './Business'
import type { BusinessData } from '@/lib/business'
const auth = vi.hoisted(() => ({ userId: 'alice' }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: auth.userId } } }) }))
const clients: QueryClient[] = []
afterEach(() => { clients.splice(0).forEach(c => c.clear()); auth.userId = 'alice' })
const period = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0,7)
function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); clients.push(client)
  const data: BusinessData = { clients: [], subscriptions: [], dues: [], previous: [], expenses: [], receipts: [], today: `${period()}-01`, totals: { expected: '1000.00', received: '1000.00', expenses: '300.00', result: '700.00', pending: '0.00', overdue: '0.00', monthly_recurring: '1000.00', active_subscriptions: 2 } }
  client.setQueryData(['business','alice',period()],data)
  return client
}
const render = (client: QueryClient) => renderToStaticMarkup(<QueryClientProvider client={client}><Business /></QueryClientProvider>)
describe('Área profissional', () => {
  it('distingue dinheiro recebido de previsão e informa a separação pessoal', () => {
    const html = render(fixture())
    expect(html).toContain('Resultado do mês')
    expect(html).toContain('R$ 700,00')
    expect(html).toContain('Receita recorrente mensal equivalente')
    expect(html).toContain('não é dinheiro recebido')
    expect(html).toContain('não alteram seu Saldo Atual pessoal')
    expect(html).toContain('Nenhum vencimento de assinatura neste mês')
  })
  it('não mostra zero como resultado quando a consulta falha', () => {
    const client = fixture()
    client.getQueryCache().find({ queryKey: ['business','alice',period()] })!.setState({ status: 'error', error: new Error('offline') })
    const html = render(client)
    expect(html).toContain('Não foi possível carregar os dados profissionais')
    expect(html).not.toContain('Resultado do mês')
  })
  it('trocar de conta não reaproveita clientes nem valores do usuário anterior', () => {
    const client = fixture(); auth.userId = 'bob'
    const html = render(client)
    expect(html).toContain('Carregando controle profissional')
    expect(html).not.toContain('R$ 700,00')
  })
})
