import { query } from '../db/client'

interface TransactionFilters {
  userId: string
  type?: string
  category_id?: string
  month?: string
  year?: string
  page?: number
  limit?: number
}

export async function createTransaction(
  userId: string,
  data: {
    title: string
    amount: number
    type: 'income' | 'expense'
    date: string
    category_id?: string
    notes?: string
  }
) {
  const result = await query(
    `INSERT INTO transactions (user_id, title, amount, type, date, category_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, data.title, data.amount, data.type, data.date, data.category_id || null, data.notes || null]
  )
  return result.rows[0]
}

export async function listTransactions(filters: TransactionFilters) {
  const { userId, type, category_id, month, year, page = 1, limit = 10 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = ['t.user_id = $1']
  const params: unknown[] = [userId]
  let paramIndex = 2

  if (type) {
    conditions.push(`t.type = $${paramIndex++}`)
    params.push(type)
  }

  if (category_id) {
    conditions.push(`t.category_id = $${paramIndex++}`)
    params.push(category_id)
  }

  if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM t.date) = $${paramIndex++}`)
    params.push(Number(month))
    conditions.push(`EXTRACT(YEAR FROM t.date) = $${paramIndex++}`)
    params.push(Number(year))
  } else if (year) {
    conditions.push(`EXTRACT(YEAR FROM t.date) = $${paramIndex++}`)
    params.push(Number(year))
  }

  const where = conditions.join(' AND ')

  const countResult = await query(
    `SELECT COUNT(*) FROM transactions t WHERE ${where}`,
    params
  )
  const total = Number(countResult.rows[0].count)

  const dataResult = await query(
    `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${where}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  )

  return {
    data: dataResult.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getTransactionById(id: string, userId: string) {
  const result = await query(
    `SELECT t.*, c.name as category_name, c.color as category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  )
  return result.rows[0] || null
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: {
    title?: string
    amount?: number
    type?: 'income' | 'expense'
    date?: string
    category_id?: string
    notes?: string
  }
) {
  const transaction = await getTransactionById(id, userId)
  if (!transaction) throw new Error('Transação não encontrada')

  const result = await query(
    `UPDATE transactions
     SET title = COALESCE($1, title),
         amount = COALESCE($2, amount),
         type = COALESCE($3, type),
         date = COALESCE($4, date),
         category_id = COALESCE($5, category_id),
         notes = COALESCE($6, notes),
         updated_at = NOW()
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [data.title, data.amount, data.type, data.date, data.category_id, data.notes, id, userId]
  )
  return result.rows[0]
}

export async function deleteTransaction(id: string, userId: string) {
  const transaction = await getTransactionById(id, userId)
  if (!transaction) throw new Error('Transação não encontrada')

  await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId])
  return true
}

export async function getSummary(userId: string, month?: string, year?: string) {
  const conditions: string[] = ['t.user_id = $1']
  const params: unknown[] = [userId]
  let paramIndex = 2

  if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM t.date) = $${paramIndex++}`)
    params.push(Number(month))
    conditions.push(`EXTRACT(YEAR FROM t.date) = $${paramIndex++}`)
    params.push(Number(year))
  } else if (year) {
    conditions.push(`EXTRACT(YEAR FROM t.date) = $${paramIndex++}`)
    params.push(Number(year))
  }

  const where = conditions.join(' AND ')

  // Totais gerais
  const totalsResult = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as balance
     FROM transactions t
     WHERE ${where}`,
    params
  )

  // Por categoria
  const byCategoryResult = await query(
    `SELECT
       COALESCE(c.name, 'Sem categoria') as category,
       COALESCE(c.color, '#888888') as color,
       COALESCE(c.icon, 'tag') as icon,
       t.type,
       COALESCE(SUM(t.amount), 0) as total,
       COUNT(*) as count
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE ${where}
     GROUP BY COALESCE(c.name, 'Sem categoria'), COALESCE(c.color, '#888888'), COALESCE(c.icon, 'tag'), t.type
     ORDER BY total DESC`,
    params
  )

  // Por mês (últimos 6 meses)
  const byMonthResult = await query(
    `SELECT
       TO_CHAR(t.date, 'YYYY-MM') as month,
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
     FROM transactions t
     WHERE t.user_id = $1
       AND t.date >= NOW() - INTERVAL '6 months'
     GROUP BY TO_CHAR(t.date, 'YYYY-MM')
     ORDER BY month ASC`,
    [userId]
  )

  return {
    totals: totalsResult.rows[0],
    byCategory: byCategoryResult.rows,
    byMonth: byMonthResult.rows,
  }
}
