import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../index'

// A autenticacao virou sessao em cookie, entao os testes deixam de anexar
// Authorization: Bearer e passam a reaproveitar o cookie devolvido no login,
// que e exatamente o que o navegador faz.
describe('Transacoes', () => {
  let cookie: string
  const user = {
    name: 'Teste Transacoes',
    email: `tx_${Date.now()}@teste.com`,
    password: 'senhaDeTeste123',
  }

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send(user)
    cookie = String(res.headers['set-cookie'])
  })

  it('sem sessao responde 401', async () => {
    const res = await request(app).get('/transactions')
    expect(res.status).toBe(401)
  })

  it('com sessao lista transacoes', async () => {
    const res = await request(app).get('/transactions').set('Cookie', cookie)
    expect(res.status).toBe(200)
  })

  it('cria uma transacao', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Cookie', cookie)
      .send({
        title: 'Compra de teste',
        amount: 42.5,
        type: 'expense',
        date: new Date().toISOString().slice(0, 10),
      })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Compra de teste')
  })

  it('recusa transacao invalida', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Cookie', cookie)
      .send({ title: '', amount: -1, type: 'invalido', date: 'nao-e-data' })

    expect(res.status).toBe(400)
  })
})
