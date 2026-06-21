import { query } from '../db/client'

// TIPOS DE INVESTIMENTO
export async function listTypes(userId: string) {
  const result = await query(
    `SELECT it.*,
       COUNT(i.id) as investment_count,
       COALESCE(SUM(i.invested_amount), 0) as total_invested,
       COALESCE(SUM(i.current_value), 0) as total_current
     FROM investment_types it
     LEFT JOIN investments i ON it.id = i.type_id
     WHERE it.user_id = $1
     GROUP BY it.id
     ORDER BY it.created_at ASC`,
    [userId]
  )
  return result.rows
}

export async function createType(userId: string, data: { name: string; description?: string; color?: string; icon?: string }) {
  const result = await query(
    `INSERT INTO investment_types (user_id, name, description, color, icon)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, data.name, data.description || null, data.color || '#6366f1', data.icon || '📈']
  )
  return result.rows[0]
}

export async function updateType(id: string, userId: string, data: { name?: string; description?: string; color?: string; icon?: string }) {
  const result = await query(
    `UPDATE investment_types SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       color = COALESCE($3, color),
       icon = COALESCE($4, icon),
       updated_at = NOW()
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [data.name, data.description, data.color, data.icon, id, userId]
  )
  if (!result.rows[0]) throw new Error('Tipo não encontrado')
  return result.rows[0]
}

export async function deleteType(id: string, userId: string) {
  await query('DELETE FROM investment_types WHERE id = $1 AND user_id = $2', [id, userId])
}

// INVESTIMENTOS
export async function listInvestments(userId: string, month?: number, year?: number) {
  let whereClause = 'i.user_id = $1'
  const params: unknown[] = [userId]
  let idx = 2

  if (month && year) {
    whereClause += ` AND i.month = $${idx++} AND i.year = $${idx++}`
    params.push(month, year)
  }

  const result = await query(
    `SELECT i.*, it.name as type_name, it.color as type_color, it.icon as type_icon,
       ROUND(((i.current_value - i.invested_amount) / NULLIF(i.invested_amount, 0)) * 100, 2) as return_pct,
       i.current_value - i.invested_amount as profit
     FROM investments i
     JOIN investment_types it ON i.type_id = it.id
     WHERE ${whereClause}
     ORDER BY i.created_at DESC`,
    params
  )
  return result.rows
}

export async function createInvestment(userId: string, data: {
  type_id: string; name: string; invested_amount: number
  current_value?: number; monthly_rate?: number; target_percent?: number
  month?: number; year?: number; notes?: string
}) {
  const result = await query(
    `INSERT INTO investments (user_id, type_id, name, invested_amount, current_value, monthly_rate, target_percent, month, year, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [userId, data.type_id, data.name, data.invested_amount,
     data.current_value ?? data.invested_amount, data.monthly_rate ?? 0,
     data.target_percent ?? 0, data.month ?? null, data.year ?? null, data.notes ?? null]
  )
  return result.rows[0]
}

export async function updateInvestment(id: string, userId: string, data: {
  name?: string; invested_amount?: number; current_value?: number
  monthly_rate?: number; target_percent?: number; notes?: string
}) {
  const result = await query(
    `UPDATE investments SET
       name = COALESCE($1, name),
       invested_amount = COALESCE($2, invested_amount),
       current_value = COALESCE($3, current_value),
       monthly_rate = COALESCE($4, monthly_rate),
       target_percent = COALESCE($5, target_percent),
       notes = COALESCE($6, notes),
       updated_at = NOW()
     WHERE id = $7 AND user_id = $8 RETURNING *`,
    [data.name, data.invested_amount, data.current_value, data.monthly_rate, data.target_percent, data.notes, id, userId]
  )
  if (!result.rows[0]) throw new Error('Investimento não encontrado')
  return result.rows[0]
}

export async function deleteInvestment(id: string, userId: string) {
  await query('DELETE FROM investments WHERE id = $1 AND user_id = $2', [id, userId])
}

export async function getPortfolioSummary(userId: string) {
  const result = await query(
    `SELECT
       it.id as type_id, it.name as type_name, it.color, it.icon,
       COALESCE(SUM(i.invested_amount), 0) as total_invested,
       COALESCE(SUM(i.current_value), 0) as total_current,
       COALESCE(SUM(i.current_value - i.invested_amount), 0) as total_profit,
       COUNT(i.id) as count
     FROM investment_types it
     LEFT JOIN investments i ON it.id = i.type_id AND i.user_id = $1
     WHERE it.user_id = $1
     GROUP BY it.id, it.name, it.color, it.icon
     ORDER BY total_current DESC`,
    [userId]
  )
  return result.rows
}
