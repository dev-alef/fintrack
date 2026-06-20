import { Request, Response } from 'express'
import { z } from 'zod'
import {
  createTransaction,
  listTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getSummary,
} from '../services/transaction.service'

const createSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { message: 'Tipo deve ser income ou expense' }),
  date: z.string().min(1, 'Data é obrigatória'),
  category_id: z.string().uuid().optional(),
  notes: z.string().optional(),
})

const updateSchema = createSchema.partial()

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const data = createSchema.parse(req.body)
    const transaction = await createTransaction(userId, data)
    res.status(201).json(transaction)
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
    const userId = req.user!.userId
    const { type, category_id, month, year, page, limit } = req.query

    const result = await listTransactions({
      userId,
      type: type as string,
      category_id: category_id as string,
      month: month as string,
      year: year as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    })

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { id } = req.params
    const transaction = await getTransactionById(id, userId)

    if (!transaction) {
      res.status(404).json({ error: 'Transação não encontrada' })
      return
    }

    res.json(transaction)
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { id } = req.params
    const data = updateSchema.parse(req.body)
    const transaction = await updateTransaction(id, userId, data)
    res.json(transaction)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message })
      return
    }
    if (err instanceof Error) {
      res.status(404).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { id } = req.params
    await deleteTransaction(id, userId)
    res.json({ message: 'Transação deletada com sucesso' })
  } catch (err) {
    if (err instanceof Error) {
      res.status(404).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function summary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { month, year } = req.query
    const result = await getSummary(userId, month as string, year as string)
    res.json(result)
  } catch (err) {
    console.error('ERRO SUMMARY:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
