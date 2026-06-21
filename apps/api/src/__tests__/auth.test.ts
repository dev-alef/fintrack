import request from 'supertest'
import app from '../index'

describe('Auth endpoints', () => {
  const user = {
    name: 'Teste',
    email: `teste_${Date.now()}@teste.com`,
    password: '123456',
  }

  it('POST /auth/register — deve criar usuário', async () => {
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe(user.email)
  })

  it('POST /auth/register — email duplicado deve retornar erro', async () => {
    await request(app).post('/auth/register').send(user)
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('POST /auth/login — deve retornar tokens', async () => {
    const res = await request(app).post('/auth/login').send({
      email: user.email,
      password: user.password,
    })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  })

  it('POST /auth/login — senha errada deve retornar 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: user.email,
      password: 'senhaerrada',
    })
    expect(res.status).toBe(401)
  })

  it('GET /health — deve retornar ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
