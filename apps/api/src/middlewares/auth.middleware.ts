import { Request, Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../auth'

// A sessao agora vem em cookie httpOnly, validada pelo Better Auth contra a
// tabela session, e nao mais de um JWT lido do header Authorization. A
// diferenca pratica e que a sessao passa a ser revogavel: encerra-la no banco
// invalida o acesso na hora, enquanto o JWT valia ate expirar mesmo apos o
// logout.
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!session?.user) {
      res.status(401).json({ error: 'Nao autenticado' })
      return
    }

    // O restante da aplicacao le req.user.userId. O formato e mantido para que
    // controllers e services nao precisem mudar nesta etapa.
    req.user = { userId: session.user.id, email: session.user.email }
    Sentry.setUser({ id: session.user.id })
    next()
  } catch (err) {
    console.error('[authMiddleware]', err)
    Sentry.captureException(err)
    res.status(401).json({ error: 'Sessao invalida' })
  }
}
