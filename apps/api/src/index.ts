import 'dotenv/config'
import * as Sentry from '@sentry/node'
import express from 'express'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth'
import cors from 'cors'
import transactionRoutes from './routes/transaction.routes'
import goalsRoutes from './routes/goals.routes'
import insightsRoutes from './routes/insights.routes'
import financeRoutes from './routes/finance.routes'
import suporteRoutes from './routes/suporte.routes'
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

app.get('/health', (req, res) => {
  const base = { status: 'ok', timestamp: new Date().toISOString() }

  // Diagnostico da cadeia de proxies, desligado por padrao.
  //
  // O rate limiting precisa saber quais saltos do x-forwarded-for sao proxies
  // confiaveis, e isso nao da para deduzir: depende de por onde a requisicao
  // passou (Vercel -> Render) e de quais IPs de saida cada um usa hoje. Ligando
  // DEBUG_IP=1 por um minuto, esta rota mostra a cadeia real; dai os valores vao
  // para TRUSTED_PROXIES e a variavel volta a ficar desligada.
  //
  // So expoe cabecalhos de roteamento - o IP de quem chamou e os proxies pelo
  // caminho. Nada de sessao, cookie ou corpo. Ainda assim fica atras de uma
  // variavel para nao publicar a topologia da infraestrutura sem necessidade.
  if (process.env.DEBUG_IP === '1') {
    return res.json({
      ...base,
      diagnosticoIp: {
        'x-forwarded-for': req.headers['x-forwarded-for'] ?? null,
        'x-real-ip': req.headers['x-real-ip'] ?? null,
        'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'] ?? null,
        'cf-connecting-ip': req.headers['cf-connecting-ip'] ?? null,
        'true-client-ip': req.headers['true-client-ip'] ?? null,
        socket: req.socket.remoteAddress ?? null,
      },
    })
  }

  res.json(base)
})

app.use('/transactions', transactionRoutes)
app.use('/goals', goalsRoutes)
app.use('/insights', insightsRoutes)
app.use('/finance', financeRoutes)
app.use('/investments', investmentsRoutes)
app.use('/suporte', suporteRoutes)

Sentry.setupExpressErrorHandler(app)

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`)
  })
}

export default app
