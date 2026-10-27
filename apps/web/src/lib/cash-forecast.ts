export type CashMonth = { month: number; income: number | null; fixedBills: number; invoices: number | null }
export function forecastCash(currentBalance: number | null, startMonth: number, months: CashMonth[]) {
  let balance = currentBalance == null ? null : Math.round(currentBalance * 100)
  const projected = months.filter(m => m.month >= startMonth).sort((a,b) => a.month-b.month).map(m => {
    const missing = [m.income == null ? 'receita estimada' : '', m.invoices == null ? 'faturas' : ''].filter(Boolean)
    const flow = missing.length ? null : Math.round(m.income! * 100) - Math.round(m.fixedBills * 100) - Math.round(m.invoices! * 100)
    balance = balance == null || flow == null ? null : balance + flow
    return {...m, missing, flow: flow == null ? null : flow / 100, balance: balance == null ? null : balance / 100}
  })
  return {currentBalance, months: projected, balance: projected.at(-1)?.balance ?? null}
}
export type CashForecast = ReturnType<typeof forecastCash>
