import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import * as email from '../email'

let enviados: { para: string; assunto: string; texto: string }[] = []

beforeEach(() => {
  enviados = []
  vi.spyOn(email, 'enviarEmail').mockImplementation(async (msg) => {
    enviados.push({ para: msg.para, assunto: msg.assunto, texto: msg.texto })
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * O link do e-mail nao leva o token em query: ele aponta para a API em
 * /api/auth/reset-password/<token>, que valida e so entao redireciona para a
 * tela do front com ?token=. Seguir esse redirecionamento e o que o navegador
 * faz, e e o unico jeito de o teste exercitar o caminho real - extrair o token
 * do link "na mao" testaria uma rota que ninguem percorre.
 */
async function tokenDoEmail(link: string): Promise<string> {
  const url = new URL(link)
  const res = await request(app).get(url.pathname + url.search)
  expect(res.status).toBeGreaterThanOrEqual(300)
  expect(res.status).toBeLessThan(400)

  const destino = new URL(res.headers.location)
  const token = destino.searchParams.get('token')
  expect(token).toBeTruthy()
  return token!
}

async function criaUsuario() {
  const usuario = {
    name: 'Alef',
    email: `reset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }
  await request(app).post('/api/auth/sign-up/email').send(usuario)
  enviados = []
  return usuario
}

describe('Recuperacao de senha', () => {
  it('pedido envia e-mail com link que carrega o token', async () => {
    const usuario = await criaUsuario()

    const res = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: usuario.email, redirectTo: 'http://localhost:5173/nova-senha' })

    expect(res.status).toBe(200)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].para).toBe(usuario.email)

    const link = enviados[0].texto.match(/https?:\/\/\S+/)?.[0]
    expect(link).toBeDefined()

    // O que importa nao e o formato do link, e ele desembocar numa tela do
    // front com um token utilizavel.
    const token = await tokenDoEmail(link!)
    expect(token.length).toBeGreaterThan(10)
  })

  it('e-mail desconhecido responde igual e nao envia nada', async () => {
    const res = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'nao-existe@teste.com', redirectTo: 'http://localhost:5173/nova-senha' })

    // Resposta identica a do caso com conta: distinguir transformaria a rota
    // num detector de quem tem conta aqui, e conta em app de financas nao e
    // informacao para entregar a quem so tem o endereco.
    expect(res.status).toBe(200)
    expect(enviados).toHaveLength(0)
  })

  it('a senha antiga para de valer e a nova funciona', async () => {
    const usuario = await criaUsuario()

    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: usuario.email, redirectTo: 'http://localhost:5173/nova-senha' })

    const token = await tokenDoEmail(enviados[0].texto.match(/https?:\/\/\S+/)![0])

    const nova = 'outraSenhaDeTeste456'
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: nova, token })
    expect(reset.status).toBe(200)

    const comAntiga = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: usuario.email, password: usuario.password })
    expect(comAntiga.status).toBe(401)

    const comNova = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: usuario.email, password: nova })
    expect(comNova.status).toBe(200)
  })

  it('o token so serve uma vez', async () => {
    const usuario = await criaUsuario()

    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: usuario.email, redirectTo: 'http://localhost:5173/nova-senha' })

    const token = await tokenDoEmail(enviados[0].texto.match(/https?:\/\/\S+/)![0])

    const primeira = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'primeiraNova123', token })
    // Sem conferir a primeira, este teste passaria mesmo com um token invalido:
    // as duas chamadas falhariam e a segunda pareceria "recusada por reuso".
    expect(primeira.status).toBe(200)

    // Um link reutilizavel viraria chave permanente da conta para quem tivesse
    // acesso ao e-mail, mesmo tempos depois.
    const segunda = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'segundaNova123', token })
    expect(segunda.status).toBeGreaterThanOrEqual(400)
  })
})
