import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index'

// A autenticacao passou a ser do Better Auth, com sessao em cookie httpOnly
// no lugar de tokens JWT. Estes testes exercitam os endpoints reais montados
// em /api/auth, e nao mais as rotas artesanais que existiam em /auth.
describe('Autenticacao (Better Auth)', () => {
  const user = {
    name: 'Teste',
    email: `teste_${Date.now()}@teste.com`,
    password: 'senhaDeTeste123',
  }

  it('cadastro cria usuario e devolve cookie de sessao', async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send(user)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(user.email)

    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    // A sessao nao pode ser legivel por JavaScript: e o que impede um XSS de
    // roubar o acesso, e foi a razao de sair do localStorage.
    expect(String(cookies)).toContain('HttpOnly')
  })

  it('cadastro com email repetido e recusado', async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send(user)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('login com a senha correta devolve sessao', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: user.email, password: user.password })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(user.email)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('login com senha errada e recusado', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: user.email, password: 'senhaErrada' })

    expect(res.status).toBe(401)
  })

  it('rota protegida sem sessao responde 401', async () => {
    const res = await request(app).get('/transactions')
    expect(res.status).toBe(401)
  })
})
