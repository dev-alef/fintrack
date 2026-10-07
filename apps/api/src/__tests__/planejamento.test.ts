import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index'
import { query } from '../db/client'

const ORIGEM = 'http://localhost:5173'
const ANO = 2031

async function contaComCartao(nome = 'Nubank') {
  const usuario = {
    name: 'Planejador',
    email: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }

  const cadastro = await request(app).post('/api/auth/sign-up/email').set('Origin', ORIGEM).send(usuario)
  expect(cadastro.status).toBe(200)
  const cookie = cadastro.headers['set-cookie'] as unknown as string[]

  const cartao = await request(app)
    .post('/finance/cards')
    .set('Cookie', cookie)
    .send({ name: nome, due_day: 10 })
  expect(cartao.status).toBe(201)

  return { cookie, cartaoId: cartao.body.id as string, userId: cadastro.body.user.id as string }
}

describe('Planejamento do ano', () => {
  it('grava varios meses de uma vez e devolve os valores certos', async () => {
    const { cookie, cartaoId } = await contaComCartao()

    const res = await request(app)
      .post('/finance/planejamento')
      .set('Cookie', cookie)
      .send({
        year: ANO,
        meses: [
          { month: 9, estimated_income: 7000, cards: [{ cardId: cartaoId, amount: 680 }] },
          { month: 10, estimated_income: 7000, cards: [{ cardId: cartaoId, amount: 920.5 }] },
          { month: 11, estimated_income: 7500, cards: [{ cardId: cartaoId, amount: 1200 }] },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ meses: 3, faturas: 3 })

    const anual = await request(app).get(`/finance/annual?year=${ANO}`).set('Cookie', cookie)
    const porMes = Object.fromEntries(
      anual.body.map((l: { month: number; estimated_income: string }) => [l.month, Number(l.estimated_income)]),
    )
    expect(porMes[9]).toBe(7000)
    expect(porMes[11]).toBe(7500)
  })

  it('um cartao de OUTRO usuario derruba tudo, sem gravar nada', async () => {
    // O teste que mais importa. Se a gravacao nao fosse transacional, os meses
    // anteriores ao id invalido ficariam salvos e a tela diria que falhou -
    // deixando a pessoa sem saber o que foi gravado e o que nao foi.
    const meu = await contaComCartao()
    const alheio = await contaComCartao('Cartao de outra pessoa')

    const res = await request(app)
      .post('/finance/planejamento')
      .set('Cookie', meu.cookie)
      .send({
        year: ANO,
        meses: [
          { month: 3, estimated_income: 1234, cards: [{ cardId: meu.cartaoId, amount: 100 }] },
          { month: 4, estimated_income: 5678, cards: [{ cardId: alheio.cartaoId, amount: 999 }] },
        ],
      })

    expect(res.status).toBe(404)

    // A prova: releitura direta no banco. O mes 3, que vinha ANTES do erro,
    // nao pode ter sobrado gravado.
    const linhas = await query(
      'SELECT month FROM monthly_config WHERE user_id = $1 AND year = $2',
      [meu.userId, ANO],
    )
    expect(linhas.rows).toHaveLength(0)
  })

  it('marcar e desmarcar a fatura como paga', async () => {
    const { cookie, cartaoId } = await contaComCartao()

    const paga = await request(app)
      .post('/finance/cards/expenses/toggle')
      .set('Cookie', cookie)
      .send({ cardId: cartaoId, month: 5, year: ANO, paid: true })

    expect(paga.status).toBe(200)
    expect(paga.body.paid).toBe(true)
    expect(paga.body.paid_at).toBeTruthy()

    const aberta = await request(app)
      .post('/finance/cards/expenses/toggle')
      .set('Cookie', cookie)
      .send({ cardId: cartaoId, month: 5, year: ANO, paid: false })

    expect(aberta.body.paid).toBe(false)
    expect(aberta.body.paid_at).toBeNull()
  })

  it('salvar o planejamento nao apaga a marcacao de paga', async () => {
    // O valor e o status de pagamento sao editados em momentos diferentes: o
    // valor em lote, o "pago" na hora. Se o lote sobrescrevesse `paid`, marcar
    // a fatura e depois salvar o ano desmarcaria tudo em silencio.
    const { cookie, cartaoId } = await contaComCartao()

    await request(app)
      .post('/finance/cards/expenses/toggle')
      .set('Cookie', cookie)
      .send({ cardId: cartaoId, month: 6, year: ANO, paid: true })

    await request(app)
      .post('/finance/planejamento')
      .set('Cookie', cookie)
      .send({ year: ANO, meses: [{ month: 6, cards: [{ cardId: cartaoId, amount: 450 }] }] })

    const anual = await request(app).get(`/finance/cards/annual?year=${ANO}`).set('Cookie', cookie)
    const mes6 = anual.body[0].monthly_breakdown.find((b: { month: number }) => b.month === 6)

    expect(Number(mes6.amount)).toBe(450)
    expect(mes6.paid).toBe(true)
  })

  it('fatura de cartao alheio e recusada', async () => {
    const meu = await contaComCartao()
    const alheio = await contaComCartao()

    const res = await request(app)
      .post('/finance/cards/expenses/toggle')
      .set('Cookie', meu.cookie)
      .send({ cardId: alheio.cartaoId, month: 7, year: ANO, paid: true })

    expect(res.status).toBe(404)
  })

  it('mes fora de 1..12 e recusado', async () => {
    const { cookie } = await contaComCartao()

    for (const month of [0, 13]) {
      const res = await request(app)
        .post('/finance/planejamento')
        .set('Cookie', cookie)
        .send({ year: ANO, meses: [{ month, estimated_income: 100 }] })
      expect(res.status).toBe(400)
    }
  })
})


describe('Previsão de quitação dos cartões', () => {
  it('agrega faturas abertas entre anos, exclui pagas e zeros e acompanha pagamentos', async () => {
    const { cookie, cartaoId } = await contaComCartao()
    const segundo = await request(app).post('/finance/cards').set('Cookie', cookie).send({ name: 'Segundo', due_day: 20 })
    for (const [cardId, year, month, amount] of [[cartaoId, 2031, 12, 10.10], [segundo.body.id, 2031, 12, 20.20], [cartaoId, 2032, 2, 40.40], [cartaoId, 2032, 3, 50], [cartaoId, 2033, 1, 0]]) {
      const saved = await request(app).post('/finance/cards/expenses').set('Cookie', cookie).send({ cardId, year, month, amount })
      expect(saved.status).toBe(200)
    }
    await request(app).post('/finance/cards/expenses/toggle').set('Cookie', cookie).send({ cardId: cartaoId, year: 2032, month: 3, paid: true })
    const forecast = () => request(app).get('/finance/cards/payoff').set('Cookie', cookie)
    expect((await forecast()).body).toEqual([
      { year: 2031, month: 12, amount: '30.30', invoice_count: 2 },
      { year: 2032, month: 2, amount: '40.40', invoice_count: 1 },
    ])
    await request(app).post('/finance/cards/expenses/toggle').set('Cookie', cookie).send({ cardId: cartaoId, year: 2032, month: 2, paid: true })
    expect((await forecast()).body).toEqual([{ year: 2031, month: 12, amount: '30.30', invoice_count: 2 }])
  })

  it('exige autenticação e isola faturas por usuário', async () => {
    const dono = await contaComCartao()
    const outro = await contaComCartao()
    await request(app).post('/finance/cards/expenses').set('Cookie', dono.cookie).send({ cardId: dono.cartaoId, year: 2035, month: 5, amount: 123 })
    expect((await request(app).get('/finance/cards/payoff')).status).toBe(401)
    const response = await request(app).get('/finance/cards/payoff').set('Cookie', outro.cookie)
    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })
})

describe('Projeção de saldo na quitação', () => {
  it('usa receitas, fixas e todas as faturas em uma conta isolada por usuário', async () => {
    const { cookie, cartaoId } = await contaComCartao()
    await request(app).post('/finance/config').set('Cookie', cookie).send({ year: ANO, month: 12, balance: 1000, estimated_income: 2000 })
    await request(app).post('/finance/bills').set('Cookie', cookie).send({ name: 'Internet', amount: 100, due_day: 10 })
    await request(app).post('/finance/planejamento').set('Cookie', cookie).send({ year: ANO, meses: [{ month: 12, cards: [{ cardId: cartaoId, amount: 300 }] }] })
    await request(app).post('/finance/planejamento').set('Cookie', cookie).send({ year: ANO + 1, meses: [{ month: 1, estimated_income: 500, cards: [{ cardId: cartaoId, amount: 200 }] }] })
    await request(app).post('/finance/cards/expenses/toggle').set('Cookie', cookie).send({ year: ANO, month: 12, cardId: cartaoId, paid: true })
    const forecast = () => request(app).get(`/finance/cards/payoff/projection?year=${ANO}&month=12`).set('Cookie', cookie)
    const response = await forecast()
    expect(response.status).toBe(200)
    expect(response.body.projection).toMatchObject({ status: 'ready', balance: '2800.00', income: '2500.00', card_expenses: '500.00', fixed_bills: '200.00' })

    const outro = await contaComCartao()
    const alheio = await request(app).get(`/finance/cards/payoff/projection?year=${ANO}&month=12`).set('Cookie', outro.cookie)
    expect(alheio.body.months).toEqual([])
    expect(alheio.body.projection.status).toBe('not_applicable')
    expect((await request(app).get(`/finance/cards/payoff/projection?year=${ANO}&month=12`)).status).toBe(401)
    expect((await request(app).get('/finance/cards/payoff/projection?year=2031&month=13').set('Cookie', cookie)).status).toBe(400)

    await request(app).post('/finance/config').set('Cookie', cookie).send({ year: ANO, month: 12, balance: null })
    expect((await forecast()).body.projection).toMatchObject({ status: 'incomplete', missingBalance: true })
    // Clearing one field preserves the unrelated income.
    const config = await request(app).get(`/finance/config?year=${ANO}&month=12`).set('Cookie', cookie)
    expect(config.body.estimated_income).toBe('2000.00')
    expect(config.body.balance).toBeNull()
  })
  it('preserva receita vazia como ausente e aceita zero informado explicitamente', async () => {
    const { cookie, cartaoId } = await contaComCartao()
    const save = (income: number | null) => request(app).post('/finance/planejamento').set('Cookie', cookie).send({ year: ANO, meses: [{ month: 12, estimated_income: income, cards: [{ cardId: cartaoId, amount: 100 }] }] })
    expect((await save(null)).status).toBe(200)
    const forecast = () => request(app).get(`/finance/cards/payoff/projection?year=${ANO}&month=12`).set('Cookie', cookie)
    expect((await forecast()).body.projection).toMatchObject({ status: 'incomplete', missingBalance: true, missingMonths: [{ year: ANO, month: 12, income: true, cards: [] }] })
    await save(0)
    await request(app).post('/finance/config').set('Cookie', cookie).send({ year: ANO, month: 12, balance: 0 })
    expect((await forecast()).body.projection).toMatchObject({ status: 'ready', balance: '-100.00' })
    await save(null)
    expect((await forecast()).body.projection.status).toBe('incomplete')
  })
})
