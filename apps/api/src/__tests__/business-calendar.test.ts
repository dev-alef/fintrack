import { describe, expect, it } from 'vitest'
import { dueInMonth, summarizeBusiness, type Subscription, type Receipt } from '../services/business-calendar'
const subscription = (fields: Partial<Subscription> = {}): Subscription => ({ id: 's', client_id: 'c', client_name: 'Cliente', service_name: 'Suporte', amount: '100.10', interval_months: 1, start_date: '2024-01-31', end_date: null, notes: '', ...fields })
const receipt = (fields: Partial<Receipt> = {}): Receipt => ({ id: 'r', subscription_id: 's', due_on: '2024-01-31', paid_on: '2024-02-01', amount: '100.10', client_name: 'Cliente', service_name: 'Suporte', notes: '', voided_at: null, ...fields })
describe('Calendário profissional', () => {
  it('preserva o dia âncora em fevereiro, março, trimestre e ano bissexto', () => {
    expect(dueInMonth(subscription(),2024,2)).toBe('2024-02-29')
    expect(dueInMonth(subscription(),2024,3)).toBe('2024-03-31')
    expect(dueInMonth(subscription({ interval_months: 3 }),2024,2)).toBeNull()
    expect(dueInMonth(subscription({ interval_months: 3 }),2024,4)).toBe('2024-04-30')
    const annual = subscription({ start_date: '2024-02-29', interval_months: 12 })
    expect(dueInMonth(annual,2025,2)).toBe('2025-02-28')
    expect(dueInMonth(annual,2028,2)).toBe('2028-02-29')
  })
  it('respeita encerramento inclusive e cancelamento antes do início', () => {
    expect(dueInMonth(subscription({ end_date: '2024-02-29' }),2024,2)).toBe('2024-02-29')
    expect(dueInMonth(subscription({ end_date: '2024-02-28' }),2024,2)).toBeNull()
    expect(dueInMonth(subscription({ end_date: '2023-12-31' }),2024,1)).toBeNull()
  })
  it('separa caixa, vencimentos, pendências anteriores e estornos sem arredondar errado', () => {
    const result = summarizeBusiness([subscription()], [receipt(),receipt({ id: 'void', due_on: '2024-02-29', voided_at: '2024-02-01' })], [{ id: 'e', title: 'Ferramenta', amount: '30.05', category: '', notes: '', spent_on: '2024-02-01' }],2024,2,'2024-03-01')
    expect(result.totals).toMatchObject({ expected: '100.10', pending: '100.10', received: '100.10', expenses: '30.05', result: '70.05', overdue: '100.10' })
    expect(result.previous).toHaveLength(0)
    expect(result.dues[0].status).toBe('overdue')
    expect(result.receipts).toHaveLength(2)
    expect(summarizeBusiness([subscription()],[],[],2024,2,'2024-02-29').previous).toHaveLength(1)
  })
  it('normaliza receita recorrente e mantém ausência de histórico como zero', () => {
    const result = summarizeBusiness([subscription({ id: 'q', amount: '300.00', interval_months: 3 }),subscription({ id: 'a', amount: '1200.00', interval_months: 12 })],[],[],2024,2,'2024-02-01')
    expect(result.totals).toMatchObject({ monthly_recurring: '200.00', received: '0.00', result: '0.00', expected: '0.00' })
  })
})
