import { Request, Response } from 'express'
import { generateInsights } from '../services/insights.service'

export async function getInsights(req: Request, res: Response): Promise<void> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'API de IA não configurada. Adicione GEMINI_API_KEY no .env' })
      return
    }
    const userId = req.user!.userId
    const result = await generateInsights(userId)
    res.json(result)
  } catch (err) {
    console.error('Erro nos insights:', err)
    res.status(500).json({ error: 'Erro ao gerar insights' })
  }
}
