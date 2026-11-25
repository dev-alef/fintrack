import { randomUUID } from 'node:crypto'
import { describe,it,expect,vi } from 'vitest'
import request from 'supertest'
import { GoogleGenerativeAI } from '@google/generative-ai'
import app from '../index'
import pool from '../db/client'
import { type Draft, type Item, emptyDraft } from '../services/onboarding-domain'
import { mergeExtraction, focusedReply } from '../services/onboarding-ai'
const ORIGIN='http://localhost:5173'
async function account() {
  const r=await request(app).post('/api/auth/sign-up/email').set('Origin',ORIGIN).send({name:'Configuração',email:`onboarding_${randomUUID()}@example.test`,password:'TestOnlyPassword123!'})
  expect(r.status).toBe(200)
  const cookie=r.headers['set-cookie'] as unknown as string[]
  const initial=await request(app).get('/onboarding').set('Cookie',cookie);expect(initial.status).toBe(200)
  return {cookie,uid:r.body.user.id as string,version:initial.body.version as number}
}
const item=(kind:Item['kind'],fields:Item['fields'],action:Item['action']='create'):Item=>({id:randomUUID(),kind,fields,action,duplicate_ack:false})
async function save(a:Awaited<ReturnType<typeof account>>,items:Item[],extra:Partial<Draft>={}) {
  const r=await request(app).put('/onboarding').set('Cookie',a.cookie).send({version:a.version,data:{...emptyDraft(),items,...extra}})
  expect(r.status).toBe(200);a.version=r.body.version;return r.body
}
async function preview(a:Awaited<ReturnType<typeof account>>) {
  const r=await request(app).post('/onboarding/preview').set('Cookie',a.cookie).send({version:a.version});expect(r.status).toBe(200);return r.body
}
const payload=(p:any)=>({version:p.version,token:p.token,reference_period:p.reference_period,request_id:randomUUID()})
async function counts(uid:string) {
  const r=await pool.query(`SELECT (SELECT count(*)::int FROM credit_cards WHERE user_id=$1) cards,(SELECT count(*)::int FROM monthly_config WHERE user_id=$1) configs,(SELECT count(*)::int FROM professional_clients WHERE user_id=$1) clients,(SELECT count(*)::int FROM service_subscriptions WHERE user_id=$1) subscriptions,(SELECT count(*)::int FROM professional_expenses WHERE user_id=$1) expenses,(SELECT count(*)::int FROM professional_receipts r JOIN service_subscriptions s ON s.id=r.subscription_id WHERE s.user_id=$1) receipts`,[uid]);return r.rows[0]
}
describe('Assistente inicial',()=>{
  it('completa respostas curtas informais sem repetir a pergunta nem criar cadastros',async()=>{
    const a=await account()
    const bills=[item('bill',{name:'Registro.br',amount:40,due_day:10},'pending'),item('bill',{name:'E-mail',amount:30,recurring:true},'pending')]
    await save(a,bills,{conversation_started:true,step:'bill',profile:'personal'})
    const spy=vi.spyOn(GoogleGenerativeAI.prototype,'getGenerativeModel')
    try{
      const first=await request(app).post('/onboarding/answer').set('Cookie',a.cookie).send({version:a.version,text:'sim mano, todo mês',consent:true})
      expect(first.status).toBe(200)
      expect(first.body.data.items[0].fields.recurring).toBe(true)
      expect(first.body.question).toContain('E-mail');expect(first.body.question).not.toContain('Registro.br')
      const second=await request(app).post('/onboarding/answer').set('Cookie',a.cookie).send({version:first.body.version,text:'dia 5 kkk',consent:true})
      expect(second.status).toBe(200)
      expect(second.body.data).toMatchObject({step:'card',items:[{id:bills[0].id,action:'pending'},{id:bills[1].id,fields:{due_day:5},action:'pending'}]})
      expect(spy).not.toHaveBeenCalled()
      expect((await pool.query('SELECT count(*)::int AS n FROM fixed_bills WHERE user_id=$1',[a.uid])).rows[0].n).toBe(0)
    }finally{spy.mockRestore()}
  })
  it('envia a pergunta e o alvo à IA e avisa quando a resposta não altera o rascunho',async()=>{
    const a=await account(),bill=item('bill',{name:'Registro.br',amount:40,due_day:10},'pending')
    const before=await save(a,[bill],{conversation_started:true,step:'bill',profile:'personal'})
    vi.stubEnv('GEMINI_API_KEY','fake-key-never-sent')
    const generateContent=vi.fn(async()=>({response:{text:()=>JSON.stringify({items:[]})}}))
    const spy=vi.spyOn(GoogleGenerativeAI.prototype,'getGenerativeModel').mockReturnValue({generateContent} as any)
    try{
      const response=await request(app).post('/onboarding/answer').set('Cookie',a.cookie).send({version:a.version,text:'essa aí, tipo, acho q depende',consent:true})
      expect(response.status).toBe(200);expect(response.body.answer_applied).toBe(false)
      expect(response.body.answer_notice).toContain('Não consegui identificar')
      expect(response.body.version).toBe(a.version);expect(response.body.data).toEqual(before.data)
      const input=JSON.parse((generateContent.mock.calls[0] as unknown as [string])[0])
      expect(input.question).toBe('Registro.br se repete todo mês?')
      expect(input.focus).toMatchObject({item_id:bill.id,kind:'bill',field:'recurring'})
      expect(input.candidates).toHaveLength(1)
    }finally{spy.mockRestore();vi.unstubAllEnvs()}
  })
  it('oferece só itens completos e inequívocos para seleção explícita e permite concluir com pendências',async()=>{
    const a=await account(),card=item('card',{name:'Cartão',due_day:10},'pending')
    const invoice=item('invoice',{card_ref:card.id,month:1,year:2031,amount:100},'pending')
    const loan=item('loan',{person:'Ana',direction:'payable',amount:300},'pending')
    const bill=item('bill',{name:'E-mail',amount:50},'pending')
    const skipped=item('bill',{name:'Internet',amount:120,due_day:5,recurring:true},'pending')
    await save(a,[card,invoice,loan,bill,skipped],{step:'review',skipped:['bill']})
    const p=await preview(a)
    expect(p.can_commit).toBe(false);expect(p.pending_count).toBe(5)
    expect(p.ready_ids.sort()).toEqual([card.id,invoice.id,loan.id].sort())
    expect(p.rows.find((r:Item)=>r.id===bill.id).selection_issues).toContain('Confira dia de vencimento.')
    await save(a,[card,invoice,loan,bill,skipped].map(i=>p.ready_ids.includes(i.id)?{...i,action:'create'}:i),{step:'review',skipped:['bill']})
    const selected=await preview(a);expect(selected.can_commit).toBe(true)
    const result=await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(selected))
    expect(result.status).toBe(200);expect(result.body).toMatchObject({created:3,pending:2})
    expect((await request(app).get('/onboarding').set('Cookie',a.cookie)).body.data.items.map((i:Item)=>i.id).sort()).toEqual([bill.id,skipped.id].sort())
  })
  it('não seleciona em lote duplicatas nem dependentes com pai incompleto',async()=>{
    const a=await account(),card=item('card',{name:'Cartão'},'pending')
    const invoice=item('invoice',{card_ref:card.id,month:1,year:2031,amount:100},'pending')
    await save(a,[card,invoice,item('loan',{person:'Ana',direction:'payable',amount:300},'pending'),item('loan',{person:'Ana',direction:'payable',amount:300},'pending'),item('config',{month:1,year:2031,balance:0},'pending'),item('config',{month:1,year:2031,balance:100},'pending')])
    const p=await preview(a);expect(p.ready_ids).toEqual([]);expect(p.can_commit).toBe(false)
  })
  it('considera pais pendentes que serão reutilizados ao identificar duplicatas',async()=>{
    const a=await account()
    const existingCard=await request(app).post('/finance/cards').set('Cookie',a.cookie).send({name:'Existente',due_day:10})
    await request(app).post('/finance/cards/expenses').set('Cookie',a.cookie).send({cardId:existingCard.body.id,month:1,year:2031,amount:100}).expect(200)
    const card={...item('card',{name:'Existente',due_day:10},'pending'),existing_id:existingCard.body.id}
    const alias={...card,id:randomUUID()}
    const invoice=item('invoice',{card_ref:card.id,month:1,year:2031,amount:100},'pending')
    const next=item('invoice',{card_ref:card.id,month:2,year:2031,amount:100},'pending')
    const duplicate=item('invoice',{card_ref:alias.id,month:2,year:2031,amount:100},'pending')
    const clientId=randomUUID()
    await request(app).post('/business/clients').set('Cookie',a.cookie).send({id:clientId,name:'Cliente'})
    await request(app).post('/business/subscriptions').set('Cookie',a.cookie).send({id:randomUUID(),client_id:clientId,service_name:'Site',amount:100,interval_months:1,start_date:'2031-01-01'})
    const client={...item('client',{name:'Cliente'},'pending'),existing_id:clientId}
    const sub=item('subscription',{client_ref:client.id,service_name:'Site',amount:100,interval_months:1,start_date:'2031-01-01'},'pending')
    await save(a,[card,alias,invoice,next,duplicate,client,sub])
    const p=await preview(a)
    expect(p.ready_ids.sort()).toEqual([card.id,alias.id,client.id].sort())
    expect(p.rows.find((r:Item)=>r.id===invoice.id).matches).toHaveLength(1)
    expect(p.rows.find((r:Item)=>r.id===sub.id).matches).toHaveLength(1)
    expect(p.rows.find((r:Item)=>r.id===next.id).selection_issues).toContain('Este período aparece duas vezes no rascunho.')
  })
  it('exige sessão, preserva rascunho sem cadastrar e confirma pessoal/profissional atomicamente',async()=>{
    expect((await request(app).get('/onboarding')).status).toBe(401)
    const a=await account();const card=item('card',{name:'Cartão',due_day:10});const client=item('client',{name:'Cliente'})
    const items=[item('config',{month:1,year:2031,balance:800,estimated_income:3000}),item('bill',{name:'Internet',amount:120,due_day:10,recurring:true}),card,item('invoice',{card_ref:card.id,month:1,year:2031,amount:0}),item('loan',{person:'Pessoa',direction:'payable',amount:75}),client,item('subscription',{client_ref:client.id,service_name:'Suporte',amount:100,interval_months:1,start_date:'2031-01-31'}),item('expense',{title:'Domínio',amount:10,spent_on:'2026-01-01'})]
    await save(a,items);expect(await counts(a.uid)).toMatchObject({cards:0,configs:0,clients:0,subscriptions:0,expenses:0})
    const p=await preview(a);expect(p.can_commit).toBe(true)
    const req=payload(p);const r=await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(req);expect(r.status).toBe(200);expect(r.body.created).toBe(8)
    expect(await counts(a.uid)).toEqual({cards:1,configs:1,clients:1,subscriptions:1,expenses:1,receipts:0})
    const replay=await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(req);expect(replay.body).toEqual(r.body)
    const overview=await request(app).get('/business?year=2031&month=2').set('Cookie',a.cookie);expect(JSON.stringify(overview.body)).toContain('2031-02-28')
    expect((await pool.query('SELECT balance::text FROM monthly_config WHERE user_id=$1',[a.uid])).rows[0].balance).toBe('800.00')
  })
  it('bloqueia versão velha e confirmação depois de mudança em outra aba',async()=>{
    const a=await account();await save(a,[item('card',{name:'A',due_day:10})]);const p=await preview(a)
    expect((await request(app).put('/onboarding').set('Cookie',a.cookie).send({version:1,data:emptyDraft()})).status).toBe(409)
    await request(app).post('/finance/cards').set('Cookie',a.cookie).send({name:'A',due_day:15})
    expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))).status).toBe(409)
    expect((await counts(a.uid)).cards).toBe(1)
    expect((await preview(a)).can_commit).toBe(false)
  })
  it('isola contas e não permite usar cliente alheio',async()=>{
    const a=await account(),b=await account();const clientId=randomUUID()
    await request(app).post('/business/clients').set('Cookie',b.cookie).send({id:clientId,name:'Cliente secreto'})
    const client={...item('client',{name:'Cliente'}),'action':'reuse' as const,existing_id:clientId}
    await save(a,[client,item('subscription',{client_ref:client.id,service_name:'S',amount:1,interval_months:1,start_date:'2031-01-01'})])
    const p=await preview(a);expect(p.can_commit).toBe(false);expect(JSON.stringify(p)).not.toContain('Cliente secreto')
    expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))).status).toBe(400)
    expect((await counts(a.uid)).subscriptions).toBe(0)
  })
  it('salva somente os itens incluídos e preserva vínculo do dependente incompleto',async()=>{
    const a=await account();const client=item('client',{name:'Ana'}),sub=item('subscription',{client_ref:client.id,service_name:'Site'},'pending')
    await save(a,[client,sub],{profile:'professional'});const p=await preview(a)
    expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))).status).toBe(200)
    const draft=(await request(app).get('/onboarding').set('Cookie',a.cookie)).body;a.version=draft.version
    expect(draft.data.items.find((i:Item)=>i.id===client.id).action).toBe('reuse')
    expect(draft.data.items.find((i:Item)=>i.id===sub.id).action).toBe('pending')
    draft.data.items.find((i:Item)=>i.id===sub.id).fields={...sub.fields,amount:50,interval_months:3,start_date:'2031-01-31'}
    draft.data.items.find((i:Item)=>i.id===sub.id).action='create'
    await save(a,draft.data.items,{profile:'professional'});const p2=await preview(a)
    expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p2))).status).toBe(200)
    expect(await counts(a.uid)).toMatchObject({clients:1,subscriptions:1,configs:0})
  })
  it('reutiliza cadastros sem substituir os valores e distingue ausente de zero',async()=>{
    const a=await account();await request(app).post('/finance/config').set('Cookie',a.cookie).send({month:1,year:2031,balance:100,estimated_income:1000})
    const config=item('config',{month:1,year:2031,balance:0,estimated_income:0});await save(a,[config]);let p=await preview(a);expect(p.can_commit).toBe(false)
    config.action='reuse';config.existing_id=p.rows[0].matches[0].id
    await save(a,[config]);p=await preview(a);expect(p.rows[0].fields.balance).toBe('100.00');expect(p.can_commit).toBe(true)
    await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))
    expect((await pool.query('SELECT balance::text FROM monthly_config WHERE user_id=$1',[a.uid])).rows[0].balance).toBe('100.00')
    const d=(await request(app).get('/onboarding').set('Cookie',a.cookie)).body;a.version=d.version
    await save(a,[item('config',{month:2,year:2031,balance:0})]);p=await preview(a)
    await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))
    expect((await pool.query('SELECT balance::text,estimated_income FROM monthly_config WHERE user_id=$1 AND month=2',[a.uid])).rows[0]).toEqual({balance:'0.00',estimated_income:null})
  })
  it('rollback completo quando uma escrita falha após o primeiro item',async()=>{
    const a=await account();await save(a,[item('config',{month:1,year:2031,balance:100}),item('card',{name:'rollback-trigger',due_day:10})]);const p=await preview(a)
    // A test-only trigger forces an actual DB error after the first insert.
    await pool.query(`CREATE FUNCTION reject_onboarding_test_card() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='rollback-trigger' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_onboarding_test_card BEFORE INSERT ON credit_cards FOR EACH ROW EXECUTE FUNCTION reject_onboarding_test_card()`)
    try {expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))).status).toBe(500);expect(await counts(a.uid)).toMatchObject({configs:0,cards:0})}
    finally {await pool.query('DROP TRIGGER reject_onboarding_test_card ON credit_cards; DROP FUNCTION reject_onboarding_test_card()')}
    expect((await preview(a)).version).toBe(a.version)
  })
  it('duas confirmações concorrentes não criam dois cartões',async()=>{
    const a=await account();await save(a,[item('card',{name:'Único',due_day:1})]);const p=await preview(a);const body=payload(p)
    const rr=await Promise.all([1,2].map(()=>request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(body)))
    expect(rr.map(r=>r.status)).toEqual([200,200]);expect((await counts(a.uid)).cards).toBe(1)
  })
  it('expiração e descarte não apagam cadastros; sem IA mantém modo guiado',async()=>{
    const a=await account();await save(a,[item('card',{name:'Rascunho',due_day:1})]);await pool.query("UPDATE onboarding_drafts SET updated_at=now()-interval '31 days' WHERE user_id=$1",[a.uid])
    const d=(await request(app).get('/onboarding').set('Cookie',a.cookie)).body;expect(d.data.items).toEqual([]);expect(d.version).toBeGreaterThan(a.version)
    vi.stubEnv('GEMINI_API_KEY','')
    try {expect((await request(app).post('/onboarding/answer').set('Cookie',a.cookie).send({version:d.version,text:'Tenho 100',consent:true})).status).toBe(503)}finally{vi.unstubAllEnvs()}
    expect((await counts(a.uid)).cards).toBe(0)
  })
  it('avisa duplicatas dentro do próprio rascunho e bloqueia perfil errado',async()=>{
    const a=await account();await save(a,[item('card',{name:' A ',due_day:1}),item('card',{name:'a',due_day:2})]);expect((await preview(a)).can_commit).toBe(false)
    await save(a,[item('card',{name:'A',due_day:1})],{profile:'professional'});expect((await preview(a)).can_commit).toBe(false)
  })
  it('revisão de existentes mostra saldo restante e vínculos reais, e detecta pagamento posterior',async()=>{
    const a=await account()
    const loan=await request(app).post('/loans').set('Cookie',a.cookie).send({person:'Ana',direction:'payable',amount:1000})
    expect(loan.status).toBe(201)
    const pay=()=>request(app).post(`/loans/${loan.body.id}/payments`).set('Cookie',a.cookie).send({id:randomUUID(),amount:100,paid_on:'2026-01-01'})
    expect((await pay()).status).toBe(201)
    const card=await request(app).post('/finance/cards').set('Cookie',a.cookie).send({name:'Cartão real',due_day:10})
    await request(app).post('/finance/cards/expenses').set('Cookie',a.cookie).send({cardId:card.body.id,month:1,year:2031,amount:200}).expect(200)
    const clientId=randomUUID()
    await request(app).post('/business/clients').set('Cookie',a.cookie).send({id:clientId,name:'Cliente real'})
    await request(app).post('/business/subscriptions').set('Cookie',a.cookie).send({id:randomUUID(),client_id:clientId,service_name:'Site',amount:100,interval_months:1,start_date:'2031-01-01'})
    const existing=(await request(app).get('/onboarding').set('Cookie',a.cookie)).body.existing
    const reuse=(kind:Item['kind'])=>({...item(kind,{}),'action':'reuse' as const,existing_id:existing[kind][0].id})
    await save(a,[reuse('loan'),reuse('invoice'),reuse('subscription')])
    const p=await preview(a);expect(p.can_commit).toBe(true)
    expect(p.rows.map((r:any)=>r.fields)).toMatchObject([{amount:'900.00'},{card_name:'Cartão real'},{client_name:'Cliente real'}])
    expect((await pay()).status).toBe(201)
    expect((await request(app).post('/onboarding/commit').set('Cookie',a.cookie).send(payload(p))).status).toBe(409)
    expect((await preview(a)).rows[0].fields.amount).toBe('800.00')
  })
  it('IA via HTTP requer consentimento, só altera rascunho e preserva dados quando provedor falha',async()=>{
    const a=await account()
    vi.stubEnv('GEMINI_API_KEY','fake-key-never-sent')
    const generateContent=vi.fn(async(input:string)=>{
      const data=JSON.parse(input)
      return {response:{text:()=>JSON.stringify({items:[{id:data.newIds[0],kind:'config',fields:[{key:'month',value:String(data.reference.month)},{key:'year',value:String(data.reference.year)},{key:'balance',value:'0'},{key:'estimated_income',value:'3000'}]}]})}}
    })
    const spy=vi.spyOn(GoogleGenerativeAI.prototype,'getGenerativeModel').mockReturnValue({generateContent} as any)
    const send=(version:number,consent=true)=>request(app).post('/onboarding/answer').set('Cookie',a.cookie).send({version,text:'Saldo zero e recebo três mil',consent})
    try {
      expect((await send(a.version,false)).status).toBe(400);expect(generateContent).not.toHaveBeenCalled()
      const good=await send(a.version);expect(good.status).toBe(200)
      expect(good.body.data.items[0]).toMatchObject({action:'pending',fields:{balance:0,estimated_income:3000}})
      expect(await counts(a.uid)).toMatchObject({configs:0,cards:0})
      generateContent.mockRejectedValueOnce(new Error('provider unavailable'))
      expect((await send(good.body.version)).status).toBe(503)
      const saved=(await request(app).get('/onboarding').set('Cookie',a.cookie)).body
      expect(saved.version).toBe(good.body.version);expect(saved.data).toEqual(good.body.data)
      await pool.query('UPDATE onboarding_drafts SET ai_calls=30 WHERE user_id=$1',[a.uid])
      expect((await send(saved.version)).status).toBe(429)
      expect(generateContent).toHaveBeenCalledTimes(2)
    } finally {spy.mockRestore();vi.unstubAllEnvs()}
  })
  it('endpoint dos três meses é autenticado e isolado',async()=>{
    const a=await account(),b=await account();for(const month of [9,10,11,12])await request(app).post('/finance/config').set('Cookie',a.cookie).send({month,year:2031,balance:100,estimated_income:1000})
    expect((await request(app).get('/finance/forecast/three-months?month=9&year=2031')).status).toBe(401)
    const own=await request(app).get('/finance/forecast/three-months?month=9&year=2031').set('Cookie',a.cookie);expect(own.body.months.map((m:any)=>m.balance)).toEqual(['2100.00','3100.00','4100.00'])
    const other=await request(app).get('/finance/forecast/three-months?month=9&year=2031').set('Cookie',b.cookie);expect(other.body.months.every((m:any)=>m.balance===null)).toBe(true)
    expect((await request(app).get('/finance/forecast/three-months?month=13&year=2031').set('Cookie',a.cookie)).status).toBe(400)
  })
})

