import pool, { query } from '../db/client'

// ── CARTÕES ──────────────────────────────────────────────
export async function listCards(userId: string) {
  const result = await query(
    'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  )
  return result.rows
}

export async function createCard(userId: string, data: { name: string; due_day: number; color?: string }) {
  const result = await query(
    'INSERT INTO credit_cards (user_id, name, due_day, color) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, data.name, data.due_day, data.color || '#6366f1']
  )
  return result.rows[0]
}

export async function updateCard(id: string, userId: string, data: { name?: string; due_day?: number; color?: string }) {
  const result = await query(
    `UPDATE credit_cards SET
       name = COALESCE($1, name),
       due_day = COALESCE($2, due_day),
       color = COALESCE($3, color),
       updated_at = NOW()
     WHERE id = $4 AND user_id = $5 RETURNING *`,
    [data.name, data.due_day, data.color, id, userId]
  )
  if (!result.rows[0]) throw new Error('Cartão não encontrado')
  return result.rows[0]
}

export async function deleteCard(id: string, userId: string) {
  await query('DELETE FROM credit_cards WHERE id = $1 AND user_id = $2', [id, userId])
}

// ── FATURAS DOS CARTÕES ──────────────────────────────────
export async function getCardExpenses(userId: string, month: number, year: number) {
  const result = await query(
    `SELECT ce.*, cc.name as card_name, cc.color, cc.due_day
     FROM card_expenses ce
     JOIN credit_cards cc ON ce.card_id = cc.id
     WHERE ce.user_id = $1 AND ce.month = $2 AND ce.year = $3`,
    [userId, month, year]
  )
  return result.rows
}

export async function upsertCardExpense(userId: string, cardId: string, month: number, year: number, amount: number) {
  const card = await query('SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2', [cardId, userId])
  if (card.rows.length === 0) throw new Error('Cartão não encontrado')

  const result = await query(
    `INSERT INTO card_expenses (user_id, card_id, month, year, amount)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (card_id, month, year)
     DO UPDATE SET amount = $5, updated_at = NOW()
     RETURNING *`,
    [userId, cardId, month, year, amount]
  )
  return result.rows[0]
}

export async function getCardAnnualTotal(userId: string, year: number) {
  const result = await query(
    `SELECT cc.id, cc.name, cc.color,
       COALESCE(SUM(ce.amount), 0) as annual_total,
       json_agg(json_build_object('month', ce.month, 'amount', ce.amount, 'paid', ce.paid) ORDER BY ce.month) as monthly_breakdown
     FROM credit_cards cc
     LEFT JOIN card_expenses ce ON cc.id = ce.card_id AND ce.year = $2
     WHERE cc.user_id = $1
     GROUP BY cc.id, cc.name, cc.color`,
    [userId, year]
  )
  return result.rows
}

// ── DESPESAS FIXAS ───────────────────────────────────────
export async function listBills(userId: string) {
  const result = await query(
    'SELECT * FROM fixed_bills WHERE user_id = $1 AND active = TRUE ORDER BY due_day ASC NULLS LAST',
    [userId]
  )
  return result.rows
}

export async function createBill(userId: string, data: { name: string; amount: number; due_day?: number }) {
  const result = await query(
    'INSERT INTO fixed_bills (user_id, name, amount, due_day) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, data.name, data.amount, data.due_day || null]
  )
  return result.rows[0]
}

export async function updateBill(id: string, userId: string, data: { name?: string; amount?: number; due_day?: number }) {
  const result = await query(
    `UPDATE fixed_bills SET
       name = COALESCE($1, name),
       amount = COALESCE($2, amount),
       due_day = COALESCE($3, due_day),
       updated_at = NOW()
     WHERE id = $4 AND user_id = $5 RETURNING *`,
    [data.name, data.amount, data.due_day, id, userId]
  )
  if (!result.rows[0]) throw new Error('Conta não encontrada')
  return result.rows[0]
}

export async function deleteBill(id: string, userId: string) {
  await query('UPDATE fixed_bills SET active = FALSE WHERE id = $1 AND user_id = $2', [id, userId])
}

// ── PAGAMENTOS DAS CONTAS ────────────────────────────────
export async function getBillPayments(userId: string, month: number, year: number) {
  const result = await query(
    `SELECT fb.*, bp.paid, bp.paid_at, bp.id as payment_id
     FROM fixed_bills fb
     LEFT JOIN bill_payments bp ON fb.id = bp.bill_id AND bp.month = $2 AND bp.year = $3
     WHERE fb.user_id = $1 AND fb.active = TRUE
     ORDER BY fb.due_day ASC NULLS LAST`,
    [userId, month, year]
  )
  return result.rows
}

export async function toggleBillPayment(userId: string, billId: string, month: number, year: number, paid: boolean) {
  const bill = await query('SELECT id FROM fixed_bills WHERE id = $1 AND user_id = $2', [billId, userId])
  if (bill.rows.length === 0) throw new Error('Conta não encontrada')

  const result = await query(
    `INSERT INTO bill_payments (user_id, bill_id, month, year, paid, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (bill_id, month, year)
     DO UPDATE SET paid = $5, paid_at = $6
     RETURNING *`,
    [userId, billId, month, year, paid, paid ? new Date() : null]
  )
  return result.rows[0]
}

// ── CONFIG MENSAL ────────────────────────────────────────
export async function getMonthlyConfig(userId: string, month: number, year: number) {
  const result = await query(
    'SELECT * FROM monthly_config WHERE user_id = $1 AND month = $2 AND year = $3',
    [userId, month, year]
  )
  return result.rows[0] || null
}

export async function upsertMonthlyConfig(userId: string, month: number, year: number, data: {
  estimated_income?: number
  balance?: number
  investments?: number
}) {
  const result = await query(
    `INSERT INTO monthly_config (user_id, month, year, estimated_income, balance, investments)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, month, year)
     DO UPDATE SET
       estimated_income = COALESCE($4, monthly_config.estimated_income),
       balance = COALESCE($5, monthly_config.balance),
       investments = COALESCE($6, monthly_config.investments),
       updated_at = NOW()
     RETURNING *`,
    [userId, month, year, data.estimated_income ?? null, data.balance ?? null, data.investments ?? null]
  )
  return result.rows[0]
}

export async function getAnnualSummary(userId: string, year: number) {
  const result = await query(
    `SELECT
       mc.month,
       mc.estimated_income,
       mc.balance,
       mc.investments,
       COALESCE((
         SELECT SUM(fb.amount)
         FROM fixed_bills fb
         WHERE fb.user_id = $1 AND fb.active = TRUE
       ), 0) as total_fixed_bills,
       COALESCE((
         SELECT SUM(ce.amount)
         FROM card_expenses ce
         JOIN credit_cards cc ON ce.card_id = cc.id
         WHERE cc.user_id = $1 AND ce.year = $2 AND ce.month = mc.month
       ), 0) as total_card_expenses
     FROM monthly_config mc
     WHERE mc.user_id = $1 AND mc.year = $2
     ORDER BY mc.month ASC`,
    [userId, year]
  )
  return result.rows
}

// ── PLANEJAMENTO DO ANO ──────────────────────────────────

/**
 * Marca a fatura de um cartão como paga, ou desmarca.
 *
 * Espelha toggleBillPayment, inclusive na checagem de dono: sem ela, bastaria
 * mandar o id de um cartão alheio para mexer na fatura de outra pessoa.
 *
 * Cria a linha da fatura se ela ainda não existir. Marcar como paga uma fatura
 * que nunca foi lançada é estranho, mas recusar seria pior: a tela mostra a
 * caixinha, e a pessoa não tem como saber que precisa digitar um valor antes.
 */
export async function toggleCardExpensePayment(
  userId: string,
  cardId: string,
  month: number,
  year: number,
  paid: boolean,
) {
  const cartao = await query('SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2', [cardId, userId])
  if (cartao.rows.length === 0) throw new Error('Cartão não encontrado')

  const result = await query(
    `INSERT INTO card_expenses (user_id, card_id, month, year, amount, paid, paid_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6)
     ON CONFLICT (card_id, month, year)
     DO UPDATE SET paid = $5, paid_at = $6, updated_at = now()
     RETURNING *`,
    [userId, cardId, month, year, paid, paid ? new Date() : null],
  )
  return result.rows[0]
}

export type MesPlanejado = {
  month: number
  estimated_income?: number
  cards?: { cardId: string; amount: number }[]
}

/**
 * Grava vários meses de uma vez — receita estimada e faturas.
 *
 * Tudo numa transação só, e essa é a razão de a função existir em vez de o
 * frontend chamar o endpoint de mês em loop. Gravação parcial num planejamento
 * anual é pior que falha: a pessoa fecharia a tela achando que salvou doze
 * meses e teria salvo cinco, sem nada na interface denunciando quais.
 *
 * Os cartões são conferidos ANTES de qualquer escrita. Um id alheio no meio da
 * lista derruba a operação inteira sem ter gravado nada — em vez de gravar os
 * meses anteriores e falhar no meio.
 */
export async function salvaPlanejamento(userId: string, year: number, meses: MesPlanejado[]) {
  const idsDeCartao = [...new Set(meses.flatMap((m) => (m.cards ?? []).map((c) => c.cardId)))]

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    if (idsDeCartao.length > 0) {
      const donos = await cliente.query(
        'SELECT id FROM credit_cards WHERE user_id = $1 AND id = ANY($2::uuid[])',
        [userId, idsDeCartao],
      )
      if (donos.rows.length !== idsDeCartao.length) {
        throw new Error('Cartão não encontrado')
      }
    }

    let faturas = 0

    for (const mes of meses) {
      if (mes.estimated_income !== undefined) {
        await cliente.query(
          `INSERT INTO monthly_config (user_id, month, year, estimated_income)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, month, year)
           DO UPDATE SET estimated_income = $4, updated_at = now()`,
          [userId, mes.month, year, mes.estimated_income],
        )
      }

      for (const cartao of mes.cards ?? []) {
        // Só o valor: `paid` fica de fora de propósito. Ele é marcado na hora
        // pela caixinha, e sobrescrevê-lo aqui apagaria essa marcação toda vez
        // que alguém salvasse o planejamento.
        await cliente.query(
          `INSERT INTO card_expenses (user_id, card_id, month, year, amount)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (card_id, month, year)
           DO UPDATE SET amount = $5, updated_at = now()`,
          [userId, cartao.cardId, mes.month, year, cartao.amount],
        )
        faturas++
      }
    }

    await cliente.query('COMMIT')
    return { meses: meses.length, faturas }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
