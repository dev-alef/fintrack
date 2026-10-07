import { describe, expect, it, vi } from 'vitest'
import { generateInsights } from '../services/insights.service'

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn(async (_prompt: string) => ({ response: { text: () => 'Análise de teste' } })) }))
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent } } } }))
vi.mock('../services/transaction.service', () => ({ getSummary: async () => ({ totals: { total_income: '0', total_expense: '0' }, byCategory: [] }) }))
vi.mock('../services/finance.service', () => ({
  getBillPayments: async () => [{ name: 'Luz', amount: '100.00', paid: false }],
  getCardExpenses: async () => [{ card_name: 'Cartão', amount: '200.00' }],
  getMonthlyConfig: async () => ({ estimated_income: '1000.00', balance: '100.00', investments: '99999.00' }),
}))
vi.mock('../services/investments.service', () => ({
  listInvestments: async () => [],
  getPortfolioSummary: async () => [{ type_name: 'Reserva', total_invested: '900.00', total_current: '1000.00' }, { type_name: 'Ações', total_invested: '300.00', total_current: '200.00' }],
}))
vi.mock('../services/goals.service', () => ({ listGoals: async () => [{ current_amount: '300.00' }] }))

describe('Patrimônio enviado à IA', () => {
  it('usa o valor atual da carteira e inclui metas uma vez, sem o campo manual antigo', async () => {
    const result = await generateInsights('alice')
    expect(result.summary.investments).toBe(1200)
    expect(result.summary.patrimonio).toBe(2300)
    const prompt = generateContent.mock.calls[0][0]
    expect(prompt).toContain('Patrimônio total (saldo + investimentos + metas): R$ 2300.00')
    expect(prompt).toContain('Guardado em metas: R$ 300.00')
    expect(prompt).toContain('Reserva: investido')
    expect(prompt).not.toContain('99999')
  })
})
