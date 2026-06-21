import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import * as C from '../controllers/investments.controller'

const r = Router()
r.use(authMiddleware)
r.get('/types', C.getTypes)
r.post('/types', C.addType)
r.put('/types/:id', C.editType)
r.delete('/types/:id', C.removeType)
r.get('/portfolio', C.getPortfolio)
r.get('/', C.getInvestments)
r.post('/', C.addInvestment)
r.put('/:id', C.editInvestment)
r.delete('/:id', C.removeInvestment)
export default r
