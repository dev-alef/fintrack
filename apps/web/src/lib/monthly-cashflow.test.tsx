import { describe, expect, it } from 'vitest'
import { calculateMonthlyCashflow } from './monthly-cashflow'

describe('calculateMonthlyCashflow', () => {
  it('mantém a sobra do mês inteiro e estima o saldo só com pagamentos restantes', () => {
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
      pendingFixedBills: 1200,
      pendingCardInvoices: 1000,
      plannedSurplus: 1000,
      monthEndBalance: -949.5,
    })
  })

  it('não inclui receita estimada no saldo previsto', () => {
    const result = calculateMonthlyCashflow({
      currentBalance: '2000.00',
      estimatedIncome: '1000.00',
      fixedBills: [],
      cardInvoices: [],
    })

    expect(result.monthEndBalance).toBe(2000)
  })
})
