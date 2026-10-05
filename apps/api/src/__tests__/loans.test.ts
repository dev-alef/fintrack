import { randomUUID } from 'crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../index'
import { query } from '../db/client'

// O cadastro usa a autenticacao real; apenas o envio externo de e-mail fica
// desligado. Os emprestimos, sessoes e transacoes rodam no PostgreSQL de teste.
vi.mock('../email', () => ({ enviarEmail: vi.fn().mockResolvedValue(false) }))

const ORIGEM = 'http://localhost:5173'

type Conta = { cookie: string[]; userId: string }
type Emprestimo = {
  id: string
  direction: 'payable' | 'receivable'
  person: string
  description: string
  amount: string
  paid_amount: string
  remaining_amount: string
  due_date: string | null
  payments: Array<{
    id: string
    amount: string
    paid_on: string
    notes: string
    created_at: string
  }>
  created_at: string
}

const usuariosCriados: string[] = []
let minhaConta: Conta
let outraConta: Conta

async function cadastra(): Promise<Conta> {
  const resposta = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGEM)
    .send({
      name: 'Teste Emprestimos',
      email: `loans_${randomUUID()}@teste.com`,
      password: 'senhaDeTeste123',
    })

  // Registra antes das assercoes para limpar tambem um cadastro cuja resposta
  // esteja incompleta. A limpeza nunca toca usuarios fora desta suite.
  if (resposta.body.user?.id) usuariosCriados.push(resposta.body.user.id)
  expect(resposta.status).toBe(200)
  expect(resposta.headers['set-cookie']).toBeTruthy()
  return {
    cookie: resposta.headers['set-cookie'] as unknown as string[],
    userId: resposta.body.user.id,
  }
}

async function cria(
  campos: Record<string, unknown> = {},
  conta = minhaConta,
): Promise<Emprestimo> {
  const resposta = await request(app)
    .post('/loans')
    .set('Cookie', conta.cookie)
    .send({ direction: 'receivable', person: 'Maria', amount: 100, ...campos })
  expect(resposta.status).toBe(201)
  return resposta.body as Emprestimo
}

async function lista(conta = minhaConta): Promise<Emprestimo[]> {
  const resposta = await request(app).get('/loans').set('Cookie', conta.cookie)
  expect(resposta.status).toBe(200)
  expect(Array.isArray(resposta.body)).toBe(true)
  return resposta.body as Emprestimo[]
}

async function le(id: string, conta = minhaConta): Promise<Emprestimo> {
  const emprestimo = (await lista(conta)).find((item) => item.id === id)
  expect(emprestimo).toBeDefined()
  return emprestimo!
}

function paga(
  emprestimoId: string,
  amount: number,
  campos: Record<string, unknown> = {},
  conta = minhaConta,
) {
  return request(app)
    .post(`/loans/${emprestimoId}/payments`)
    .set('Cookie', conta.cookie)
    .send({ id: randomUUID(), amount, paid_on: '2032-02-29', ...campos })
}

function esperaErro(resposta: { status: number; body: { error?: unknown } }, status: number) {
  expect(resposta.status).toBe(status)
  expect(resposta.body.error).toEqual(expect.any(String))
}

beforeAll(async () => {
  minhaConta = await cadastra()
  outraConta = await cadastra()
})

afterAll(async () => {
  if (usuariosCriados.length) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [usuariosCriados])
  }
})

