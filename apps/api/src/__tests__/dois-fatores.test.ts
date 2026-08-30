import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createHmac } from 'crypto'
import app from '../index'

const ORIGEM = 'http://localhost:5173'

// TOTP implementado aqui, em vez de reaproveitar o utilitario do Better Auth.
//
// Nao e teimosia: chamar a mesma funcao que o servidor usa para conferir
// provaria apenas que ela concorda consigo mesma. Uma implementacao
// independente da RFC 6238 verifica o que realmente importa - que um
// aplicativo autenticador comum, seguindo o padrao, produz codigos que esta
// API aceita.
//
// A chave do HMAC sao os BYTES decodificados do parametro `secret` da URI
// otpauth, que e exatamente o que o aplicativo faz ao ler o QR Code. Usar a
// string base32 direto gera codigo com a chave errada e a resposta e
// "Invalid code" - parece bug do 2FA e e do teste.
const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ParaBytes(texto: string): Buffer {
  let bits = 0
  let acumulado = 0
  const bytes: number[] = []

  for (const caractere of texto.replace(/=+$/, '').toUpperCase()) {
    const indice = ALFABETO_BASE32.indexOf(caractere)
    if (indice === -1) continue
    acumulado = (acumulado << 5) | indice
    bits += 5
    if (bits >= 8) {
      bytes.push((acumulado >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function codigoDe(totpURI: string, periodo = 30, digitos = 6): string {
  const chave = base32ParaBytes(new URL(totpURI).searchParams.get('secret')!)

  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / periodo)))

  const hmac = createHmac('sha1', chave).update(contador).digest()
  // Truncamento dinamico da RFC 4226: os 4 bits finais escolhem de onde ler.
  const deslocamento = hmac[hmac.length - 1] & 0x0f
  const numero = hmac.readUInt32BE(deslocamento) & 0x7fffffff

  return String(numero % 10 ** digitos).padStart(digitos, '0')
}

async function contaComDoisFatores() {
  const usuario = {
    name: 'Alef',
    email: `dois_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }

  const cadastro = await request(app).post('/api/auth/sign-up/email').send(usuario)
  expect(cadastro.status).toBe(200)
  const cookie = cadastro.headers['set-cookie'] as unknown as string[]

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
    .send({ code: codigoDe(totpURI) })
  expect(res.status).toBe(200)

  // Confirmar rotaciona a sessao: o Better Auth cria uma nova e apaga a
  // anterior. Continuar usando o cookie do cadastro daria 401 em tudo depois
  // disso - inclusive na tela de configuracoes que acabou de ativar o 2FA.
  return (res.headers['set-cookie'] as unknown as string[]) ?? cookie
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
    const cookie = cadastro.headers['set-cookie'] as unknown as string[]

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
    const cookieDesafio = login.headers['set-cookie'] as unknown as string[]

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
      .send({ code: codigoDe(totpURI) })

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
