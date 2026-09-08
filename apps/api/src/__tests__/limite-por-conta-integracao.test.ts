import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../index'
import { zeraTudo } from '../limite-por-conta'

const ORIGEM = 'http://localhost:5173'

/**
 * Prova a fiacao real: que os hooks do Better Auth em auth.ts de fato chamam
 * limite-por-conta.ts na requisicao HTTP de verdade, e nao so que as funcoes
 * puras se comportam bem isoladas - isso os testes de limite-por-conta.test.ts
 * ja cobrem.
 */

afterEach(() => {
  zeraTudo()
})

async function tenta(email: string, password = 'senhaErrada') {
  return request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGEM)
    .send({ email, password })
}

describe('Limite por conta - integracao HTTP', () => {
  it('a decima primeira tentativa contra o mesmo e-mail leva 429 com Retry-After', async () => {
    const email = `alvo_${Date.now()}@teste.com`

    for (let i = 0; i < 10; i++) {
      const res = await tenta(email)
      expect(res.status).toBe(401)
    }

    const bloqueado = await tenta(email)
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.headers['retry-after']).toBeTruthy()
    // Mesma resposta para conta que existe ou nao - nao pode virar detector.
    expect(JSON.stringify(bloqueado.body)).not.toMatch(/existe|cadastr|encontr/i)
  }, 20000)

  it('outro e-mail, ao mesmo tempo, nao e afetado pelo bloqueio do primeiro', async () => {
    const alvo = `alvo2_${Date.now()}@teste.com`
    const outro = `outro_${Date.now()}@teste.com`

    for (let i = 0; i < 11; i++) await tenta(alvo)

    const resAlvo = await tenta(alvo)
    expect(resAlvo.status).toBe(429)

    const resOutro = await tenta(outro)
    expect(resOutro.status).toBe(401)
  }, 20000)

  it('sign-up repetido para o e-mail de outra pessoa nao tranca o login dela', async () => {
    // O ataque que a separacao de rotas evita: sem saber a senha da vitima,
    // mandar sign-ups repetidos com o e-mail dela nao pode trancar o LOGIN.
    const vitima = `vitima_${Date.now()}@teste.com`

    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', ORIGEM)
        .send({ name: 'Vitima', email: vitima, password: 'qualquerCoisa123' })
    }

    const login = await tenta(vitima, 'senhaQualquer')
    expect(login.status).toBe(401)
  }, 20000)
})
