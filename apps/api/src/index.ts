import 'dotenv/config'
import * as Sentry from '@sentry/node'
import express from 'express'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import transactionRoutes from './routes/transaction.routes'
import goalsRoutes from './routes/goals.routes'
import insightsRoutes from './routes/insights.routes'
import financeRoutes from './routes/finance.routes'
import investmentsRoutes from './routes/investments.routes'

// A unica condicao para o Sentry ligar e ter DSN. De proposito: gatilho extra
// em NODE_ENV criaria uma falha silenciosa - se a variavel nao estivesse
// definida no servidor, o Sentry ficaria desligado em producao sem avisar, e o
// projeto pareceria monitorado sem estar. O DSN so e definido em producao, e o
// campo environment abaixo continua separando os ambientes no painel.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      if ((event.request as unknown as Record<string, unknown>).data !== undefined) {
        delete (event.request as unknown as Record<string, unknown>).data
      }
      if (event.request.headers) {
        const headers = event.request.headers as Record<string, unknown>
        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'authorization' || lower === 'cookie' || lower === 'x-csrf-token') {
            delete headers[key]
          }
        }
      }
      if ((event.request as unknown as Record<string, unknown>).cookies) {
        delete (event.request as unknown as Record<string, unknown>).cookies
      }
      // Remove body if present under different key (some SDK versions use 'data' or 'body')
      const reqAny = event.request as unknown as Record<string, unknown>
      if (reqAny.body !== undefined) delete reqAny.body
    }
    if (event.user) {
      const maybeId = (event.user as Record<string, unknown>).id
      if (maybeId) {
        event.user = { id: String(maybeId) }
      } else {
        event.user = undefined
      }
    }
    return event
  },
})

const app = express()
const PORT = process.env.PORT || 3001

// A sessao viaja em cookie, e o navegador recusa credenciais com origin
// curinga. Por isso a lista de origens passa a ser explicita - o antigo
// origin: true refletia qualquer site, o que ja era um achado de auditoria e
// agora deixou de ser sequer possivel.
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: corsOrigins, credentials: true }))

// O handler do Better Auth precisa vir antes do express.json(): ele le o corpo
// da requisicao direto do stream, e um parser antes dele consumiria o stream e
// deixaria o handler sem corpo nenhum.
app.all('/api/auth/*', toNodeHandler(auth))

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/auth', authRoutes)
app.use('/transactions', transactionRoutes)
app.use('/goals', goalsRoutes)
app.use('/insights', insightsRoutes)
app.use('/finance', financeRoutes)
app.use('/investments', investmentsRoutes)

Sentry.setupExpressErrorHandler(app)

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`)
  })
}

export default app