describe('Extração da IA',()=>{
  it('não aplica resposta curta a outro campo nem transforma anual em mensal',()=>{
    const bill=item('bill',{name:'Domínio',amount:40,due_day:10},'pending')
    const draft={...emptyDraft(),step:'bill' as const,items:[bill]}
    expect(focusedReply(draft,'é anual mano')?.items[0].fields.recurring).toBe(false)
    expect(focusedReply(draft,'sim mas só no ano que vem')).toBeNull()
    expect(focusedReply(draft,'a internet sim, a do site não')).toBeNull()
    expect(focusedReply({...draft,step:'loan'},'sim')).toBeNull()
    expect(mergeExtraction(draft,{items:[{id:bill.id,kind:'bill',fields:[{key:'amount',value:'40'}]}]},[])).toEqual(draft)
  })
  it('extrai vários candidatos, preserva zero e não permite confirmar por IA',()=>{
    const ids=[randomUUID(),randomUUID()];const d=mergeExtraction(emptyDraft(),{items:[{id:ids[0],kind:'config',fields:[{key:'month',value:'1'},{key:'year',value:'2031'},{key:'balance',value:'0'},{key:'estimated_income',value:'3000'}]},{id:ids[1],kind:'bill',fields:[{key:'name',value:'Internet'},{key:'amount',value:'120'}]}]},ids)
    expect(d.items[0].fields.balance).toBe(0);expect(d.items[1].fields.due_day).toBeUndefined();expect(d.items.every(i=>i.action==='pending')).toBe(true)
  })
  it('recusa IDs inventados, campos de pagamento, vínculos externos e perfil errado',()=>{
    const id=randomUUID(), raw=(kind:string,fields:any[])=>({items:[{id,kind,fields}]})
    expect(()=>mergeExtraction(emptyDraft(),raw('card',[]),[])).toThrow()
    expect(()=>mergeExtraction(emptyDraft(),raw('invoice',[{key:'paid',value:'true'}]),[id])).toThrow()
    expect(()=>mergeExtraction(emptyDraft(),raw('invoice',[{key:'card_ref',value:randomUUID()}]),[id])).toThrow()
    expect(()=>mergeExtraction({...emptyDraft(),profile:'professional'},raw('config',[]),[id])).toThrow()
  })
})
