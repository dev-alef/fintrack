export interface Subscription {
  id: string; client_id: string; client_name: string; service_name: string; amount: string
  interval_months: number; start_date: string; end_date: string | null; notes: string
}
export interface Receipt {
  id: string; subscription_id: string; due_on: string; paid_on: string; amount: string
  client_name: string; service_name: string; notes: string; voided_at: string | null
}
export interface BusinessExpense { id: string; title: string; category: string; amount: string; spent_on: string; notes: string }
export function businessToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
const cents = (value: string) => {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
const money = (value: bigint): string => {
  const abs = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`
}
const total = (rows: { amount: string }[]) => rows.reduce((sum, row) => sum + cents(row.amount), 0n)

// Anchor every recurrence to the original day. January 31 -> February 28 -> March 31.
export function dueInMonth(subscription: Pick<Subscription, 'start_date' | 'end_date' | 'interval_months'>, year: number, month: number) {
  const offset = year * 12 + month - 1 - monthIndex(subscription.start_date)
  if (offset < 0 || offset % subscription.interval_months !== 0) return null
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(Number(subscription.start_date.slice(8, 10)), lastDay)
  const due = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return subscription.end_date && due > subscription.end_date ? null : due
}

export function summarizeBusiness(subscriptions: Subscription[], receipts: Receipt[], expenses: BusinessExpense[], year: number, month: number, today = businessToday()) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const paid = new Map(receipts.filter(r => !r.voided_at).map(r => [`${r.subscription_id}:${r.due_on}`, r]))
  const dues: Array<{ subscription_id: string; client_name: string; service_name: string; amount: string; due_on: string; receipt_id: string | null; status: 'received' | 'overdue' | 'pending' }> = []
  const previous: typeof dues = []
  for (const sub of subscriptions) {
    const selected = year * 12 + month - 1
    for (let i = monthIndex(sub.start_date); i <= selected; i += sub.interval_months) {
      const due = dueInMonth(sub, Math.floor(i / 12), i % 12 + 1)
      if (!due) break
      const receipt = paid.get(`${sub.id}:${due}`)
      const entry = { subscription_id: sub.id, client_name: sub.client_name, service_name: sub.service_name, amount: sub.amount, due_on: due, receipt_id: receipt?.id ?? null, status: receipt ? 'received' as const : due < today ? 'overdue' as const : 'pending' as const }
      if (i === selected) dues.push(entry)
      else if (!receipt && due < today) previous.push(entry)
    }
  }
  const received = receipts.filter(r => !r.voided_at && r.paid_on.startsWith(prefix))
  const monthlyExpenses = expenses.filter(e => e.spent_on.startsWith(prefix))
  const active = subscriptions.filter(s => s.start_date <= today && (!s.end_date || s.end_date >= today))
  const mrrTwelfths = active.reduce((sum, s) => sum + cents(s.amount) * BigInt(12 / s.interval_months), 0n)
  const sort = (a: { due_on: string }, b: { due_on: string }) => a.due_on.localeCompare(b.due_on)
  return {
    dues: dues.sort(sort), previous: previous.sort(sort),
    receipts: receipts.filter(r => r.paid_on.startsWith(prefix)), expenses: monthlyExpenses,
    totals: { expected: money(total(dues)), received: money(total(received)), expenses: money(total(monthlyExpenses)), result: money(total(received) - total(monthlyExpenses)), pending: money(total(dues.filter(d => d.status !== 'received'))), overdue: money(total([...previous, ...dues.filter(d => d.status === 'overdue')])), monthly_recurring: money((mrrTwelfths + 6n) / 12n), active_subscriptions: active.length },
  }
}
