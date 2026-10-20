import { describe,it,expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { conversationState, nextQuestion, emptyDraft, type Item } from '../services/onboarding-domain'
const item=(kind:Item['kind'],fields:Item['fields']):Item=>({id:randomUUID(),kind,fields,action:'pending',duplicate_ack:false})
const config=()=>item('config',{month:1,year:2031,balance:0,estimated_income:0})
const draft=()=>({...emptyDraft(),month:1,year:2031,conversation_started:true})
describe('Conversa inicial',()=>{
  it('pede só o que falta e não trata saldo zero como ausente',()=>{
    const d={...draft(),items:[item('config',{month:1,year:2031,balance:0})]}
    expect(conversationState(d).ready).toBe(false);expect(nextQuestion(d)).toContain('receita estimada');expect(nextQuestion(d)).not.toContain(': Saldo Atual')
    d.items[0].fields.estimated_income=0;expect(conversationState(d)).toMatchObject({ready:true,next_step:'bill'})
  })
  it('aproveita vários dados na mesma resposta e pula blocos já completos',()=>{
    const d={...draft(),items:[config(),item('bill',{name:'Internet',amount:120,due_day:10,recurring:true})]}
    expect(conversationState(d).next_step).toBe('card')
    d.items[1].fields.recurring=false;expect(conversationState(d).next_step).toBe('bill')
  })
  it('não exige saldo base de meses futuros nem confunde eles com o mês atual',()=>{
    const d={...draft(),items:[config(),item('config',{month:2,year:2031,estimated_income:1000})]}
    expect(conversationState(d).ready).toBe(true)
    d.items.shift();expect(conversationState(d).ready).toBe(false)
  })
  it('pergunta sobre a fatura conhecida sem inventar valor e permite pular',()=>{
    const card=item('card',{name:'Principal',due_day:10});const d={...draft(),step:'card' as const,items:[card]}
    expect(nextQuestion(d)).toContain('Fatura de Principal')
    d.items.push(item('invoice',{card_ref:card.id,month:1,year:2031,amount:0}));expect(conversationState(d).ready).toBe(true)
    expect(conversationState({...d,items:[card],skipped:['card']})).toMatchObject({ready:true,next_step:'loan'})
  })
  it('perfil profissional não pergunta finanças pessoais e respeita ausência declarada',()=>{
    const d={...draft(),profile:'professional' as const,step:'client' as const,items:[item('client',{name:'Ana'})],absent:['subscription','expense'] as Item['kind'][]}
    expect(conversationState(d)).toMatchObject({ready:true,next_step:'review'})
  })
})
