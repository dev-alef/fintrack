import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index'
import { aceitesDe, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../aceites'
import { query } from '../db/client'

const ORIGEM = 'http://localhost:5173'

async function cadastra() {
  const usuario = {
    name: 'Aceite',
    email: `aceite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }

  const res = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGEM)
    .set('x-forwarded-for', '187.55.10.20')
    // O supertest nao manda User-Agent sozinho; um navegador de verdade
    // sempre manda, e e isso que o registro precisa capturar.
    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0')
    .send(usuario)

  expect(res.status).toBe(200)
  return { usuario, id: res.body.user.id as string }
}

describe('Registro de aceite dos documentos legais', () => {
  it('cadastrar grava o aceite dos dois documentos', async () => {
    // A tela de cadastro afirma que criar a conta e aceitar os termos. Sem
    // este registro, essa afirmacao nao teria como ser comprovada depois.
    const { id } = await cadastra()

    const aceites = await aceitesDe(id)
    const documentos = aceites.map((a) => a.documento).sort()

    expect(documentos).toEqual(['privacidade', 'termos'])
  })

  it('cada documento guarda a PROPRIA versao', async () => {
    // Sem isto, sabe-se que a pessoa aceitou algo, mas nao o que ela aceitou -
    // e documento legal muda com o tempo. O bug que este teste trava: as duas
    // linhas compartilharem o mesmo parametro de versao, que passa despercebido
    // enquanto as duas datas forem iguais.
    const { id } = await cadastra()
    const aceites = await aceitesDe(id)

    const porDocumento = Object.fromEntries(aceites.map((a) => [a.documento, a.versao]))

    expect(porDocumento.termos).toBe(VERSAO_TERMOS)
    expect(porDocumento.privacidade).toBe(VERSAO_PRIVACIDADE)
  })

  it('guarda quando, de qual IP e de qual navegador', async () => {
    // Evidencia de contexto. Fica aqui, e nao so na sessao, porque o aceite
    // precisa se sustentar sozinho depois de a sessao daquele dia expirar.
    const { id } = await cadastra()

    const linhas = await query(
      'SELECT ip, user_agent, aceito_em FROM aceites WHERE user_id = $1 LIMIT 1',
      [id],
    )

    expect(linhas.rows[0].ip).toBe('187.55.10.20')
    expect(linhas.rows[0].user_agent).toContain('Chrome/120.0')
    expect(new Date(linhas.rows[0].aceito_em).getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('apagar a conta apaga o aceite junto', async () => {
    // ON DELETE CASCADE deliberado: a Politica de Privacidade promete remover
    // os dados, e manter um registro nominal de quem pediu exclusao
    // contradiria o proprio documento que esta tabela existe para comprovar.
    const { id } = await cadastra()
    expect((await aceitesDe(id)).length).toBeGreaterThan(0)

    await query('DELETE FROM users WHERE id = $1', [id])

    expect(await aceitesDe(id)).toHaveLength(0)
  })
})
