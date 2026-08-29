import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'

// O fluxo OAuth completo nao pode ser testado sem falar com o Google de
// verdade. O que da para provar aqui - e e o que quebraria em producao - e que
// a API monta o redirecionamento certo: provedor registrado, client_id usado, e
// redirect_uri apontando para o callback desta API. Um redirect_uri errado e a
// causa numero um de falha nessa integracao, e o erro so aparece depois que a
// pessoa ja autorizou no Google.
//
// As credenciais sao lidas de process.env no momento em que o modulo carrega,
// entao cada cenario reimporta a aplicacao com o ambiente ja ajustado.
async function carregaApp(): Promise<Express> {
  vi.resetModules()
  const { default: app } = await import('../index')
  return app as Express
}

const ambienteOriginal = { ...process.env }

beforeEach(() => {
  // Vazio em vez de `delete`: o index.ts importa 'dotenv/config', que roda de
  // novo a cada resetModules e repovoa a partir do .env qualquer chave AUSENTE.
  // Apagando, o teste passaria ou falharia conforme o .env da maquina - passava
  // aqui e quebrou assim que as credenciais reais entraram no arquivo. O dotenv
  // nao sobrescreve chave que ja existe, e string vazia conta como existente.
  process.env.GOOGLE_CLIENT_ID = ''
  process.env.GOOGLE_CLIENT_SECRET = ''
})

afterAll(() => {
  process.env = { ...ambienteOriginal }
})

describe('Login com Google', () => {
  const corpo = {
    provider: 'google',
    callbackURL: 'http://localhost:5173/dashboard',
  }

  it('sem credenciais configuradas, o provedor nao e oferecido', async () => {
    const app = await carregaApp()

    const res = await request(app).post('/api/auth/sign-in/social').send(corpo)

    // Registrar o provedor com credencial vazia faria o usuario ser levado ao
    // Google para receber um erro de client_id invalido, em ingles e sem volta.
    // Falhar aqui mantem o erro do lado que sabe explica-lo.
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(String(res.body.url ?? '')).not.toContain('accounts.google.com')
  })

  it('com credenciais, redireciona para o consentimento do Google', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id-de-teste.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'segredo-de-teste'
    const app = await carregaApp()

    const res = await request(app).post('/api/auth/sign-in/social').send(corpo)

    expect(res.status).toBe(200)

    const url = String(res.body.url)
    expect(url).toContain('accounts.google.com')
    expect(url).toContain('id-de-teste.apps.googleusercontent.com')

    // O redirect_uri precisa bater caractere por caractere com o cadastrado no
    // Google Cloud Console. Se o caminho mudar, este teste falha antes de a
    // mudanca chegar em producao como redirect_uri_mismatch. A base vem da
    // mesma variavel que a aplicacao usa, para o teste nao quebrar so porque o
    // ambiente definiu uma URL diferente.
    const base = process.env.BETTER_AUTH_URL || 'http://localhost:3001'
    const redirectUri = new URL(url).searchParams.get('redirect_uri')
    expect(redirectUri).toBe(`${base}/api/auth/callback/google`)
  })

  it('o e-mail e pedido ao Google, senao nao da para vincular a conta existente', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id-de-teste.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'segredo-de-teste'
    const app = await carregaApp()

    const res = await request(app).post('/api/auth/sign-in/social').send(corpo)

    // A vinculacao com uma conta que ja existe se apoia no e-mail verificado
    // pelo Google. Sem este escopo, quem ja tem conta ganharia um usuario novo
    // e os dados financeiros ficariam presos no antigo.
    const escopo = new URL(String(res.body.url)).searchParams.get('scope') ?? ''
    expect(escopo).toContain('email')
  })
})
