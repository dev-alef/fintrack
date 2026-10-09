import { describe, expect, it } from 'vitest'
import { projecaoFimDoAno } from './planejamento-anual'

describe('projecaoFimDoAno', () => {
  it('inclui meses com receita zero e ignora meses sem receita planejada', () => {
    const result = projecaoFimDoAno({
      saldoAtual: 1000,
      mesAtual: 10,
      fixasPorMes: 50,
      meses: new Map([
        [11, { receita: 0, faturas: 100 }],
        [12, { receita: null, faturas: 200 }],
      ]),
    })

    expect(result).toEqual({ valor: 850, mesesConsiderados: 1, somaPlanejada: -150 })
  })
})
