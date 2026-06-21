import { Router } from 'express'
import { create, list, update, remove } from '../controllers/goals.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()
router.use(authMiddleware)
router.get('/', list)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
export default router
