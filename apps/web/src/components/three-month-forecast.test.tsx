import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {ThreeMonthForecastView,type Forecast} from './three-month-forecast'
const data:Forecast={start:{month:12,year:2031},current_balance:'100.00',months:[{month:1,year:2032,opening_balance:'100.00',income:'0.00',fixed_bills:'200.00',card_expenses:'0.00',balance:'-100.00',missing:[]}]}
describe('Previsão de três meses',()=>{
  it('mostra mês/ano, negativo e componentes sem barras',()=>{
    const html=renderToStaticMarkup(<ThreeMonthForecastView data={data}/>);expect(html).toContain('janeiro de 2032');expect(html).toContain('Previsão de saldo negativo');expect(html).toContain('Saldo previsto anterior');expect(html).toContain('uma única vez')
  })
  it('não exibe um valor calculado quando falta planejamento',()=>{
    const html=renderToStaticMarkup(<ThreeMonthForecastView data={{...data,months:[{...data.months[0],balance:null,missing:[{month:12,year:2031,fields:['Receita estimada']}]}]}}/>);expect(html).toContain('Planejamento incompleto');expect(html).toContain('dezembro de 2031: Receita estimada');expect(html).not.toContain('R$')
  })
})
