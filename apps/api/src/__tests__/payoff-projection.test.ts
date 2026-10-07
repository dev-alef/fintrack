import { describe, expect, it } from 'vitest'
import { projectCardPayoff, type PayoffSnapshot } from '../services/payoff-projection'
const start = { year: 2026, month: 12 }
function snapshot(): PayoffSnapshot {
  return {
    configs: [
      { ...start, balance: '1000.10', estimated_income: '2000.20' },
      { year: 2027, month: 1, balance: '999999.00', estimated_income: '0.00' },
    ],
    cards: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    expenses: [
      { ...start, card_id: 'a', amount: '100.10', paid: true },
      { ...start, card_id: 'b', amount: '200.20', paid: false },
      { year: 2027, month: 1, card_id: 'a', amount: '300.30', paid: false },
      { year: 2027, month: 1, card_id: 'b', amount: '0.00', paid: false },
    ],
    fixed_total: '400.40',
  }
}
describe('Saldo no mês de quitação', () => {
  it('cruza anos, desconta pagas uma vez, aceita receita zero e ignora saldos futuros', () => {
    const result = projectCardPayoff(snapshot(), start)
    expect(result.projection).toEqual({ start, end: { year: 2027, month: 1 }, status: 'ready', opening_balance: '1000.10', income: '2000.20', fixed_bills: '800.80', card_expenses: '600.60', balance: '1598.90' })
    expect(result.months).toHaveLength(2)
    const data = snapshot()
    data.expenses[1].paid = true
    expect(projectCardPayoff(data, start).projection).toEqual(result.projection)
  })
  it('lista meses ausentes e não calcula com renda, saldo ou faturas desconhecidas', () => {
    const data = snapshot()
    data.configs = [{ ...start, balance: null, estimated_income: null }]
    data.expenses.splice(3, 1)
    expect(projectCardPayoff(data, start).projection).toEqual({ start, end: { year: 2027, month: 1 }, status: 'incomplete', missingBalance: true, missingMonths: [
      { ...start, income: true, cards: [] }, { year: 2027, month: 1, income: true, cards: ['B'] },
    ] })
  })
  it('não pula meses intermediários vazios', () => {
    const data = snapshot()
    data.expenses[2] = { ...data.expenses[2], month: 3 }
    const result = projectCardPayoff(data, start).projection
    expect(result.status).toBe('incomplete')
    if (result.status === 'incomplete') expect(result.missingMonths.map(m => m.month)).toEqual([1, 2, 3])
  })
  it('bloqueia saldo se houver pendência anterior ao saldo base', () => {
    const data = snapshot()
    data.expenses.push({ year: 2026, month: 11, card_id: 'a', amount: '1.00', paid: false })
    expect(projectCardPayoff(data, start).projection.status).toBe('past_due')
  })
  it('retorna negativo sem zerar nem somar patrimônio', () => {
    const data = snapshot()
    data.configs[0].balance = '0.00'
    data.configs[0].estimated_income = '0.00'
    const result = projectCardPayoff(data, start).projection
    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(result.balance).toBe('-1401.40')
  })
  it('não promete data ou saldo se todas as faturas estiverem pagas', () => {
    const data = snapshot()
    data.expenses.forEach(e => e.paid = true)
    expect(projectCardPayoff(data, start)).toEqual({ months: [], projection: { start, end: null, status: 'not_applicable' } })
  })
  it('falha com dinheiro inválido e limita o horizonte legado', () => {
    const data = snapshot()
    data.expenses[0].amount = 'NaN'
    expect(() => projectCardPayoff(data, start)).toThrow()
    data.expenses[0].amount = '100.10'
    data.expenses[2].year = 9999
    expect(projectCardPayoff(data, start).projection.status).toBe('out_of_range')
  })
})
