type Amount = string | number | null | undefined
type Payment = { amount: Amount; paid?: boolean | null }

const cents = (amount: Amount) => {
  const value = Number(amount ?? 0)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}
const totalCents = (items: Payment[]) => items.reduce((sum, item) => sum + cents(item.amount), 0)

/** Full-month plan plus a remaining-cash estimate from a manually updated current balance. */
export function calculateMonthlyCashflow({
  currentBalance,
  estimatedIncome,
  receivedIncome,
  fixedBills,
  cardInvoices,
}: {
  currentBalance: Amount
  estimatedIncome: Amount
  receivedIncome: Amount
  fixedBills: Payment[]
  cardInvoices: Payment[]
}) {
  const currentBalanceCents = cents(currentBalance)
  const estimatedIncomeCents = cents(estimatedIncome)
  const receivedIncomeCents = cents(receivedIncome)
  const fixedBillsCents = totalCents(fixedBills)
  const cardInvoicesCents = totalCents(cardInvoices)
  const pendingFixedBillsCents = totalCents(fixedBills.filter(item => !item.paid))
  const pendingCardInvoicesCents = totalCents(cardInvoices.filter(item => !item.paid))
  const remainingIncomeCents = Math.max(0, estimatedIncomeCents - receivedIncomeCents)
  const toAmount = (value: number) => value / 100

  return {
    fixedBills: toAmount(fixedBillsCents),
    cardInvoices: toAmount(cardInvoicesCents),
    pendingFixedBills: toAmount(pendingFixedBillsCents),
    pendingCardInvoices: toAmount(pendingCardInvoicesCents),
    remainingIncome: toAmount(remainingIncomeCents),
    plannedSurplus: toAmount(estimatedIncomeCents - fixedBillsCents - cardInvoicesCents),
    monthEndBalance: toAmount(currentBalanceCents + remainingIncomeCents - pendingFixedBillsCents - pendingCardInvoicesCents),
  }
}
