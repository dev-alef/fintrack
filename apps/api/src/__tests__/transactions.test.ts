import request from 'supertest'
import app from '../index'

describe('Transactions endpoints', () => {
  let token: string

  beforeAll(async () => {
    const email = `tx_${Date.now()}@teste.com`
    await request(app).post('/auth/register').send({ name: 'TX User', email, password: '123456' })
    const res = await request(app).post('/auth/login').send({ email, password: '123456' })
    token = res.body.accessToken
  })

  it('GET /transactions — sem token deve retornar 401', async () => {
    const res = await request(app).get('/transactions')
    expect(res.status).toBe(401)
  })

  it('POST /transactions — deve criar transação', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Salário', amount: 2000, type: 'income', date: '2024-06-01' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Salário')
    expect(res.body.type).toBe('income')
  })

  it('GET /transactions — deve listar transações', async () => {
    const res = await request(app)
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.pagination).toBeDefined()
  })

  it('POST /transactions — dados inválidos deve retornar 400', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', amount: -100, type: 'invalido', date: '' })
    expect(res.status).toBe(400)
  })

  it('GET /transactions/summary — deve retornar resumo', async () => {
    const res = await request(app)
      .get('/transactions/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.totals).toBeDefined()
  })
})
