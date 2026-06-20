import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import transactionRoutes from './routes/transaction.routes'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/auth', authRoutes)
app.use('/transactions', transactionRoutes)

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`)
})

export default app
