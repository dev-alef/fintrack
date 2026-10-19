type Amount = string | number | null | undefined
type Payment = { amount: Amount; paid?: boolean | null }

const cents = (amount: Amount) => {
  const value = Number(amount ?? 0)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}
const totalCents = (items: Payment[]) => items.reduce((sum, item) => sum + cents(item.amount), 0)

/** One month-end forecast: current balance + estimated income - all monthly bills/invoices. */
export function calculateMonthlyCashflow({
  currentBalance,
  estimatedIncome,
  fixedBills,
  cardInvoices,
}: {
  currentBalance: Amount
  estimatedIncome: Amount
  fixedBills: Payment[]
  cardInvoices: Payment[]
}) {
  const currentBalanceCents = cents(currentBalance)
  const estimatedIncomeCents = cents(estimatedIncome)
  const fixedBillsCents = totalCents(fixedBills)
  const cardInvoicesCents = totalCents(cardInvoices)
  const toAmount = (value: number) => value / 100

  return {
    fixedBills: toAmount(fixedBillsCents),
    cardInvoices: toAmount(cardInvoicesCents),
    monthEndBalance: toAmount(currentBalanceCents + estimatedIncomeCents - fixedBillsCents - cardInvoicesCents),
  }
}
