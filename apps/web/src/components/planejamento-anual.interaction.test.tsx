// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import api from '@/services/api'
import { PlanejamentoAnual } from './planejamento-anual'
import { useAnnualPlanning } from '@/hooks/useAnnualPlanning'
import type { CartaoDoAno, LinhaDoAno } from './planejamento-anual'

let container: HTMLDivElement, root: Root, client: QueryClient
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  client.clear()
  vi.restoreAllMocks()
})

async function mount() {
  client.setQueryData(['annualSummary', 'alice', 2031], Array.from({ length: 12 }, (_, i) => ({ month: i + 1, estimated_income: '1000', total_fixed_bills: '100', total_card_expenses: '200' })))
  client.setQueryData(['annual', 'alice', 2031], [{ id: 'card', name: 'Teste', color: '#000', monthly_breakdown: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: '200' })) }])
  function TestPlanning() {
    const { data: linhas = [] } = useQuery<LinhaDoAno[]>({ queryKey: ['annualSummary', 'alice', 2031], queryFn: async () => client.getQueryData(['annualSummary', 'alice', 2031])!, staleTime: Infinity })
    const { data: cartoes = [] } = useQuery<CartaoDoAno[]>({ queryKey: ['annual', 'alice', 2031], queryFn: async () => client.getQueryData(['annual', 'alice', 2031])!, staleTime: Infinity })
    const planning = useAnnualPlanning({ userId: 'alice', ano: 2031, mesAtual: 10, config: { balance: '500', estimated_income: linhas.find(row => row.month === 10)?.estimated_income ?? null }, linhas, cartoes, fixedBills: 100 })
    return <><button onClick={() => planning.removeCard('card')}>Confirmar exclusão do cartão</button><PlanejamentoAnual ano={2031} mesAtual={10} saldoAtual={500} linhas={linhas} cartoes={cartoes} planning={planning} formata={value => String(value)} /></>
  }
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <TestPlanning />
    </QueryClientProvider>,
  ))
}
function field(label: string) {
  return container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
}
async function change(label: string, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(label), value)
    field(label).dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function apply() {
  await act(async () => {
    const button = [...container.querySelectorAll('button')].find(el => /Salvar o ano|Aplicar alterações/.test(el.textContent ?? ''))!
    button.click()
  })
}

it('recalcula a receita de outubro até dezembro sem alterar meses anteriores nem faturas', async () => {
  await mount()
  await change('Receita estimada de Out', '2500')
  expect(field('Receita estimada de Set').value).toBe('1000')
  expect(field('Receita estimada de Nov').value).toBe('2500')
  expect(field('Receita estimada de Dez').value).toBe('2500')
  expect(field('Fatura Teste de Dez').value).toBe('200')
})

it('não perde uma edição feita enquanto a gravação anterior está em andamento', async () => {
  let finish!: (value: unknown) => void
  vi.spyOn(api, 'post').mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await mount()
  await change('Fatura Teste de Out', '350')
  await apply()
  await change('Fatura Teste de Out', '450')
  await act(async () => {
    finish({ data: { meses: 1, faturas: 1 } })
    await new Promise(resolve => setTimeout(resolve, 10))
  })
  expect(field('Fatura Teste de Out').value).toBe('450')
  expect(container.textContent).toContain('Alterações ainda não aplicadas')
})

it('aplica os meses alterados e só anuncia sucesso após a confirmação', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { meses: 3, faturas: 0 } })
  await mount()
  await change('Receita estimada de Out', '2500')
  expect(post).not.toHaveBeenCalled()
  await apply()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(post).toHaveBeenCalledWith('/finance/planejamento', { year: 2031, meses: [
    { month: 10, estimated_income: 2500 }, { month: 11, estimated_income: 2500 }, { month: 12, estimated_income: 2500 },
  ] })
  expect(field('Receita estimada de Dez').value).toBe('2500')
  expect(container.textContent).toContain('Alterações salvas')
  expect(container.textContent).not.toContain('Alterações ainda não aplicadas')
})

it('mantém o rascunho após falha de conexão e permite reaplicar', async () => {
  const post = vi.spyOn(api, 'post').mockRejectedValueOnce(Object.assign(new Error('offline'), { isAxiosError: true })).mockResolvedValue({ data: {} })
  await mount()
  await change('Fatura Teste de Out', '450')
  await apply()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(container.textContent).toContain('Não foi possível confirmar o salvamento')
  expect(container.textContent).not.toContain('Alterações salvas')
  expect(field('Fatura Teste de Out').value).toBe('450')
  await apply()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(post).toHaveBeenCalledTimes(2)
  expect(field('Fatura Teste de Out').value).toBe('450')
  expect(container.textContent).toContain('Alterações salvas')
})

it('não ignora silenciosamente uma fatura apagada e aceita zero explícito', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  await mount()
  await change('Fatura Teste de Out', '')
  await apply()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(post).not.toHaveBeenCalled()
  expect(container.textContent).toContain('use 0 quando não houver valor')
  await change('Fatura Teste de Out', '0')
  await apply()
  expect(post).toHaveBeenCalledWith('/finance/planejamento', { year: 2031, meses: [{ month: 10, cards: [{ cardId: 'card', amount: 0 }] }] })
})

it('remove o rascunho de um cartão excluído sem bloquear o restante do planejamento', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  await mount()
  await change('Fatura Teste de Out', '450')
  await change('Receita estimada de Nov', '2700')
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Confirmar exclusão do cartão')!.click())
  await apply()
  expect(post).toHaveBeenCalledWith('/finance/planejamento', { year: 2031, meses: [{ month: 11, estimated_income: 2700 }, { month: 12, estimated_income: 2700 }] })
})
