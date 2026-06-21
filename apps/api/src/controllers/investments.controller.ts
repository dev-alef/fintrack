import { Request, Response } from 'express'
import * as S from '../services/investments.service'

const uid = (req: Request) => req.user!.userId

export async function getTypes(req: Request, res: Response) {
  try { res.json(await S.listTypes(uid(req))) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function addType(req: Request, res: Response) {
  try { res.status(201).json(await S.createType(uid(req), req.body)) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function editType(req: Request, res: Response) {
  try { res.json(await S.updateType(req.params.id, uid(req), req.body)) }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Erro' }) }
}
export async function removeType(req: Request, res: Response) {
  try { await S.deleteType(req.params.id, uid(req)); res.json({ ok: true }) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function getInvestments(req: Request, res: Response) {
  try {
    const { month, year } = req.query
    res.json(await S.listInvestments(uid(req), month ? Number(month) : undefined, year ? Number(year) : undefined))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function addInvestment(req: Request, res: Response) {
  try { res.status(201).json(await S.createInvestment(uid(req), req.body)) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function editInvestment(req: Request, res: Response) {
  try { res.json(await S.updateInvestment(req.params.id, uid(req), req.body)) }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Erro' }) }
}
export async function removeInvestment(req: Request, res: Response) {
  try { await S.deleteInvestment(req.params.id, uid(req)); res.json({ ok: true }) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function getPortfolio(req: Request, res: Response) {
  try { res.json(await S.getPortfolioSummary(uid(req))) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
