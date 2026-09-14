import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import * as C from '../controllers/finance.controller'

const r = Router()
r.use(authMiddleware)

// Cartões
r.get('/cards', C.getCards)
r.post('/cards', C.addCard)
r.put('/cards/:id', C.editCard)
r.delete('/cards/:id', C.removeCard)

// Faturas
r.get('/cards/expenses', C.getExpenses)
r.post('/cards/expenses', C.setExpense)
r.get('/cards/annual', C.getCardAnnual)
r.post('/cards/expenses/toggle', C.toggleCardExpense)

// Despesas fixas
r.get('/bills', C.getBills)
r.post('/bills', C.addBill)
r.put('/bills/:id', C.editBill)
r.delete('/bills/:id', C.removeBill)

// Pagamentos
r.get('/payments', C.getPayments)
r.post('/payments/toggle', C.togglePayment)

// Config mensal
r.get('/config', C.getConfig)
r.post('/config', C.setConfig)
r.get('/annual', C.getAnnual)

// Planejamento do ano inteiro: grava varios meses numa transacao so.
r.post('/planejamento', C.salvarPlanejamento)

export default r
