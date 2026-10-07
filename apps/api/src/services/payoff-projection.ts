/** Monthly cash-flow forecast. Money stays in integer cents until serialization. */
export type Period = { year: number; month: number }
type Config = Period & { estimated_income: string | null; balance: string | null }
type Expense = Period & { card_id: string; amount: string; paid: boolean | null }
export type PayoffSnapshot = {
  configs: Config[]
  cards: { id: string; name: string }[]
  expenses: Expense[]
  fixed_total: string
}
const index = (p: Period) => p.year * 12 + p.month - 1
const period = (i: number): Period => ({ year: Math.floor(i / 12), month: i % 12 + 1 })
function cents(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid monetary value')
  const [whole, fraction = ''] = value.replace('-', '').split('.')
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (value.startsWith('-') ? -1n : 1n)
}
function money(value: bigint) {
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

export function projectCardPayoff(data: PayoffSnapshot, start: Period) {
  const grouped = new Map<number, { amount: bigint; invoice_count: number }>()
  for (const expense of data.expenses) {
    const amount = cents(expense.amount)
    if (expense.paid || amount <= 0n) continue
    const entry = grouped.get(index(expense)) ?? { amount: 0n, invoice_count: 0 }
    entry.amount += amount
    entry.invoice_count++
    grouped.set(index(expense), entry)
  }
  const months = [...grouped.entries()].sort(([a], [b]) => a - b).map(([i, entry]) => ({ ...period(i), amount: money(entry.amount), invoice_count: entry.invoice_count }))
  const last = months.at(-1)
  const end = last ? { year: last.year, month: last.month } : null
  const base = { start, end }
  if (!end) return { months, projection: { ...base, status: 'not_applicable' as const } }
  if (months.some(p => index(p) < index(start))) return { months, projection: { ...base, status: 'past_due' as const } }
  if (end.year > 2100) return { months, projection: { ...base, status: 'out_of_range' as const } }

  const configs = new Map(data.configs.map(c => [index(c), c]))
  const expenses = new Map(data.expenses.map(e => [`${index(e)}:${e.card_id}`, e]))
  const opening = configs.get(index(start))?.balance
  const missingBalance = opening == null
  const missingMonths: (Period & { income: boolean; cards: string[] })[] = []
  let income = 0n, cardExpenses = 0n
  for (let i = index(start); i <= index(end); i++) {
    const config = configs.get(i)
    const missingIncome = config?.estimated_income == null
    if (!missingIncome) income += cents(config.estimated_income!)
    const missingCards: string[] = []
    for (const card of data.cards) {
      const expense = expenses.get(`${i}:${card.id}`)
      if (!expense) missingCards.push(card.name)
      else cardExpenses += cents(expense.amount)
    }
    if (missingIncome || missingCards.length) missingMonths.push({ ...period(i), income: missingIncome, cards: missingCards })
  }
  if (missingBalance || missingMonths.length) return { months, projection: { ...base, status: 'incomplete' as const, missingBalance, missingMonths } }

  const openingBalance = cents(opening!)
  const fixedBills = cents(data.fixed_total) * BigInt(index(end) - index(start) + 1)
  return { months, projection: {
    ...base, status: 'ready' as const,
    opening_balance: money(openingBalance), income: money(income), fixed_bills: money(fixedBills), card_expenses: money(cardExpenses),
    balance: money(openingBalance + income - fixedBills - cardExpenses),
  } }
}
