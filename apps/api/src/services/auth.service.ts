import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/client'
import { JWTPayload } from '../types'

export async function registerUser(name: string, email: string, password: string) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    throw new Error('Email já cadastrado')
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const result = await query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
    [name, email, hashedPassword]
  )

  return result.rows[0]
}

export async function loginUser(email: string, password: string) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email])
  const user = result.rows[0]

  if (!user) throw new Error('Email ou senha inválidos')

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) throw new Error('Email ou senha inválidos')

  const payload: JWTPayload = { userId: user.id, email: user.email }

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  })

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  })

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  }
}

export function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JWTPayload

    const newAccessToken = jwt.sign(
      { userId: payload.userId, email: payload.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    )

    return newAccessToken
  } catch {
    throw new Error('Refresh token inválido ou expirado')
  }
}
