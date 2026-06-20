import { Router } from 'express'
import { create, list, getOne, update, remove, summary } from '../controllers/transaction.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/summary', summary)
router.get('/', list)
router.get('/:id', getOne)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
