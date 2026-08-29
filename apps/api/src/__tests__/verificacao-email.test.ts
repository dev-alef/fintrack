import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import * as email from '../email'

// O envio real e substituido: o que importa aqui e SE a mensagem sai e para
// quem, nao se o provedor aceitou. Chamar o Resend em teste seria lento, exigiria
// chave e mandaria e-mail de verdade para enderecos inventados.
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

describe('Verificacao de e-mail', () => {
  it('cadastro dispara o e-mail com um link utilizavel', async () => {
    const usuario = {
      name: 'Alef',
      email: `verif_${Date.now()}@teste.com`,
      password: 'senhaDeTeste123',
    }

    const res = await request(app).post('/api/auth/sign-up/email').send(usuario)
    expect(res.status).toBe(200)

    expect(enviados).toHaveLength(1)
    expect(enviados[0].para).toBe(usuario.email)

    // Sem token o e-mail e inutil, e a falha seria silenciosa: a mensagem
    // chegaria bonita e o link nao confirmaria nada.
    const link = enviados[0].texto.match(/https?:\/\/\S+/)?.[0]
    expect(link).toBeDefined()
    expect(link).toContain('/api/auth/verify-email')
    expect(link).toContain('token=')
  })

  it('o e-mail sai em texto puro alem do assunto', async () => {
    await request(app)
      .post('/api/auth/sign-up/email')
      .send({ name: 'Alef', email: `texto_${Date.now()}@teste.com`, password: 'senhaDeTeste123' })

    // Cliente que bloqueia HTML mostra so esta versao, e a ausencia dela e
    // sinal classico de spam.
    expect(enviados[0].texto.length).toBeGreaterThan(0)
    expect(enviados[0].assunto).toContain('Confirme')
  })

  it('login de quem ja existe nao dispara verificacao', async () => {
    const usuario = {
      name: 'Alef',
      email: `login_${Date.now()}@teste.com`,
      password: 'senhaDeTeste123',
    }
    await request(app).post('/api/auth/sign-up/email').send(usuario)
    enviados = []

    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: usuario.email, password: usuario.password })

    expect(res.status).toBe(200)
    // Reenviar a cada login treinaria a pessoa a ignorar o e-mail - e e
    // exatamente esse o e-mail que ela precisa levar a serio.
    expect(enviados).toHaveLength(0)
  })
})
