import { randomUUID } from 'crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../index'
import { query } from '../db/client'
import { businessToday } from '../services/business-calendar'
vi.mock('../email', () => ({ enviarEmail: vi.fn().mockResolvedValue(false) }))
type Account = { cookie: string[]; id: string }
let a: Account, b: Account
const users: string[] = []
const today = businessToday(), year = Number(today.slice(0,4)), month = Number(today.slice(5,7))
const call = (method: 'get'|'post'|'put'|'delete', path: string, account = a, body?: object) => {
  const req = request(app)[method](`/business${path}`).set('Cookie',account.cookie)
  return body === undefined ? req : req.send(body)
}
const overview = (account = a) => call('get',`?year=${year}&month=${month}`,account)
async function client(account = a) {
  const data = { id: randomUUID(), name: 'Cliente teste', contact: 'email@example.test', notes: '' }
  expect((await call('post','/clients',account,data)).status).toBe(201)
  return data
}
async function sub(account = a, overrides: Record<string, unknown> = {}) {
  const c = await client(account)
  const data = { id: randomUUID(), client_id: c.id, service_name: 'Suporte', amount: 100.10, interval_months: 1, start_date: today, notes: '', ...overrides }
  expect((await call('post','/subscriptions',account,data)).status).toBe(201)
  return data
}
const receive = (s: string, id = randomUUID(), account = a, overrides: Record<string, unknown> = {}) => call('post',`/subscriptions/${s}/receipts`,account,{ id, due_on: today, paid_on: today, notes: '', ...overrides })
beforeAll(async () => {
  const signup = async () => {
    const response = await request(app).post('/api/auth/sign-up/email').set('Origin','http://localhost:5173').send({ name: 'Profissional', email: `business-${randomUUID()}@example.test`, password: 'Teste123456!' })
    if (response.body.user?.id) users.push(response.body.user.id)
    expect(response.status).toBe(200)
    return { cookie: response.headers['set-cookie'] as unknown as string[], id: response.body.user.id }
  }
  a = await signup(); b = await signup()
})
afterAll(async () => { if (users.length) await query('DELETE FROM users WHERE id = ANY($1::uuid[])',[users]) })
describe('Controle profissional', () => {
  it('exige sessão, valida entradas e isola clientes/assinaturas/recebimentos/despesas', async () => {
    expect((await request(app).get('/business')).status).toBe(401)
    expect((await call('get','?year=2026&month=13')).status).toBe(400)
    expect((await call('post','/clients',a,{ id:randomUUID(), name:' ' })).status).toBe(400)
    const s = await sub()
    expect((await call('post','/subscriptions',b,{ ...s,id:randomUUID() })).status).toBe(404)
    expect((await call('put',`/subscriptions/${s.id}`,b,{ service_name: 'roubo', notes:'' })).status).toBe(404)
    expect((await receive(s.id,randomUUID(),b)).status).toBe(404)
    expect((await call('delete',`/clients/${s.client_id}`,b)).status).toBe(404)
    const other = (await overview(b)).body
    expect(other.clients).toEqual([]); expect(other.subscriptions).toEqual([]); expect(other.receipts).toEqual([])
    expect(other.totals.result).toBe('0.00')
  })
  it('repete criação com UUID estável e rejeita alteração de termos financeiros por edição', async () => {
    const c = await client()
    expect((await call('post','/clients',a,{ ...c,id:c.id.toUpperCase() })).status).toBe(201)
    expect((await call('post','/clients',a,c)).status).toBe(201)
    expect((await call('post','/clients',a,{ ...c,name:'Outro' })).status).toBe(409)
    const data = { id:randomUUID(),client_id:c.id,service_name:'Site',amount:90,interval_months:3,start_date:today,notes:'' }
    expect((await call('post','/subscriptions',a,data)).status).toBe(201)
    expect((await call('post','/subscriptions',a,data)).status).toBe(201)
    expect((await call('post','/subscriptions',a,{ ...data,amount:91 })).status).toBe(409)
    expect((await call('put',`/subscriptions/${data.id}`,a,{ service_name:'Site',amount:91 })).status).toBe(400)
  })
  it('protege recebimento contra resposta perdida, edição e quitações concorrentes', async () => {
    const s = await sub(), id = randomUUID()
    expect((await receive(s.id,id)).status).toBe(201)
    expect((await receive(s.id,id)).status).toBe(201)
    expect((await receive(s.id,id,a,{ notes:'edição após timeout' })).status).toBe(409)
    expect((await receive(s.id)).status).toBe(409)
    const another = await sub()
    const concurrent = await Promise.all([receive(another.id),receive(another.id)])
    expect(concurrent.map(r => r.status).sort()).toEqual([201,409])
    const listed = (await overview()).body
    expect(listed.receipts.filter((r: { subscription_id: string }) => r.subscription_id === s.id)).toHaveLength(1)
  })
  it('estorna com histórico e não ressuscita UUID estornado', async () => {
    const s = await sub(), id = randomUUID()
    await receive(s.id,id)
    expect((await call('delete',`/subscriptions/${s.id}/receipts/${id}`,b)).status).toBe(404)
    expect((await call('delete',`/subscriptions/${s.id}/receipts/${id}`)).status).toBe(204)
    expect((await receive(s.id,id)).status).toBe(409)
    expect((await receive(s.id)).status).toBe(201)
    const history = (await overview()).body.receipts.filter((r: { subscription_id: string }) => r.subscription_id === s.id)
    expect(history).toHaveLength(2)
    expect(history.filter((r: { voided_at: string | null }) => !r.voided_at)).toHaveLength(1)
  })
  it('preserva snapshots e impede apagar recebimentos ao antecipar encerramento', async () => {
    const s = await sub(), id = randomUUID()
    await receive(s.id,id)
    await call('put',`/clients/${s.client_id}`,a,{ name:'Nome novo',contact:'',notes:'' })
    await call('put',`/subscriptions/${s.id}`,a,{ service_name:'Serviço novo',notes:'' })
    const row = (await overview()).body.receipts.find((r: { id: string }) => r.id === id)
    expect(row.client_name).toBe('Cliente teste'); expect(row.service_name).toBe('Suporte')
    expect((await call('post',`/subscriptions/${s.id}/end`,a,{ end_date:'1900-01-01' })).status).toBe(409)
    expect((await call('post',`/subscriptions/${s.id}/end`,a,{ end_date:today })).status).toBe(200)
    expect((await call('post',`/subscriptions/${s.id}/end`,a,{ end_date:'2100-12-31' })).status).toBe(400)
    const future = await sub(a,{ start_date:'2100-12-31' })
    expect((await call('post',`/subscriptions/${future.id}/end`,a,{ end_date:today })).status).toBe(200)
    expect((await call('delete',`/clients/${future.client_id}`)).status).toBe(204)
    const december = (await call('get','?year=2100&month=12')).body
    expect(december.dues.some((d: { subscription_id: string }) => d.subscription_id === future.id)).toBe(false)
  })
  it('distingue antecipação de recebimento da data do vencimento e rejeita datas inválidas', async () => {
    const next = new Date(Date.UTC(year,month,1)).toISOString().slice(0,10)
    const s = await sub(b,{ start_date:next })
    expect((await receive(s.id,randomUUID(),b,{ due_on:today })).status).toBe(400)
    expect((await receive(s.id,randomUUID(),b,{ due_on:next,paid_on:'2100-12-31' })).status).toBe(400)
    expect((await receive(s.id,randomUUID(),b,{ due_on:next })).status).toBe(201)
    const cash = (await overview(b)).body
    expect(cash.totals.received).toBe('100.10'); expect(cash.dues).toEqual([])
    const future = (await call('get',`?year=${next.slice(0,4)}&month=${Number(next.slice(5,7))}`,b)).body
    expect(future.totals).toMatchObject({ expected:'100.10',received:'0.00',pending:'0.00' })
    expect(future.dues[0].status).toBe('received')
    expect((await call('delete',`/clients/${s.client_id}`,b)).status).toBe(409)
  })
  it('controla despesas reais, repetições e exclusão sem misturar com finanças pessoais', async () => {
    const input = { id:randomUUID(),title:'Hospedagem',category:'Ferramentas',amount:30.05,spent_on:today,notes:'' }
    expect((await call('post','/expenses',a,input)).status).toBe(201)
    expect((await call('post','/expenses',a,input)).status).toBe(201)
    expect((await call('put',`/expenses/${input.id}`,b,{ ...input,id:undefined })).status).toBe(404)
    expect((await call('delete',`/expenses/${input.id}`,b)).status).toBe(404)
    expect((await call('post','/expenses',a,{ ...input,id:randomUUID(),amount:0.001 })).status).toBe(400)
    expect((await call('post','/expenses',a,{ ...input,id:randomUUID(),spent_on:'2100-12-31' })).status).toBe(400)
    const data = (await overview()).body
    expect(data.totals.expenses).toBe('30.05')
    expect(Math.round(Number(data.totals.result) * 100)).toBe(Math.round(Number(data.totals.received) * 100) - 3005)
    const { id: expenseId, ...edited } = input
    expect((await call('put',`/expenses/${expenseId}`,a,{ ...edited,amount:40.10 })).status).toBe(200)
    expect((await overview()).body.totals.expenses).toBe('40.10')
    expect((await call('delete',`/expenses/${input.id}`)).status).toBe(204)
    expect((await call('post','/expenses',a,input)).status).toBe(409)
    const personal = await query('SELECT (SELECT count(*) FROM transactions WHERE user_id=$1)::int AS tx, (SELECT count(*) FROM monthly_config WHERE user_id=$1)::int AS config',[a.id])
    expect(personal.rows[0]).toEqual({ tx:0,config:0 })
  })
})
