import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middlewares/auth.middleware'
import { draftSchema } from '../services/onboarding-domain'
import * as service from '../services/onboarding.service'
import { answer } from '../services/onboarding-ai'
const r = Router()
r.use(authMiddleware)
const version = z.number().int().min(1)
const route = (fn: (req:Request,res:Response) => Promise<unknown>) => async (req:Request,res:Response) => {
  try { await fn(req,res) } catch(e) {
    if (e instanceof z.ZodError) { res.status(400).json({error:'Confira os campos informados.',details:e.issues.map(i => i.path.join('.'))}); return }
    if (e instanceof service.OnboardingError) { res.status(e.status).json({error:e.message}); return }
    // Do not log raw AI/provider errors or SQL parameters containing personal data.
    res.status(500).json({error:'Não foi possível concluir. Seu rascunho foi preservado; tente novamente.'})
  }
}
r.get('/invitation',route(async(req,res) => res.json(await service.invitation(req.user!.userId))))
r.post('/dismiss',route(async(req,res) => {await service.dismiss(req.user!.userId);res.json({ok:true})}))
r.get('/',route(async(req,res) => res.json(await service.getDraft(req.user!.userId))))
r.put('/',route(async(req,res) => {const d=z.object({version,data:draftSchema}).strict().parse(req.body);res.json(await service.saveDraft(req.user!.userId,d.version,d.data))}))
r.post('/discard',route(async(req,res) => {const d=z.object({version}).strict().parse(req.body);res.json(await service.discard(req.user!.userId,d.version))}))
r.post('/answer',route(async(req,res) => {const d=z.object({version,text:z.string().trim().min(1).max(3000),consent:z.literal(true)}).strict().parse(req.body);res.json(await answer(req.user!.userId,d.version,d.text))}))
r.post('/preview',route(async(req,res) => {const d=z.object({version}).strict().parse(req.body);res.json(await service.preview(req.user!.userId,d.version))}))
r.post('/commit',route(async(req,res) => {const d=z.object({version,token:z.string().regex(/^[a-f0-9]{64}$/),request_id:z.uuid(),reference_period:z.string().regex(/^\d{4}-\d{2}$/)}).strict().parse(req.body);res.json(await service.commit(req.user!.userId,d))}))
export default r
