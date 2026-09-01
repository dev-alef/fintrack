import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import * as email from '../email'

const ORIGEM = 'http://localhost:5173'

let enviados: { para: string; assunto: string; texto: string; html: string }[] = []

beforeEach(() => {
  enviados = []
  process.env.SUPPORT_EMAIL = 'suporte@provisao.space'
  vi.spyOn(email, 'enviarEmail').mockImplementation(async (msg) => {
    enviados.push({ para: msg.para, assunto: msg.assunto, texto: msg.texto, html: msg.html })
    return true
  })
  // A rota so envia quando ha provedor configurado; sem isto ela responderia
  // 503 e os testes provariam apenas que ela sabe se recusar.
  vi.spyOn(email, 'emailHabilitado', 'get').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function usuarioLogado() {
  const usuario = {
    name: 'Alef',
    email: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }
  const cadastro = await request(app).post('/api/auth/sign-up/email').send(usuario)
  expect(cadastro.status).toBe(200)
  enviados = []
  return { usuario, cookie: cadastro.headers['set-cookie'] as unknown as string[] }
}

describe('Suporte', () => {
  it('sem sessao nao envia nada', async () => {
    const res = await request(app).post('/suporte').set('Origin', ORIGEM).send({ mensagem: 'Encontrei um problema serio' })

    // Um canal aberto sem sessao viraria formulario de spam apontado para a
    // caixa da equipe.
    expect(res.status).toBe(401)
    expect(enviados).toHaveLength(0)
  })

  it('mensagem curta demais e recusada', async () => {
    const { cookie } = await usuarioLogado()

    const res = await request(app).post('/suporte').set('Cookie', cookie).set('Origin', ORIGEM).send({ mensagem: 'erro' })

    expect(res.status).toBe(400)
    expect(enviados).toHaveLength(0)
  })

  it('envia com o contexto que a equipe precisa', async () => {
    const { usuario, cookie } = await usuarioLogado()

    const res = await request(app)
      .post('/suporte')
      .set('Cookie', cookie)
      .set('Origin', ORIGEM)
      .set('User-Agent', 'NavegadorDeTeste/1.0')
      .send({ mensagem: 'O saldo do mes esta somando errado', tela: '/dashboard' })

    expect(res.status).toBe(200)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].para).toBe('suporte@provisao.space')

    // Sem o e-mail de quem escreveu nao ha como responder, e sem a tela a
    // equipe volta a perguntar onde foi - que e o motivo de anexar contexto.
    expect(enviados[0].texto).toContain(usuario.email)
    expect(enviados[0].texto).toContain('/dashboard')
    expect(enviados[0].texto).toContain('NavegadorDeTeste')
    expect(enviados[0].texto).toContain('O saldo do mes esta somando errado')
  })

  it('a identidade vem da sessao, nao do corpo da requisicao', async () => {
    const { usuario, cookie } = await usuarioLogado()

    const res = await request(app)
      .post('/suporte')
      .set('Cookie', cookie)
      .set('Origin', ORIGEM)
      .send({ mensagem: 'Tentando me passar por outra pessoa', email: 'vitima@teste.com', nome: 'Vitima' })

    expect(res.status).toBe(200)
    // Aceitar nome e e-mail do corpo deixaria qualquer um abrir chamado em nome
    // de outro - e a equipe responderia para o endereco errado.
    expect(enviados[0].texto).toContain(usuario.email)
    expect(enviados[0].texto).not.toContain('vitima@teste.com')
  })

  it('escapa HTML da mensagem', async () => {
    const { cookie } = await usuarioLogado()

    await request(app)
      .post('/suporte')
      .set('Cookie', cookie)
      .set('Origin', ORIGEM)
      .send({ mensagem: 'Olha isso: <img src=x onerror=alert(1)> quebrou' })

    // Quem le o chamado e sempre a equipe. Sem escapar, o cliente de e-mail
    // dela executaria o que o usuario escreveu.
    expect(enviados[0].html).not.toContain('<img src=x')
    expect(enviados[0].html).toContain('&lt;img')
  })

  it('limita o numero de mensagens por usuario', async () => {
    const { cookie } = await usuarioLogado()

    for (let i = 0; i < 3; i++) {
      const ok = await request(app)
        .post('/suporte')
        .set('Cookie', cookie)
        .set('Origin', ORIGEM)
        .send({ mensagem: `Mensagem numero ${i} com tamanho suficiente` })
      expect(ok.status).toBe(200)
    }

    const quarta = await request(app)
      .post('/suporte')
      .set('Cookie', cookie)
      .set('Origin', ORIGEM)
      .send({ mensagem: 'Quarta mensagem seguida com tamanho suficiente' })

    // Sem limite, um formulario autenticado queima a cota do Resend - e junto
    // dela a verificacao de e-mail e a recuperacao de senha, que sao caminhos
    // de acesso a conta.
    expect(quarta.status).toBe(429)
    expect(enviados).toHaveLength(3)
  })
})