describe('Emprestimos', () => {
  it('exige sessao para listar, cadastrar, editar, excluir e alterar pagamentos', async () => {
    const id = randomUUID()
    const paymentId = randomUUID()
    const respostas = await Promise.all([
      request(app).get('/loans'),
      request(app).post('/loans').send({ direction: 'payable', person: 'Joao', amount: 10 }),
      request(app).put(`/loans/${id}`).send({ person: 'Joao' }),
      request(app).delete(`/loans/${id}`),
      request(app).post(`/loans/${id}/payments`).send({ id: paymentId, amount: 10, paid_on: '2032-02-29' }),
      request(app).delete(`/loans/${id}/payments/${paymentId}`),
    ])
    for (const resposta of respostas) esperaErro(resposta, 401)
  })

  it('cadastra os dois sentidos, normaliza textos e preserva datas sem horario', async () => {
    const receber = await cria({
      person: '  Maria  ',
      description: '  Compra dividida  ',
      amount: 500.25,
      due_date: '2032-02-29',
    })
    const pagar = await cria({ direction: 'payable', person: 'Joao', amount: 20 })

    expect(receber).toMatchObject({
      direction: 'receivable', person: 'Maria', description: 'Compra dividida',
      amount: '500.25', paid_amount: '0.00', remaining_amount: '500.25',
      due_date: '2032-02-29', payments: [],
    })
    expect(receber.id).toEqual(expect.any(String))
    expect(receber.created_at).toEqual(expect.any(String))
    expect(pagar).toMatchObject({ direction: 'payable', due_date: null, description: '' })
    expect(await le(receber.id)).toMatchObject(receber)
  })

  it('registra pagamento parcial, quita exatamente e desfaz reabrindo o saldo', async () => {
    // 0,30 - 0,10 - 0,20 exporia calculos feitos com floats sem centavos.
    const emprestimo = await cria({ amount: 0.3 })
    const parcial = await paga(emprestimo.id, 0.1, { notes: '  Primeira parte  ' })
    expect(parcial.status).toBe(201)
    expect(parcial.body).toMatchObject({ amount: '0.30', paid_amount: '0.10', remaining_amount: '0.20' })
    expect(parcial.body.payments).toHaveLength(1)
    expect(parcial.body.payments[0]).toMatchObject({
      amount: '0.10', paid_on: '2032-02-29', notes: 'Primeira parte',
      created_at: expect.any(String),
    })

    const paymentId = randomUUID()
    const quitado = await paga(emprestimo.id, 0.2, { id: paymentId, paid_on: '2032-03-01' })
    expect(quitado.status).toBe(201)
    expect(quitado.body).toMatchObject({ paid_amount: '0.30', remaining_amount: '0.00' })
    expect(quitado.body.payments).toHaveLength(2)
    expect(quitado.body.payments.find((item: { id: string }) => item.id === paymentId)).toMatchObject({
      paid_on: '2032-03-01', amount: '0.20', notes: '',
    })

    const desfeito = await request(app)
      .delete(`/loans/${emprestimo.id}/payments/${paymentId}`)
      .set('Cookie', minhaConta.cookie)
    expect(desfeito.status).toBe(200)
    expect(desfeito.body).toMatchObject({ paid_amount: '0.10', remaining_amount: '0.20' })
    expect(desfeito.body.payments).toHaveLength(1)
    expect(await le(emprestimo.id)).toMatchObject(desfeito.body)
  })

  it('pagamento acima do restante nao deixa valor nem historico gravado', async () => {
    const emprestimo = await cria({ amount: 100 })
    expect((await paga(emprestimo.id, 40)).status).toBe(201)
    const antes = await le(emprestimo.id)

    esperaErro(await paga(emprestimo.id, 60.01), 409)
    expect(await le(emprestimo.id)).toEqual(antes)
    expect((await paga(emprestimo.id, 60)).status).toBe(201)
    esperaErro(await paga(emprestimo.id, 0.01), 409)
    expect(await le(emprestimo.id)).toMatchObject({ paid_amount: '100.00', remaining_amount: '0.00' })
  })

  it('edita dados e vencimento, mas nao permite principal menor que o ja pago', async () => {
    const emprestimo = await cria({ amount: 100, due_date: '2032-03-01' })
    expect((await paga(emprestimo.id, 40)).status).toBe(201)
    const antes = await le(emprestimo.id)

    const invalido = await request(app)
      .put(`/loans/${emprestimo.id}`)
      .set('Cookie', minhaConta.cookie)
      .send({ amount: 39.99, person: 'Nome que nao deve persistir' })
    esperaErro(invalido, 409)
    expect(await le(emprestimo.id)).toEqual(antes)

    const editado = await request(app)
      .put(`/loans/${emprestimo.id}`)
      .set('Cookie', minhaConta.cookie)
      .send({ amount: 40, person: '  Ana  ', description: '  Acerto  ', due_date: null })
    expect(editado.status).toBe(200)
    expect(editado.body).toMatchObject({
      person: 'Ana', description: 'Acerto', amount: '40.00',
      due_date: null, paid_amount: '40.00', remaining_amount: '0.00', payments: antes.payments,
    })

    const direcao = await request(app)
      .put(`/loans/${emprestimo.id}`)
      .set('Cookie', minhaConta.cookie)
      .send({ direction: 'payable' })
    esperaErro(direcao, 400)
    expect((await le(emprestimo.id)).direction).toBe('receivable')
  })

  it('retry do mesmo pagamento quitado e idempotente, mas conteudo diferente conflita', async () => {
    const emprestimo = await cria({ amount: 75.25 })
    const campos = { id: randomUUID(), notes: 'PIX' }
    const primeiro = await paga(emprestimo.id, 75.25, campos)
    const repetido = await paga(emprestimo.id, 75.25, campos)
    expect(primeiro.status).toBe(201)
    expect(repetido.status).toBe(201)
    expect(repetido.body).toMatchObject({
      id: emprestimo.id, amount: '75.25', paid_amount: '75.25', remaining_amount: '0.00',
      payments: primeiro.body.payments,
    })
    expect(repetido.body.payments).toHaveLength(1)

    esperaErro(await paga(emprestimo.id, 70, campos), 409)
    esperaErro(await paga(emprestimo.id, 75.25, { ...campos, paid_on: '2032-03-01' }), 409)
    esperaErro(await paga(emprestimo.id, 75.25, { ...campos, notes: 'Outro acerto' }), 409)
    expect(await le(emprestimo.id)).toEqual(repetido.body)
  })

  it('retries simultaneos com a mesma chave criam somente um pagamento', async () => {
    const emprestimo = await cria({ amount: 50 })
    const id = randomUUID()
    const respostas = await Promise.all([
      paga(emprestimo.id, 50, { id }),
      paga(emprestimo.id, 50, { id }),
    ])
    expect(respostas.map((resposta) => resposta.status)).toEqual([201, 201])
    expect(await le(emprestimo.id)).toMatchObject({
      paid_amount: '50.00', remaining_amount: '0.00',
      payments: [expect.objectContaining({ id, amount: '50.00' })],
    })
  })

  it('duas quitacoes simultaneas distintas nao ultrapassam o saldo', async () => {
    const emprestimo = await cria({ amount: 50 })
    const respostas = await Promise.all([paga(emprestimo.id, 50), paga(emprestimo.id, 50)])
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
    expect(await le(emprestimo.id)).toMatchObject({
      paid_amount: '50.00', remaining_amount: '0.00',
      payments: [expect.objectContaining({ amount: '50.00' })],
    })
  })

  it('isola emprestimos e pagamentos entre contas, inclusive exclusoes', async () => {
    const meu = await cria({ amount: 90 })
    const alheio = await cria({ person: 'Pessoa privada', amount: 80 }, outraConta)
    const pagamentoAlheio = await paga(alheio.id, 20, { notes: 'Historico privado' }, outraConta)
    expect(pagamentoAlheio.status).toBe(201)
    const paymentId = pagamentoAlheio.body.payments[0].id as string
    const antes = await le(alheio.id, outraConta)

    expect((await lista()).some((item) => item.id === alheio.id)).toBe(false)
    expect((await lista(outraConta)).some((item) => item.id === meu.id)).toBe(false)
    const respostas = await Promise.all([
      request(app).put(`/loans/${alheio.id}`).set('Cookie', minhaConta.cookie).send({ person: 'Invasor' }),
      request(app).delete(`/loans/${alheio.id}`).set('Cookie', minhaConta.cookie),
      paga(alheio.id, 5),
      request(app).delete(`/loans/${alheio.id}/payments/${paymentId}`).set('Cookie', minhaConta.cookie),
      // Ter um emprestimo proprio nao autoriza excluir um pagamento alheio.
      request(app).delete(`/loans/${meu.id}/payments/${paymentId}`).set('Cookie', minhaConta.cookie),
    ])
    for (const resposta of respostas) esperaErro(resposta, 404)
    expect(await le(alheio.id, outraConta)).toEqual(antes)
    expect(await le(meu.id)).toMatchObject({ paid_amount: '0.00', payments: [] })
  })

  it('pagamento de outro emprestimo da mesma conta nao pode ser apagado pelo id errado', async () => {
    const primeiro = await cria()
    const segundo = await cria()
    const pagamento = await paga(primeiro.id, 10)
    expect(pagamento.status).toBe(201)

    const resposta = await request(app)
      .delete(`/loans/${segundo.id}/payments/${pagamento.body.payments[0].id}`)
      .set('Cookie', minhaConta.cookie)
    esperaErro(resposta, 404)
    expect(await le(primeiro.id)).toEqual(pagamento.body)
  })

  it('excluir um emprestimo remove sua listagem e impede operar seu historico', async () => {
    const emprestimo = await cria()
    const pagamento = await paga(emprestimo.id, 30)
    expect(pagamento.status).toBe(201)
    const resposta = await request(app).delete(`/loans/${emprestimo.id}`).set('Cookie', minhaConta.cookie)
    expect(resposta.status).toBe(204)
    expect((await lista()).some((item) => item.id === emprestimo.id)).toBe(false)

    esperaErro(await paga(emprestimo.id, 10), 404)
    esperaErro(await request(app)
      .delete(`/loans/${emprestimo.id}/payments/${pagamento.body.payments[0].id}`)
      .set('Cookie', minhaConta.cookie), 404)
    esperaErro(await request(app).delete(`/loans/${emprestimo.id}`).set('Cookie', minhaConta.cookie), 404)
  })

  it('recusa valores que perderiam centavos e datas que o banco normalizaria', async () => {
    const antes = (await lista()).length
    for (const campos of [
      { amount: 0 }, { amount: -1 }, { amount: 1.001 }, { amount: 1_000_000_000 },
      { person: '   ' }, { person: 'a'.repeat(121) }, { description: 'a'.repeat(301) },
      { direction: 'expense' }, { due_date: '2031-02-29' }, { due_date: '2032-04-31' },
      { due_date: '2032-03-01T00:00:00.000Z' },
    ]) {
      const resposta = await request(app).post('/loans').set('Cookie', minhaConta.cookie)
        .send({ direction: 'payable', person: 'Joao', amount: 100, ...campos })
      esperaErro(resposta, 400)
    }
    expect((await lista()).length).toBe(antes)

    const emprestimo = await cria({ amount: 999_999_999.99 })
    expect(emprestimo.amount).toBe('999999999.99')
    for (const campos of [
      { amount: 0 }, { amount: 0.001 }, { paid_on: '2031-02-29' },
      { paid_on: '2032-03-01T00:00:00.000Z' }, { notes: 'a'.repeat(301) }, { id: 'invalido' },
    ]) {
      esperaErro(await paga(emprestimo.id, 1, campos), 400)
    }
    expect(await le(emprestimo.id)).toEqual(emprestimo)
  })

  it('responde 400 para ids invalidos e 404 para ids validos inexistentes', async () => {
    const emprestimo = await cria()
    for (const [id, status] of [['invalido', 400], [randomUUID(), 404]] as const) {
      const respostas = await Promise.all([
        request(app).put(`/loans/${id}`).set('Cookie', minhaConta.cookie).send({ person: 'Joao' }),
        request(app).delete(`/loans/${id}`).set('Cookie', minhaConta.cookie),
        paga(id, 1),
        request(app).delete(`/loans/${emprestimo.id}/payments/${id}`).set('Cookie', minhaConta.cookie),
      ])
      for (const resposta of respostas) esperaErro(resposta, status)
    }
  })

  it('emprestimos e acertos nao criam transacoes nem alteram planejamento mensal', async () => {
    // A primeira versao e um acompanhamento separado. Um recebimento nao
    // pode inflar o saldo disponivel ou a projecao de dezembro implicitamente.
    const receber = await cria({ amount: 125.5 })
    const pagar = await cria({ direction: 'payable', amount: 200 })
    expect((await paga(receber.id, 125.5)).status).toBe(201)
    expect((await paga(pagar.id, 60)).status).toBe(201)

    const [transacoes, configuracoes] = await Promise.all([
      query('SELECT id FROM transactions WHERE user_id = $1', [minhaConta.userId]),
      query('SELECT id FROM monthly_config WHERE user_id = $1', [minhaConta.userId]),
    ])
    expect(transacoes.rows).toHaveLength(0)
    expect(configuracoes.rows).toHaveLength(0)
  })
})
