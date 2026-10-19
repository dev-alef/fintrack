import type { PoolClient } from 'pg'
import pool from '../db/client'
import { businessToday, dueInMonth, summarizeBusiness, type Subscription, type Receipt, type BusinessExpense } from './business-calendar'

export class BusinessError extends Error { constructor(public status: number, message: string) { super(message) } }
const missing = () => new BusinessError(404, 'Registro não encontrado')
const conflict = () => new BusinessError(409, 'Este registro já existe com outros dados. Atualize a página antes de continuar.')
async function transaction<T>(change: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try { await client.query('BEGIN'); const result = await change(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
const money = (amount: number) => amount.toFixed(2)
const matches = (row: Record<string, unknown>, input: Record<string, unknown>) => Object.entries(input).every(([key, value]) => row[key] === value)

export async function overview(userId: string, year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const result = await pool.query(`SELECT
    COALESCE((SELECT jsonb_agg(c ORDER BY c.name, c.id) FROM
      (SELECT id, name, contact, notes, archived FROM professional_clients WHERE user_id = $1) c), '[]') AS clients,
    COALESCE((SELECT jsonb_agg(s ORDER BY s.start_date, s.id) FROM
      (SELECT s.id, s.client_id, c.name AS client_name, s.service_name, s.amount::text, s.interval_months,
       s.start_date::text, s.end_date::text, s.notes FROM service_subscriptions s
       JOIN professional_clients c ON c.id = s.client_id AND c.user_id = s.user_id WHERE s.user_id = $1) s), '[]') AS subscriptions,
    COALESCE((SELECT jsonb_agg(r ORDER BY r.paid_on DESC, r.created_at DESC, r.id) FROM
      (SELECT r.id, r.subscription_id, r.due_on::text, r.paid_on::text, r.amount::text, r.client_name,
       r.service_name, r.notes, r.voided_at, r.created_at FROM professional_receipts r
       JOIN service_subscriptions s ON s.id = r.subscription_id WHERE s.user_id = $1) r), '[]') AS receipts,
    COALESCE((SELECT jsonb_agg(e ORDER BY e.spent_on DESC, e.id) FROM
      (SELECT id, title, category, amount::text, spent_on::text, notes FROM professional_expenses
       WHERE user_id = $1 AND deleted_at IS NULL AND spent_on >= $2::date AND spent_on < ($2::date + interval '1 month')) e), '[]') AS expenses`, [userId, start])
  const raw = result.rows[0] as { clients: unknown[]; subscriptions: Subscription[]; receipts: Receipt[]; expenses: BusinessExpense[] }
  const today = businessToday()
  return { clients: raw.clients, subscriptions: raw.subscriptions, today, year, month, ...summarizeBusiness(raw.subscriptions, raw.receipts, raw.expenses, year, month, today) }
}

export interface ClientInput { id: string; name: string; contact: string; notes: string }
export async function createClient(userId: string, input: ClientInput) {
  return transaction(async client => {
    await client.query(`INSERT INTO professional_clients (id, user_id, name, contact, notes) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [input.id, userId, input.name, input.contact, input.notes])
    const { rows } = await client.query('SELECT * FROM professional_clients WHERE id = $1 AND user_id = $2', [input.id, userId])
    if (!rows[0] || rows[0].archived || !matches(rows[0], input as unknown as Record<string, unknown>)) throw conflict()
    return rows[0]
  })
}
export async function updateClient(userId: string, id: string, data: Omit<ClientInput, 'id'>) {
  const result = await pool.query('UPDATE professional_clients SET name=$3, contact=$4, notes=$5 WHERE id=$1 AND user_id=$2 AND NOT archived RETURNING *', [id, userId, data.name, data.contact, data.notes])
  if (!result.rows[0]) throw missing()
  return result.rows[0]
}
export async function archiveClient(userId: string, id: string) {
  return transaction(async client => {
    const result = await client.query('SELECT id FROM professional_clients WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId])
    if (!result.rows[0]) throw missing()
    const active = await client.query('SELECT id FROM service_subscriptions WHERE client_id=$1 AND (end_date IS NULL OR (end_date >= $2::date AND end_date >= start_date))', [id, businessToday()])
    if (active.rowCount) throw new BusinessError(409, 'Encerre as assinaturas vigentes ou futuras deste cliente antes de arquivá-lo.')
    await client.query('UPDATE professional_clients SET archived=true WHERE id=$1', [id])
  })
}

export interface SubscriptionInput { id: string; client_id: string; service_name: string; amount: number; interval_months: number; start_date: string; notes: string }
export async function createSubscription(userId: string, input: SubscriptionInput) {
  return transaction(async client => {
    const owner = await client.query('SELECT id FROM professional_clients WHERE id=$1 AND user_id=$2 AND NOT archived FOR UPDATE', [input.client_id, userId])
    if (!owner.rows[0]) throw new BusinessError(404, 'Cliente ativo não encontrado')
    await client.query(`INSERT INTO service_subscriptions (id,user_id,client_id,service_name,amount,interval_months,start_date,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [input.id, userId, input.client_id, input.service_name, money(input.amount), input.interval_months, input.start_date, input.notes])
    const result = await client.query('SELECT *, amount::text, start_date::text FROM service_subscriptions WHERE id=$1 AND user_id=$2', [input.id, userId])
    if (!result.rows[0] || !matches(result.rows[0], { ...input, amount: money(input.amount) })) throw conflict()
    return result.rows[0]
  })
}
async function lockSubscription(client: PoolClient, userId: string, id: string) {
  const result = await client.query(`SELECT s.*, s.start_date::text, s.end_date::text, s.amount::text, c.name AS client_name
    FROM service_subscriptions s JOIN professional_clients c ON c.id=s.client_id AND c.user_id=s.user_id
    WHERE s.id=$1 AND s.user_id=$2 FOR UPDATE OF s`, [id, userId])
  if (!result.rows[0]) throw missing()
  return result.rows[0] as Subscription
}
export async function updateSubscription(userId: string, id: string, data: { service_name: string; notes: string }) {
  const result = await pool.query('UPDATE service_subscriptions SET service_name=$3, notes=$4 WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId, data.service_name, data.notes])
  if (!result.rows[0]) throw missing()
  return result.rows[0]
}
export async function endSubscription(userId: string, id: string, endDate: string) {
  return transaction(async client => {
    const subscription = await lockSubscription(client, userId, id)
    if (subscription.end_date && endDate > subscription.end_date) throw new BusinessError(400, 'A data final não pode reabrir um encerramento anterior.')
    const futureReceipt = await client.query('SELECT id FROM professional_receipts WHERE subscription_id=$1 AND due_on > $2::date AND voided_at IS NULL LIMIT 1', [id, endDate])
    if (futureReceipt.rowCount) throw new BusinessError(409, 'Há recebimento confirmado após essa data. Estorne-o antes de antecipar o encerramento.')
    await client.query('UPDATE service_subscriptions SET end_date=$2 WHERE id=$1', [id, endDate])
    return { id, end_date: endDate }
  })
}
export async function receive(userId: string, subscriptionId: string, input: { id: string; due_on: string; paid_on: string; notes: string }) {
  return transaction(async client => {
    const subscription = await lockSubscription(client, userId, subscriptionId)
    const existing = await client.query('SELECT *, due_on::text, paid_on::text FROM professional_receipts WHERE id=$1 AND subscription_id=$2', [input.id, subscriptionId])
    if (existing.rows[0]) {
      if (existing.rows[0].voided_at || !matches(existing.rows[0], input as unknown as Record<string, unknown>)) throw conflict()
      return existing.rows[0]
    }
    if (input.paid_on > businessToday()) throw new BusinessError(400, 'A data de recebimento não pode estar no futuro.')
    if (dueInMonth(subscription, Number(input.due_on.slice(0,4)), Number(input.due_on.slice(5,7))) !== input.due_on) throw new BusinessError(400, 'Esse vencimento não pertence à assinatura.')
    const result = await client.query(`INSERT INTO professional_receipts (id,subscription_id,due_on,paid_on,amount,client_name,service_name,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`, [input.id, subscriptionId, input.due_on, input.paid_on, subscription.amount, subscription.client_name, subscription.service_name, input.notes])
    if (!result.rows[0]) throw new BusinessError(409, 'Esse período já foi recebido ou o identificador já foi utilizado. Atualize a página.')
    return result.rows[0]
  })
}
export async function voidReceipt(userId: string, subscriptionId: string, receiptId: string) {
  return transaction(async client => {
    await lockSubscription(client, userId, subscriptionId)
    const result = await client.query('UPDATE professional_receipts SET voided_at=COALESCE(voided_at,now()) WHERE id=$1 AND subscription_id=$2 RETURNING id', [receiptId, subscriptionId])
    if (!result.rows[0]) throw missing()
  })
}

export interface ExpenseInput { id: string; title: string; category: string; amount: number; spent_on: string; notes: string }
export async function createExpense(userId: string, input: ExpenseInput) {
  if (input.spent_on > businessToday()) throw new BusinessError(400, 'Registre apenas despesas já realizadas.')
  return transaction(async client => {
    await client.query(`INSERT INTO professional_expenses (id,user_id,title,category,amount,spent_on,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [input.id,userId,input.title,input.category,money(input.amount),input.spent_on,input.notes])
    const result = await client.query('SELECT *, amount::text, spent_on::text FROM professional_expenses WHERE id=$1 AND user_id=$2', [input.id,userId])
    if (!result.rows[0] || result.rows[0].deleted_at || !matches(result.rows[0], { ...input, amount: money(input.amount) })) throw conflict()
    return result.rows[0]
  })
}
export async function updateExpense(userId: string, id: string, input: Omit<ExpenseInput, 'id'>) {
  if (input.spent_on > businessToday()) throw new BusinessError(400, 'Registre apenas despesas já realizadas.')
  const result = await pool.query('UPDATE professional_expenses SET title=$3,category=$4,amount=$5,spent_on=$6,notes=$7 WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id', [id,userId,input.title,input.category,money(input.amount),input.spent_on,input.notes])
  if (!result.rows[0]) throw missing()
  return result.rows[0]
}
export async function deleteExpense(userId: string, id: string) {
  const result = await pool.query('UPDATE professional_expenses SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id', [id,userId])
  if (!result.rows[0]) throw missing()
}
