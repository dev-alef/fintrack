import { describe, expect, it } from 'vitest'
import { erroDeLogin } from './login-feedback'
describe('Orientação de falha no login', () => {
  it('orienta esperar o servidor sem atribuir indisponibilidade à senha', () => {
    for (const status of [undefined, 0, 500, 502, 503, 504]) {
      expect(erroDeLogin(status)).toContain('cerca de 1 minuto')
      expect(erroDeLogin(status)).not.toContain('senha incorretos')
    }
  })
  it('preserva a orientação própria para credenciais, limite e conta bloqueada', () => {
    expect(erroDeLogin(401)).toContain('E-mail ou senha incorretos')
    expect(erroDeLogin(400)).toContain('E-mail ou senha incorretos')
    expect(erroDeLogin(429)).toContain('Muitas tentativas')
    expect(erroDeLogin(403)).toContain('esta conta')
  })
})
