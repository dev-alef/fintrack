import { Router } from 'express'
import { getInsights } from '../controllers/insights.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()
router.use(authMiddleware)
router.get('/', getInsights)
export default router
