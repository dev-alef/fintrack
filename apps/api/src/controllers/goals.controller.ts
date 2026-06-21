import { Request, Response } from 'express'
import { z } from 'zod'
import { createGoal, listGoals, updateGoal, deleteGoal } from '../services/goals.service'

const createSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  target_amount: z.number().positive('Valor alvo deve ser positivo'),
  current_amount: z.number().min(0).optional(),
  deadline: z.string().optional(),
})

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const data = createSchema.parse(req.body)
    const goal = await createGoal(userId, data)
    res.status(201).json(goal)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const goals = await listGoals(req.user!.userId)
    res.json(goals)
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const goal = await updateGoal(req.params.id, req.user!.userId, req.body)
    res.json(goal)
  } catch (err) {
    if (err instanceof Error) {
      res.status(404).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteGoal(req.params.id, req.user!.userId)
    res.json({ message: 'Meta deletada com sucesso' })
  } catch (err) {
    if (err instanceof Error) {
      res.status(404).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
