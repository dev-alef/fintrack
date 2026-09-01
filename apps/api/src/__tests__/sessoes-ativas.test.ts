import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index'

const ORIGEM = 'http://localhost:5173'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1'
const NOTEBOOK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36'

async function contaComDoisAcessos() {
  const usuario = {
    name: 'Alef',
    email: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }

  const cadastro = await request(app)
    .post('/api/auth/sign-up/email')
    .set('User-Agent', NOTEBOOK)
    .send(usuario)
  const primeira = cadastro.headers['set-cookie'] as unknown as string[]

  const login = await request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGEM)
    .set('User-Agent', CELULAR)
    .send({ email: usuario.email, password: usuario.password })
  const segunda = login.headers['set-cookie'] as unknown as string[]

  return { usuario, primeira, segunda }
}

async function listaSessoes(cookie: string[]) {
  const res = await request(app).get('/api/auth/list-sessions').set('Cookie', cookie).set('Origin', ORIGEM)
  expect(res.status).toBe(200)
  return res.body as { token: string; userAgent?: string }[]
}

describe('Sessoes ativas', () => {
  it('lista os dispositivos conectados, com o user-agent de cada um', async () => {
    const { primeira } = await contaComDoisAcessos()

    const sessoes = await listaSessoes(primeira)

    expect(sessoes.length).toBeGreaterThanOrEqual(2)
    // Sem o user-agent a lista seria uma sequencia de datas indistinguiveis, e
    // a pessoa nao teria como decidir qual acesso nao e dela.
    const agentes = sessoes.map((s) => s.userAgent ?? '')
    expect(agentes.some((a) => a.includes('iPhone'))).toBe(true)
    expect(agentes.some((a) => a.includes('Windows'))).toBe(true)
  })

  it('encerrar uma sessao mata o acesso dela, nao so some da lista', async () => {
    const { primeira, segunda } = await contaComDoisAcessos()

    const sessoes = await listaSessoes(primeira)
    const doCelular = sessoes.find((s) => (s.userAgent ?? '').includes('iPhone'))!

    const revoga = await request(app)
      .post('/api/auth/revoke-session')
      .set('Cookie', primeira)
      .set('Origin', ORIGEM)
      .send({ token: doCelular.token })
    expect(revoga.status).toBe(200)

    // O ponto da tela inteira. Se o cookie revogado continuasse valendo, a
    // pessoa acharia ter expulsado o invasor e ele seguiria dentro.
    const comRevogada = await request(app).get('/transactions').set('Cookie', segunda)
    expect(comRevogada.status).toBe(401)

    // E quem revogou nao pode ter se derrubado junto.
    const aindaDentro = await request(app).get('/transactions').set('Cookie', primeira)
    expect(aindaDentro.status).toBe(200)
  })

  it('encerrar as outras preserva a sessao de quem pediu', async () => {
    const { primeira, segunda } = await contaComDoisAcessos()

    const res = await request(app)
      .post('/api/auth/revoke-other-sessions')
      .set('Cookie', primeira)
      .set('Origin', ORIGEM)
      .send({})
    expect(res.status).toBe(200)

    expect((await request(app).get('/transactions').set('Cookie', segunda)).status).toBe(401)
    expect((await request(app).get('/transactions').set('Cookie', primeira)).status).toBe(200)

    const restantes = await listaSessoes(primeira)
    expect(restantes).toHaveLength(1)
  })

  it('sem sessao nao da para listar nem revogar', async () => {
    // A lista revela onde e quando a pessoa acessa a conta. Um endpoint aberto
    // entregaria isso a qualquer um que soubesse a URL.
    expect((await request(app).get('/api/auth/list-sessions')).status).toBe(401)
  })
})
