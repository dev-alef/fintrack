import type { Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import { z } from 'zod'
import * as service from '../services/loans.service'

const amount = z.number().finite().min(0.01, 'Informe um valor positivo').max(999_999_999.99, 'Valor acima do limite')
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use no máximo duas casas decimais')
const date = z.iso.date('Informe uma data válida no formato AAAA-MM-DD')
  .refine(value => value >= '1900-01-01' && value <= '9999-12-31', 'Data fora do intervalo permitido')
const person = z.string().trim().min(1, 'Informe o nome da pessoa').max(120, 'Nome muito longo')
const description = z.string().trim().max(300, 'Motivo muito longo')
const fields = { person, description, amount, due_date: date.nullable().optional() }
const createSchema = z.object({ ...fields, description: description.default(''), direction: z.enum(['payable', 'receivable']) }).strict()
const updateSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, 'Informe os dados para editar')
const paymentSchema = z.object({
  id: z.uuid('Identificador de pagamento inválido'),
  amount,
  paid_on: date,
  notes: z.string().trim().max(300, 'Observação muito longa').default(''),
}).strict()
const uuid = z.uuid('Identificador inválido')

function fail(res: Response, err: unknown) {
  if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return }
  if (err instanceof service.LoanError) { res.status(err.status).json({ error: err.message }); return }
  Sentry.captureException(err)
  res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' })
}

export async function list(req: Request, res: Response) {
  try { res.json(await service.listLoans(req.user!.userId)) } catch (err) { fail(res, err) }
}

export async function create(req: Request, res: Response) {
  try { res.status(201).json(await service.createLoan(req.user!.userId, createSchema.parse(req.body))) }
  catch (err) { fail(res, err) }
}

export async function update(req: Request, res: Response) {
  try { res.json(await service.updateLoan(req.user!.userId, uuid.parse(req.params.id), updateSchema.parse(req.body))) }
  catch (err) { fail(res, err) }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteLoan(req.user!.userId, uuid.parse(req.params.id))
    res.status(204).end()
  } catch (err) { fail(res, err) }
}

export async function addPayment(req: Request, res: Response) {
  try { res.status(201).json(await service.addLoanPayment(req.user!.userId, uuid.parse(req.params.id), paymentSchema.parse(req.body))) }
  catch (err) { fail(res, err) }
}

export async function removePayment(req: Request, res: Response) {
  try { res.json(await service.deleteLoanPayment(req.user!.userId, uuid.parse(req.params.id), uuid.parse(req.params.paymentId))) }
  catch (err) { fail(res, err) }
}
