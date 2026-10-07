/** Monthly cash-flow forecast. Money stays in integer cents until serialization. */
export type Period = { year: number; month: number }
type Config = Period & { estimated_income: string | null; balance: string | null }
type Expense = Period & { card_id: string; amount: string; paid: boolean | null }
export type PayoffSnapshot = {
  configs: Config[]
  cards: { id: string; name: string; created_year: number | null; created_month: number | null }[]
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
  if (!end) return { months, timeline: [], projection: { ...base, status: 'not_applicable' as const } }
  if (end.year > 2100) return { months, timeline: [], projection: { ...base, status: 'out_of_range' as const } }

  const groupedAll = new Map<number, { total: bigint; paid: bigint; open: bigint; invoice_count: number }>()
  const recordedByMonth = new Map<number, Set<string>>()
  for (const expense of data.expenses) {
    const i = index(expense)
    const entry = groupedAll.get(i) ?? { total: 0n, paid: 0n, open: 0n, invoice_count: 0 }
    const amount = cents(expense.amount)
    entry.total += amount
    if (expense.paid) entry.paid += amount
    else entry.open += amount
    entry.invoice_count++
    groupedAll.set(i, entry)
    const recorded = recordedByMonth.get(i) ?? new Set<string>()
    recorded.add(expense.card_id)
    recordedByMonth.set(i, recorded)
  }
  const timelineStart = index(start)
  const timelineEnd = Math.max(index(end), timelineStart)
  const timeline = Array.from({ length: timelineEnd - timelineStart + 1 }, (_, offset) => {
    const p = period(timelineStart + offset)
    const aggregate = groupedAll.get(index(p)) ?? { total: 0n, paid: 0n, open: 0n, invoice_count: 0 }
    const eligibleCards = data.cards.filter(card => card.created_year == null || card.created_month == null || index({ year: card.created_year, month: card.created_month }) <= index(p))
    const recorded = recordedByMonth.get(index(p)) ?? new Set<string>()
    return {
      ...p,
      total: money(aggregate.total),
      paid: money(aggregate.paid),
      open: money(aggregate.open),
      invoice_count: aggregate.invoice_count,
      missing_count: eligibleCards.filter(card => !recorded.has(card.id)).length,
    }
  })
  if (months.some(p => index(p) < index(start))) return { months, timeline, projection: { ...base, status: 'past_due' as const } }
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
  if (missingBalance || missingMonths.length) return { months, timeline, projection: { ...base, status: 'incomplete' as const, missingBalance, missingMonths } }

  const openingBalance = cents(opening!)
  const fixedBills = cents(data.fixed_total) * BigInt(index(end) - index(start) + 1)
  return { months, timeline, projection: {
    ...base, status: 'ready' as const,
    opening_balance: money(openingBalance), income: money(income), fixed_bills: money(fixedBills), card_expenses: money(cardExpenses),
    balance: money(openingBalance + income - fixedBills - cardExpenses),
  } }
}
