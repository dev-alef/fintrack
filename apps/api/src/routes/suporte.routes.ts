import { Router, Request, Response } from 'express'
import { z } from 'zod'
import * as Sentry from '@sentry/node'
import { authMiddleware } from '../middlewares/auth.middleware'
import { auth } from '../auth'
import { fromNodeHeaders } from 'better-auth/node'
import { enviarEmail, emailHabilitado } from '../email'
import { emailDeSuporte } from '../emails/templates'

const router = Router()
router.use(authMiddleware)

const schema = z.object({
  mensagem: z.string().trim().min(10, 'Descreva o problema com pelo menos 10 caracteres').max(4000),
  // A tela vem do cliente so como contexto. Nao e confiavel nem precisa ser:
  // serve para a equipe saber onde olhar, nao para decidir nada.
  tela: z.string().max(200).optional(),
})

// Limite proprio, em memoria: 3 mensagens por usuario a cada 10 minutos.
//
// O rate limiting do Better Auth so cobre as rotas /api/auth, e sem barreira
// aqui um formulario autenticado vira um jeito de despejar e-mail em cima da
// equipe - ou de queimar a cota do Resend, derrubando junto a verificacao de
// e-mail e a recuperacao de senha, que sao caminhos de acesso a conta.
const JANELA_MS = 10 * 60 * 1000
const MAXIMO = 3
const envios = new Map<string, number[]>()

function excedeuLimite(userId: string): boolean {
  const agora = Date.now()
  const recentes = (envios.get(userId) ?? []).filter((t) => agora - t < JANELA_MS)
  if (recentes.length >= MAXIMO) {
    envios.set(userId, recentes)
    return true
  }
  recentes.push(agora)
  envios.set(userId, recentes)
  return false
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { mensagem, tela } = schema.parse(req.body)
    const userId = req.user!.userId

    if (excedeuLimite(userId)) {
      res.status(429).json({ error: 'Muitas mensagens seguidas. Tente novamente em alguns minutos.' })
      return
    }

    const destino = process.env.SUPPORT_EMAIL
    if (!destino || !emailHabilitado) {
      // Responder "enviado" sem ter enviado seria pior que falhar: a pessoa
      // ficaria esperando um retorno que nunca viria, justamente quando ja esta
      // com um problema.
      console.error('[suporte] SUPPORT_EMAIL ou provedor de e-mail ausente')
      Sentry.captureException(new Error('Suporte sem SUPPORT_EMAIL ou provedor de e-mail configurado'))
      res.status(503).json({ error: 'O canal de suporte está indisponível no momento.' })
      return
    }

    // O nome e o e-mail saem da sessao, nao do corpo da requisicao: assim
    // ninguem abre chamado se passando por outra pessoa.
    const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    const usuario = {
      id: userId,
      nome: sessao?.user?.name ?? 'sem nome',
      email: sessao?.user?.email ?? req.user!.email,
    }

    const { assunto, html, texto } = emailDeSuporte({
      usuario,
      mensagem,
      tela,
      navegador: String(req.headers['user-agent'] ?? '').slice(0, 200),
    })

    const enviado = await enviarEmail({ para: destino, assunto, html, texto })
    if (!enviado) {
      res.status(502).json({ error: 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.' })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0].message })
      return
    }
    console.error('[suporte]', err)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Erro ao enviar mensagem' })
  }
})

export default router
