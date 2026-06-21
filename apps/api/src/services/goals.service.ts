import { query } from '../db/client'

export async function createGoal(userId: string, data: {
  title: string
  target_amount: number
  current_amount?: number
  deadline?: string
}) {
  const result = await query(
    `INSERT INTO goals (user_id, title, target_amount, current_amount, deadline)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, data.title, data.target_amount, data.current_amount || 0, data.deadline || null]
  )
  return result.rows[0]
}

export async function listGoals(userId: string) {
  const result = await query(
    `SELECT *,
       ROUND((current_amount / NULLIF(target_amount, 0)) * 100, 1) as progress_pct
     FROM goals
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows
}

export async function updateGoal(id: string, userId: string, data: {
  title?: string
  target_amount?: number
  current_amount?: number
  deadline?: string
}) {
  const existing = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, userId])
  if (existing.rows.length === 0) throw new Error('Meta não encontrada')

  const result = await query(
    `UPDATE goals
     SET title = COALESCE($1, title),
         target_amount = COALESCE($2, target_amount),
         current_amount = COALESCE($3, current_amount),
         deadline = COALESCE($4, deadline),
         updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING *, ROUND((current_amount / NULLIF(target_amount, 0)) * 100, 1) as progress_pct`,
    [data.title, data.target_amount, data.current_amount, data.deadline, id, userId]
  )
  return result.rows[0]
}

export async function deleteGoal(id: string, userId: string) {
  const existing = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, userId])
  if (existing.rows.length === 0) throw new Error('Meta não encontrada')
  await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, userId])
  return true
}
