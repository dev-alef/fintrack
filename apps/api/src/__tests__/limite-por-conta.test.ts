import { afterEach, describe, expect, it } from 'vitest'
import { anotaTentativa, barraSeExcedeu, falhasDe, zeraTudo } from '../limite-por-conta'

const LOGIN = '/sign-in/email'
const CADASTRO = '/sign-up/email'

function erra(email: string, vezes: number) {
  for (let i = 0; i < vezes; i++) anotaTentativa(LOGIN, { email }, true)
}

afterEach(() => {
  zeraTudo()
})

describe('Limite por conta', () => {
  it('nove falhas nao bloqueiam; a decima sim', () => {
    const email = 'vitima1@teste.com'
    erra(email, 9)

    expect(() => barraSeExcedeu(LOGIN, { email })).not.toThrow()

    anotaTentativa(LOGIN, { email }, true)
    expect(() => barraSeExcedeu(LOGIN, { email })).toThrow()
  })

  it('login certo zera o contador', () => {
    // Sem isto, quem usa o app todo dia e erra a senha ocasionalmente
    // acabaria bloqueado por uso normal, nao por ataque.
    const email = 'usuaria@teste.com'
    erra(email, 9)

    anotaTentativa(LOGIN, { email }, false)

    expect(falhasDe(email)).toBe(0)
    expect(() => barraSeExcedeu(LOGIN, { email })).not.toThrow()
  })

  it('trocar de e-mail nao esvazia o balde do alvo', () => {
    // O ponto central: o atacante controla o IP, mas nao o e-mail que quer
    // atacar - mandar outro e-mail e desistir do alvo, nao contornar o limite.
    const alvo = 'alvo@teste.com'
    erra(alvo, 10)
    expect(() => barraSeExcedeu(LOGIN, { email: alvo })).toThrow()

    anotaTentativa(LOGIN, { email: 'outra-conta@teste.com' }, true)
    expect(() => barraSeExcedeu(LOGIN, { email: 'outra-conta@teste.com' })).not.toThrow()
    // O alvo original continua bloqueado - nao foi afetado pela tentativa
    // contra a outra conta.
    expect(() => barraSeExcedeu(LOGIN, { email: alvo })).toThrow()
  })

  it('maiusculas e espaco nao escapam do balde', () => {
    const email = 'MaiUscula@Teste.com'
    erra(email, 10)

    expect(() => barraSeExcedeu(LOGIN, { email: '  maiuscula@teste.com  ' })).toThrow()
  })

  it('a mensagem de bloqueio nao diz se a conta existe', () => {
    // Contador sobe igual para e-mail que existe ou nao - os dois devolvem
    // falha. Se so bloqueasse conta real, o bloqueio virava um detector de
    // quem tem conta aqui.
    const naoExiste = `fantasma_${Date.now()}@teste.com`
    erra(naoExiste, 10)

    let mensagem = ''
    try {
      barraSeExcedeu(LOGIN, { email: naoExiste })
    } catch (e) {
      mensagem = (e as { body?: { message?: string } }).body?.message ?? ''
    }

    expect(mensagem).not.toMatch(/existe|cadastr|encontr/i)
    expect(mensagem.length).toBeGreaterThan(0)
  })

  it('sign-up nao entra no bloqueio de login', () => {
    // O ataque que isto evita: mandar dez sign-ups com o e-mail de uma vitima
    // (sem saber a senha dela) nao pode trancar o LOGIN dessa vitima. Sign-up
    // com e-mail existente ja custa quase nada e ja e informacao publica.
    const vitima = 'vitima2@teste.com'
    for (let i = 0; i < 10; i++) anotaTentativa(CADASTRO, { email: vitima }, true)

    expect(() => barraSeExcedeu(LOGIN, { email: vitima })).not.toThrow()
    expect(falhasDe(vitima)).toBe(0)
  })

  it('corpo sem e-mail, ou e-mail que nao e string, nao quebra nem conta', () => {
    expect(() => barraSeExcedeu(LOGIN, undefined)).not.toThrow()
    expect(() => barraSeExcedeu(LOGIN, {})).not.toThrow()
    expect(() => anotaTentativa(LOGIN, { email: 123 }, true)).not.toThrow()
    expect(() => anotaTentativa(LOGIN, null, true)).not.toThrow()
  })

  it('caminho fora da lista protegida nunca bloqueia', () => {
    const email = 'contadefinicoes@teste.com'
    for (let i = 0; i < 20; i++) anotaTentativa('/change-password', { email }, true)

    expect(() => barraSeExcedeu('/change-password', { email })).not.toThrow()
    expect(falhasDe(email)).toBe(0)
  })
})
