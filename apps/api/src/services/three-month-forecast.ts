import type { PayoffSnapshot, Period } from './payoff-projection'

export type ForecastSnapshot = Omit<PayoffSnapshot, 'configs'> & {
  configs: (Period & { balance: string | null; estimated_income: string | null })[]
}
const key = (p: Period) => p.year * 12 + p.month - 1
const period = (i: number): Period => ({ year: Math.floor(i / 12), month: i % 12 + 1 })
const cents = (v: string) => {
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) throw new Error('Invalid money')
  const [whole, fraction = ''] = v.replace('-', '').split('.')
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (v.startsWith('-') ? -1n : 1n)
}
const money = (v: bigint) => `${v < 0n ? '-' : ''}${(v < 0n ? -v : v) / 100n}.${String((v < 0n ? -v : v) % 100n).padStart(2, '0')}`

/** Anchor once in the selected month's current balance; future balances never accumulate. */
export function projectThreeMonths(data: ForecastSnapshot, start: Period) {
  const base = data.configs.find(c => key(c) === key(start))?.balance
  let balance: bigint | null = base == null ? null : cents(base)
  const missing: { year: number; month: number; fields: string[] }[] = []
  const fixed = data.fixed_bills.reduce((s, b) => s + cents(b.amount), 0n)
  const months = []
  for (let offset = 0; offset <= 3; offset++) {
    const p = period(key(start) + offset)
    const config = data.configs.find(c => key(c) === key(p))
    const expenses = data.expenses.filter(e => key(e) === key(p))
    const fields: string[] = []
    if (offset === 0 && base == null) fields.push('Saldo Atual')
    if (config?.estimated_income == null) fields.push('Receita estimada')
    for (const card of data.cards) {
      if (card.created_year != null && card.created_month != null && key({ year: card.created_year, month: card.created_month }) > key(p)) continue
      if (!expenses.some(e => e.card_id === card.id)) fields.push(`Fatura de ${card.name}`)
    }
    if (fields.length) { missing.push({ ...p, fields }); balance = null }
    const invoices = expenses.reduce((s, e) => s + cents(e.amount), 0n)
    const opening = balance
    if (balance !== null) balance += cents(config!.estimated_income!) - fixed - invoices
    if (offset > 0) months.push({ ...p, opening_balance: opening == null ? null : money(opening), income: config?.estimated_income ?? null,
      fixed_bills: money(fixed), card_expenses: money(invoices), balance: balance == null ? null : money(balance),
      missing: missing.map(m => ({ ...m, fields: [...m.fields] })) })
  }
  return { start, current_balance: base ?? null, months }
}
