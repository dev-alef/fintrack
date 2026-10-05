import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import { list, create, update, remove, addPayment, removePayment } from '../controllers/loans.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', list)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
router.post('/:id/payments', addPayment)
router.delete('/:id/payments/:paymentId', removePayment)
export default router
