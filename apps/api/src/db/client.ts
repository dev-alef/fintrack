import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  console.error('Erro inesperado no cliente PostgreSQL', err)
  process.exit(-1)
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
