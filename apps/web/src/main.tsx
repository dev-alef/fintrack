import React from 'react'
import * as Sentry from '@sentry/react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './components/theme-provider'
import { ErrorFallback } from './components/error-fallback'
import './index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  // Mesma regra do backend: so o DSN decide. Quem controla em quais ambientes
  // o Sentry roda e a configuracao da variavel no painel da Vercel.
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || 'development',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      const req = event.request as unknown as Record<string, unknown>
      if (req.data !== undefined) delete req.data
      if (req.body !== undefined) delete req.body
      if (event.request.headers) {
        const headers = event.request.headers as Record<string, unknown>
        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'authorization' || lower === 'cookie' || lower === 'x-csrf-token') {
            delete headers[key]
          }
        }
      }
      if (req.cookies !== undefined) delete req.cookies
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
