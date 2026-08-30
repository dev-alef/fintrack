import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createOTP } from '@better-auth/utils/otp'
import { base32 } from '@better-auth/utils/base32'
import app from '../index'

const ORIGEM = 'http://localhost:5173'

// O codigo de 6 digitos e gerado aqui com o mesmo utilitario que o Better Auth
// usa para conferir. Sem isso o teste so conseguiria provar que codigo errado e
// recusado - e a parte que quebra o acesso de verdade e a oposta: codigo CERTO
// sendo aceito.
//
// O `secret` da URI e a forma base32 de um segredo de 32 caracteres, que e o
// que o HMAC realmente usa. Passar a URI direto gera codigo com a chave errada
// e a verificacao responde "Invalid code" - parecendo bug do 2FA quando e do
// teste. E o aplicativo autenticador faz esta mesma decodificacao ao ler o QR.
function codigoDe(totpURI: string): Promise<string> {
  const base32Secret = new URL(totpURI).searchParams.get('secret')!
  const segredo = new TextDecoder().decode(base32.decode(base32Secret))
  return createOTP(segredo, { digits: 6, period: 30 }).totp()
}

async function contaComDoisFatores() {
  const usuario = {
    name: 'Alef',
    email: `dois_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }

  const cadastro = await request(app).post('/api/auth/sign-up/email').send(usuario)
  expect(cadastro.status).toBe(200)
  const cookie = cadastro.headers['set-cookie']

  const ativacao = await request(app)
    .post('/api/auth/two-factor/enable')
    .set('Cookie', cookie)
    .set('Origin', ORIGEM)
    .send({ password: usuario.password })
  expect(ativacao.status).toBe(200)

  return { usuario, cookie, ...ativacao.body as { totpURI: string; backupCodes: string[] } }
}

/**
 * Conclui a ativacao confirmando o primeiro codigo. Enquanto isso nao acontece
 * o 2FA fica inerte de proposito - ver o teste abaixo.
 */
async function confirma(cookie: string[], totpURI: string): Promise<string[]> {
  const res = await request(app)
    .post('/api/auth/two-factor/verify-totp')
    .set('Cookie', cookie)
    .set('Origin', ORIGEM)
    .send({ code: await codigoDe(totpURI) })
  expect(res.status).toBe(200)

  // Confirmar rotaciona a sessao: o Better Auth cria uma nova e apaga a
  // anterior. Continuar usando o cookie do cadastro daria 401 em tudo depois
  // disso - inclusive na tela de configuracoes que acabou de ativar o 2FA.
  return res.headers['set-cookie'] ?? cookie
}

describe('Dois fatores (TOTP)', () => {
  it('ativar devolve o segredo e os codigos de recuperacao', async () => {
    const { totpURI, backupCodes } = await contaComDoisFatores()

    expect(totpURI).toContain('otpauth://totp/')
    expect(new URL(totpURI).searchParams.get('secret')).toBeTruthy()

    // Sem codigos de recuperacao, perder o celular significa perder a conta e
    // os dados financeiros para sempre. Eles sao exibidos uma unica vez.
    expect(Array.isArray(backupCodes)).toBe(true)
    expect(backupCodes.length).toBeGreaterThan(0)
  })

  it('ativar exige a senha atual', async () => {
    const usuario = {
      name: 'Alef',
      email: `dois_senha_${Date.now()}@teste.com`,
      password: 'senhaDeTeste123',
    }
    const cadastro = await request(app).post('/api/auth/sign-up/email').send(usuario)
    const cookie = cadastro.headers['set-cookie']

    // Sem esta exigencia, quem pegasse o notebook destravado trancaria o dono
    // para fora da propria conta, com um segredo que so o invasor teria.
    const res = await request(app)
      .post('/api/auth/two-factor/enable')
      .set('Cookie', cookie)
      .set('Origin', ORIGEM)
      .send({ password: 'senhaErrada' })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('ativar sem confirmar o primeiro codigo NAO tranca a conta', async () => {
    const { usuario } = await contaComDoisFatores()

    const login = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGEM)
      .send({ email: usuario.email, password: usuario.password })

    // Se so gerar o segredo ja ativasse, quem fechasse a tela antes de escanear
    // o QR Code ficaria trancado para fora dos proprios dados, com um segredo
    // que nunca chegou a nenhum aplicativo. A confirmacao existe para provar
    // que a pessoa consegue gerar codigos ANTES de eles passarem a ser exigidos.
    expect(login.status).toBe(200)
    expect(login.body.twoFactorRedirect).toBeUndefined()
  })

  it('depois de confirmado, o login passa a pedir o segundo fator', async () => {
    const { usuario, cookie, totpURI } = await contaComDoisFatores()
    await confirma(cookie, totpURI)

    const login = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGEM)
      .send({ email: usuario.email, password: usuario.password })

    expect(login.status).toBe(200)
    // A senha correta deixa de bastar: sem este desvio, ativar 2FA nao mudaria
    // nada e a tela daria a falsa impressao de protecao.
    expect(login.body.twoFactorRedirect).toBe(true)
  })

  it('o codigo correto conclui o login e o errado nao', async () => {
    const { usuario, cookie, totpURI } = await contaComDoisFatores()
    await confirma(cookie, totpURI)

    const login = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGEM)
      .send({ email: usuario.email, password: usuario.password })
    const cookieDesafio = login.headers['set-cookie']

    const errado = await request(app)
      .post('/api/auth/two-factor/verify-totp')
      .set('Cookie', cookieDesafio)
      .set('Origin', ORIGEM)
      .send({ code: '000000' })
    expect(errado.status).toBeGreaterThanOrEqual(400)

    const certo = await request(app)
      .post('/api/auth/two-factor/verify-totp')
      .set('Cookie', cookieDesafio)
      .set('Origin', ORIGEM)
      .send({ code: await codigoDe(totpURI) })

    expect(certo.status).toBe(200)
    expect(String(certo.headers['set-cookie'])).toContain('HttpOnly')
  })

  it('desativar devolve o login por senha, e exige a senha', async () => {
    const { usuario, cookie, totpURI } = await contaComDoisFatores()
    const sessao = await confirma(cookie, totpURI)

    const semSenha = await request(app)
      .post('/api/auth/two-factor/disable')
      .set('Cookie', sessao)
      .set('Origin', ORIGEM)
      .send({ password: 'senhaErrada' })
    expect(semSenha.status).toBeGreaterThanOrEqual(400)

    const ok = await request(app)
      .post('/api/auth/two-factor/disable')
      .set('Cookie', sessao)
      .set('Origin', ORIGEM)
      .send({ password: usuario.password })
    expect(ok.status).toBe(200)

    const login = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGEM)
      .send({ email: usuario.email, password: usuario.password })

    expect(login.status).toBe(200)
    // Desativou de verdade: nao pode sobrar desvio pedindo um codigo que a
    // pessoa nao tem mais como gerar.
    expect(login.body.twoFactorRedirect).toBeUndefined()
  })
})
