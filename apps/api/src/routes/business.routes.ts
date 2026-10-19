import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import * as Sentry from '@sentry/node'
import { authMiddleware } from '../middlewares/auth.middleware'
import * as service from '../services/business.service'
import { businessToday } from '../services/business-calendar'

const router = Router()
router.use(authMiddleware)
const id = z.uuid('Identificador inválido').transform(value => value.toLowerCase())
const date = z.iso.date('Informe uma data válida').refine(value => value >= '1900-01-01' && value <= '2100-12-31', 'Use uma data entre 1900 e 2100')
const amount = z.number().finite().min(0.01).max(999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use até duas casas decimais')
const notes = z.string().trim().max(500).default('')
const client = z.object({ name: z.string().trim().min(1).max(120), contact: z.string().trim().max(200).default(''), notes }).strict()
const subscription = z.object({ id, client_id: id, service_name: z.string().trim().min(1).max(150), amount, interval_months: z.union([z.literal(1),z.literal(3),z.literal(12)]), start_date: date, notes }).strict()
const expense = z.object({ title: z.string().trim().min(1).max(150), category: z.string().trim().max(80).default(''), amount, spent_on: date, notes }).strict()
const route = (action: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { await action(req,res) }
  catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues[0].message }); return }
    if (error instanceof service.BusinessError) { res.status(error.status).json({ error: error.message }); return }
    Sentry.captureException(error)
    res.status(500).json({ error: 'Não foi possível concluir a operação profissional. Tente novamente.' })
  }
}
router.get('/', route(async (req,res) => {
  const today = businessToday()
  const input = z.object({ year: z.coerce.number().int().min(1900).max(2100).default(Number(today.slice(0,4))), month: z.coerce.number().int().min(1).max(12).default(Number(today.slice(5,7))) }).strict().parse(req.query)
  res.json(await service.overview(req.user!.userId,input.year,input.month))
}))
router.post('/clients', route(async (req,res) => res.status(201).json(await service.createClient(req.user!.userId,client.extend({ id }).parse(req.body)))))
router.put('/clients/:id', route(async (req,res) => res.json(await service.updateClient(req.user!.userId,id.parse(req.params.id),client.parse(req.body)))))
router.delete('/clients/:id', route(async (req,res) => { await service.archiveClient(req.user!.userId,id.parse(req.params.id)); res.status(204).end() }))
router.post('/subscriptions', route(async (req,res) => res.status(201).json(await service.createSubscription(req.user!.userId,subscription.parse(req.body)))))
router.put('/subscriptions/:id', route(async (req,res) => res.json(await service.updateSubscription(req.user!.userId,id.parse(req.params.id),z.object({ service_name: z.string().trim().min(1).max(150), notes }).strict().parse(req.body)))))
router.post('/subscriptions/:id/end', route(async (req,res) => res.json(await service.endSubscription(req.user!.userId,id.parse(req.params.id),z.object({ end_date: date }).strict().parse(req.body).end_date))))
router.post('/subscriptions/:id/receipts', route(async (req,res) => res.status(201).json(await service.receive(req.user!.userId,id.parse(req.params.id),z.object({ id, due_on: date, paid_on: date, notes }).strict().parse(req.body)))))
router.delete('/subscriptions/:id/receipts/:receiptId', route(async (req,res) => { await service.voidReceipt(req.user!.userId,id.parse(req.params.id),id.parse(req.params.receiptId)); res.status(204).end() }))
router.post('/expenses', route(async (req,res) => res.status(201).json(await service.createExpense(req.user!.userId,expense.extend({ id }).parse(req.body)))))
router.put('/expenses/:id', route(async (req,res) => res.json(await service.updateExpense(req.user!.userId,id.parse(req.params.id),expense.parse(req.body)))))
router.delete('/expenses/:id', route(async (req,res) => { await service.deleteExpense(req.user!.userId,id.parse(req.params.id)); res.status(204).end() }))
export default router
