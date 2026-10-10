import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CardPayoffForecast, type PayoffResponse } from './card-payoff-forecast'

const clients: QueryClient[] = []
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.useRealTimers() })
function fixture(entries: { year: number; month: number; amount: string; invoice_count: number }[], projection?: PayoffResponse['projection']) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T12:00:00'))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  clients.push(client)
  client.setQueryData(['cardPayoff', 'alice', 2026, 10], { months: entries, projection: projection ?? { status: 'past_due', start: { year: 2026, month: 10 }, end: null } })
  return client
}
const render = (client: QueryClient, userId = 'alice') => renderToStaticMarkup(<QueryClientProvider client={client}><CardPayoffForecast userId={userId} /></QueryClientProvider>)

describe('Previsão de quitação dos cartões', () => {
  it('mostra último mês entre anos e soma valores em centavos, incluindo pendências antigas', () => {
    const html = render(fixture([
      { year: 2026, month: 9, amount: '0.10', invoice_count: 1 },
      { year: 2026, month: 12, amount: '20.20', invoice_count: 2 },
      { year: 2027, month: 2, amount: '30.30', invoice_count: 1 },
    ]))
    expect(html).toContain('fevereiro de 2027')
    expect(html).toContain('R$ 50,60 em 4 faturas em aberto')
    expect(html).toContain('Regularize as faturas de meses anteriores')
    expect(html).toContain('se você pagar todas elas')
    expect(html).toContain('href="#annual-planning"')
  })
  it('não promete quitação em uma data passada', () => {
    const html = render(fixture([{ year: 2026, month: 9, amount: '100.00', invoice_count: 1 }]))
    expect(html).toContain('Regularize as faturas pendentes')
    expect(html).not.toContain('setembro de 2026')
  })
  it('aceita o mês atual como último mês a quitar', () => {
    expect(render(fixture([{ year: 2026, month: 10, amount: '100.00', invoice_count: 1 }]))).toContain('outubro de 2026')
  })
  it('distingue ausência de registros, erro e carregamento de outra conta', () => {
    const client = fixture([])
    expect(render(client)).toContain('Nenhuma fatura em aberto cadastrada')
    client.getQueryCache().find({ queryKey: ['cardPayoff', 'alice', 2026, 10] })!.setState({ status: 'error', error: new Error('offline') })
    expect(render(client)).toContain('Não foi possível carregar a previsão')
    expect(render(client)).not.toContain('Nenhuma fatura em aberto cadastrada')
    expect(render(client, 'bob')).toContain('Calculando previsão')
  })
  it('mostra a conta do saldo e avisa quando o resultado é negativo', () => {
    const html = render(fixture([{ year: 2026, month: 10, amount: '100.00', invoice_count: 1 }], {
      status: 'ready', start: { year: 2026, month: 10 }, end: { year: 2026, month: 10 },
      current_balance: '0.00', income: '0.00', fixed_bills: '50.00', card_expenses: '100.00', balance: '-150.00',
    }))
    expect(html).toContain('-R$ 150,00')
    expect(html).toContain('saldo negativo')
    expect(html).toContain('Faturas ainda não pagas')
  })
  it('explica lacunas sem inventar um saldo zero', () => {
    const html = render(fixture([{ year: 2026, month: 12, amount: '100.00', invoice_count: 1 }], {
      status: 'incomplete', start: { year: 2026, month: 10 }, end: { year: 2026, month: 12 }, missingBalance: true,
      missingMonths: [{ year: 2026, month: 11, income: true, cards: ['Banco'] }],
    }))
    expect(html).toContain('Planejamento incompleto')
    expect(html).toContain('Falta informar o Saldo Atual')
    expect(html).toContain('novembro de 2026: receita estimada; faturas de Banco')
    expect(html).not.toContain('R$ 0,00')
  })

})
