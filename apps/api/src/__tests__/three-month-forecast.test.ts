import { describe,it,expect } from 'vitest'
import { projectThreeMonths,type ForecastSnapshot } from '../services/three-month-forecast'
function fixture():ForecastSnapshot {
  const periods=[{year:2031,month:11},{year:2031,month:12},{year:2032,month:1},{year:2032,month:2}]
  return {configs:periods.map((p,i)=>({...p,balance:i===0?'100.00':'9999.00',estimated_income:'1000.00'})),cards:[{id:'a',name:'Cartão',created_year:2030,created_month:1}],expenses:periods.map((p,i)=>({...p,card_id:'a',amount:String((4-i)*100)+'.00',paid:i===0})),fixed_bills:[{id:'b',amount:'200.00'}],bill_payments:[]}
}
describe('Previsão dos próximos três meses',()=>{
  it('carrega o saldo uma vez, incluindo o mês base e cruzando o ano',()=>{
    const r=projectThreeMonths(fixture(),{year:2031,month:11})
    expect(r.months.map(m=>[m.year,m.month,m.balance])).toEqual([[2031,12,'1000.00'],[2032,1,'1600.00'],[2032,2,'2300.00']])
    expect(r.months[0].opening_balance).toBe('500.00')
  })
  it('não inventa saldo quando falta fatura, e propaga a lacuna',()=>{
    const f=fixture();f.expenses.splice(2,1)
    const r=projectThreeMonths(f,{year:2031,month:11})
    expect(r.months.map(m=>m.balance)).toEqual(['1000.00',null,null])
    expect(r.months[2].missing).toEqual([{year:2032,month:1,fields:['Fatura de Cartão']}])
  })
  it('saldo e receita ausentes diferem de zero explícito',()=>{
    const f=fixture();f.configs[0].balance=null;f.configs[1].estimated_income=null
    expect(projectThreeMonths(f,{year:2031,month:11}).months.every(m=>m.balance===null)).toBe(true)
    f.configs[0].balance='0.00';f.configs[1].estimated_income='0.00'
    expect(projectThreeMonths(f,{year:2031,month:11}).months[0].balance).toBe('-100.00')
  })
  it('sem cartões ou contas, mantém centavos e não exige faturas inexistentes',()=>{
    const f=fixture();f.cards=[];f.expenses=[];f.fixed_bills=[];f.configs.forEach(c=>{c.estimated_income='0.01';c.balance='0.01'})
    expect(projectThreeMonths(f,{year:2031,month:11}).months.map(m=>m.balance)).toEqual(['0.03','0.04','0.05'])
  })
})
