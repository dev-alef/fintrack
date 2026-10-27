import { describe, expect, it } from 'vitest'
import { forecastCash } from '@/lib/cash-forecast'
describe('Saldo acumulado até dezembro', () => {
  const months = [{month:10,income:1000,fixedBills:100,invoices:200},{month:11,income:0,fixedBills:100,invoices:200},{month:12,income:1000,fixedBills:100,invoices:200}]
  it('soma o saldo uma vez e carrega sobras, incluindo zero e negativos', () => {
    const r=forecastCash(500,10,months)
    expect(r.months.map(m=>m.balance)).toEqual([1200,900,1600])
    expect(r.balance).toBe(1600)
    expect(forecastCash(-2000,10,months).balance).toBe(-900)
  })
  it('alterar saldo repercute em todos os meses seguintes', () => {
    expect(forecastCash(700,10,months).months.map(m=>m.balance)).toEqual([1400,1100,1800])
  })
  it('não inventa zero ao faltar receita, fatura ou saldo', () => {
    expect(forecastCash(null,10,months).balance).toBeNull()
    expect(forecastCash(500,10,months.map(m=>m.month===11?{...m,income:null}:m)).months.map(m=>m.balance)).toEqual([1200,null,null])
    expect(forecastCash(500,10,months.map(m=>({...m,invoices:null}))).balance).toBeNull()
  })
  it('mantém centavos exatos e conta só o período selecionado', () => {
    expect(forecastCash(0.1,12,[{month:11,income:999,fixedBills:0,invoices:0},{month:12,income:0.2,fixedBills:0,invoices:0}]).balance).toBe(0.3)
  })
})
