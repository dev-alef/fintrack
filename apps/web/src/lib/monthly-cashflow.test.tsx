import { describe, expect, it } from 'vitest'
import { calculateMonthlyCashflow } from './monthly-cashflow'

describe('calculateMonthlyCashflow', () => {
  it('soma a receita e o Saldo Atual e desconta todas as despesas mensais, inclusive pagas', () => {
    const result = calculateMonthlyCashflow({
      currentBalance: '1250.50',
      estimatedIncome: '4000.00',
      fixedBills: [
        { amount: '200.00', paid: true },
        { amount: '1200.00', paid: false },
      ],
      cardInvoices: [
        { amount: '600.00', paid: true },
        { amount: '1000.00', paid: false },
      ],
    })

    expect(result).toEqual({
      fixedBills: 1400,
      cardInvoices: 1600,
      monthEndBalance: 2250.5,
    })
  })

  it('inclui receita estimada no saldo previsto', () => {
    const result = calculateMonthlyCashflow({
      currentBalance: '2000.00',
      estimatedIncome: '1000.00',
      fixedBills: [],
      cardInvoices: [],
    })

    expect(result.monthEndBalance).toBe(3000)
  })
  it('preserva previsão negativa e centavos', () => {
    expect(calculateMonthlyCashflow({ currentBalance: '0.10', estimatedIncome: '0.20', fixedBills: [{ amount: '0.40' }], cardInvoices: [{ amount: '0.20' }] }).monthEndBalance).toBe(-0.30)
  })
})
