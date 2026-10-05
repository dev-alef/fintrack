import type { PoolClient } from 'pg'
import pool from '../db/client'

export class LoanError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface LoanInput {
  direction: 'payable' | 'receivable'
  person: string
  description: string
  amount: number
  due_date?: string | null
}

interface PaymentInput {
  id: string
  amount: number
  paid_on: string
  notes: string
}

// Datas civis saem como texto: serializar um Date de meia-noite mudaria o dia
// conforme o fuso do servidor. Valores monetarios continuam decimais em texto.
const SELECT_LOANS = `
  SELECT l.*, l.due_date::text AS due_date,
    COALESCE(p.total, 0)::numeric(12, 2)::text AS paid_amount,
    (l.amount - COALESCE(p.total, 0))::numeric(12, 2)::text AS remaining_amount,
    COALESCE(p.payments, '[]'::json) AS payments
  FROM loans l
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total,
      json_agg(json_build_object(
        'id', id, 'amount', amount::text, 'paid_on', paid_on::text,
        'notes', notes, 'created_at', created_at
      ) ORDER BY paid_on DESC, created_at DESC, id) AS payments
    FROM loan_payments WHERE loan_id = l.id
  ) p ON true
  WHERE l.user_id = $1`

async function getLoan(client: PoolClient, userId: string, id: string) {
  const result = await client.query(`${SELECT_LOANS} AND l.id = $2`, [userId, id])
  if (!result.rows[0]) throw new LoanError(404, 'Empréstimo não encontrado')
  return result.rows[0]
}

export async function listLoans(userId: string) {
  const result = await pool.query(`${SELECT_LOANS} ORDER BY l.created_at DESC, l.id`, [userId])
  return result.rows
}

export async function createLoan(userId: string, data: LoanInput) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `INSERT INTO loans (user_id, direction, person, description, amount, due_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, data.direction, data.person, data.description, data.amount.toFixed(2), data.due_date ?? null],
    )
    const loan = await getLoan(client, userId, result.rows[0].id)
    await client.query('COMMIT')
    return loan
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally { client.release() }
}

const cents = (value: string | number) => Math.round(Number(value) * 100)

// Todas as alteracoes do principal e do historico disputam a mesma linha.
// O saldo e relido DEPOIS do lock: duas quitacoes concorrentes nao podem
// consumir o mesmo valor restante. O controle nao escreve em transactions.
async function changeLoan(
  userId: string,
  id: string,
  change: (client: PoolClient) => Promise<void>,
  removed = false,
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const locked = await client.query('SELECT id FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId])
    if (!locked.rows.length) throw new LoanError(404, 'Empréstimo não encontrado')
    await change(client)
    if (!removed) await client.query('UPDATE loans SET updated_at = now() WHERE id = $1', [id])
    const loan = removed ? undefined : await getLoan(client, userId, id)
    await client.query('COMMIT')
    return loan
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally { client.release() }
}

export async function updateLoan(userId: string, id: string, data: Partial<Omit<LoanInput, 'direction'>>) {
  return changeLoan(userId, id, async (client) => {
    const current = await getLoan(client, userId, id)
    if (data.amount !== undefined && cents(data.amount) < cents(current.paid_amount)) {
      throw new LoanError(409, 'O valor do empréstimo não pode ser menor que o total já pago')
    }
    await client.query(
      `UPDATE loans SET person = $1, description = $2, amount = $3, due_date = $4 WHERE id = $5`,
      [data.person ?? current.person, data.description ?? current.description,
        data.amount === undefined ? current.amount : data.amount.toFixed(2),
        data.due_date === undefined ? current.due_date : data.due_date, id],
    )
  })
}

export async function deleteLoan(userId: string, id: string) {
  await changeLoan(userId, id, async (client) => {
    await client.query('DELETE FROM loans WHERE id = $1', [id])
  }, true)
}

export async function addLoanPayment(userId: string, id: string, data: PaymentInput) {
  return changeLoan(userId, id, async (client) => {
    const existing = await client.query(
      'SELECT amount, paid_on::text, notes FROM loan_payments WHERE id = $1 AND loan_id = $2', [data.id, id],
    )
    if (existing.rows.length) {
      const previous = existing.rows[0]
      if (cents(previous.amount) !== cents(data.amount) || previous.paid_on !== data.paid_on || previous.notes !== data.notes) {
        throw new LoanError(409, 'Este pagamento já foi registrado com outros dados')
      }
      return
    }
    const loan = await getLoan(client, userId, id)
    if (cents(data.amount) > cents(loan.remaining_amount)) {
      throw new LoanError(409, 'O pagamento não pode ser maior que o valor restante')
    }
    const inserted = await client.query(
      `INSERT INTO loan_payments (id, loan_id, amount, paid_on, notes)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [data.id, id, data.amount.toFixed(2), data.paid_on, data.notes],
    )
    if (!inserted.rows.length) throw new LoanError(409, 'Identificador de pagamento já utilizado; tente novamente')
  })
}

export async function deleteLoanPayment(userId: string, id: string, paymentId: string) {
  return changeLoan(userId, id, async (client) => {
    const result = await client.query('DELETE FROM loan_payments WHERE id = $1 AND loan_id = $2 RETURNING id', [paymentId, id])
    if (!result.rows.length) throw new LoanError(404, 'Pagamento não encontrado')
  })
}
