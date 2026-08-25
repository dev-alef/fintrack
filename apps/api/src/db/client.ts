import { Pool } from 'pg'
import * as Sentry from '@sentry/node'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Erro em cliente ocioso nao pode derrubar o processo: o Neon suspende o
// compute apos inatividade e as conexoes ociosas do pool sao encerradas. O
// pool descarta o cliente com problema e abre outro na proxima query.
pool.on('error', (err) => {
  console.error('Erro inesperado no cliente PostgreSQL ocioso', err)
  Sentry.captureException(err)
})

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log({ query: text, duration: `${duration}ms`, rows: res.rowCount })
  }
  return res
}

export default pool
