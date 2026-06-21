import { Request, Response } from 'express'
import * as S from '../services/finance.service'

const uid = (req: Request) => req.user!.userId

// CARTÕES
export async function getCards(req: Request, res: Response) {
  try { res.json(await S.listCards(uid(req))) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function addCard(req: Request, res: Response) {
  try { res.status(201).json(await S.createCard(uid(req), req.body)) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function editCard(req: Request, res: Response) {
  try { res.json(await S.updateCard(req.params.id, uid(req), req.body)) }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Erro' }) }
}
export async function removeCard(req: Request, res: Response) {
  try { await S.deleteCard(req.params.id, uid(req)); res.json({ ok: true }) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}

// FATURAS
export async function getExpenses(req: Request, res: Response) {
  try {
    const { month, year } = req.query
    res.json(await S.getCardExpenses(uid(req), Number(month), Number(year)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function setExpense(req: Request, res: Response) {
  try {
    const { cardId, month, year, amount } = req.body
    res.json(await S.upsertCardExpense(uid(req), cardId, Number(month), Number(year), Number(amount)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function getCardAnnual(req: Request, res: Response) {
  try {
    const { year } = req.query
    res.json(await S.getCardAnnualTotal(uid(req), Number(year)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}

// DESPESAS FIXAS
export async function getBills(req: Request, res: Response) {
  try { res.json(await S.listBills(uid(req))) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function addBill(req: Request, res: Response) {
  try { res.status(201).json(await S.createBill(uid(req), req.body)) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function editBill(req: Request, res: Response) {
  try { res.json(await S.updateBill(req.params.id, uid(req), req.body)) }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Erro' }) }
}
export async function removeBill(req: Request, res: Response) {
  try { await S.deleteBill(req.params.id, uid(req)); res.json({ ok: true }) }
  catch { res.status(500).json({ error: 'Erro interno' }) }
}

// PAGAMENTOS
export async function getPayments(req: Request, res: Response) {
  try {
    const { month, year } = req.query
    res.json(await S.getBillPayments(uid(req), Number(month), Number(year)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function togglePayment(req: Request, res: Response) {
  try {
    const { billId, month, year, paid } = req.body
    res.json(await S.toggleBillPayment(uid(req), billId, Number(month), Number(year), Boolean(paid)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}

// CONFIG MENSAL
export async function getConfig(req: Request, res: Response) {
  try {
    const { month, year } = req.query
    res.json(await S.getMonthlyConfig(uid(req), Number(month), Number(year)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function setConfig(req: Request, res: Response) {
  try {
    const { month, year, ...data } = req.body
    res.json(await S.upsertMonthlyConfig(uid(req), Number(month), Number(year), data))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
export async function getAnnual(req: Request, res: Response) {
  try {
    const { year } = req.query
    res.json(await S.getAnnualSummary(uid(req), Number(year)))
  } catch { res.status(500).json({ error: 'Erro interno' }) }
}
