import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { betterAuth } from 'better-auth'
import pool from './db/client'

// Better Auth reaproveita a tabela `users` que ja existe, em vez de criar a
// tabela `user` dele. Isso e deliberado: dez tabelas apontam para users.id com
// ON DELETE CASCADE, entao trocar essa tabela apagaria dado financeiro em
// silencio. Mantendo os mesmos UUIDs, todas as chaves estrangeiras continuam
// validas e nenhum dado precisa ser movido.
export const auth = betterAuth({
  database: pool,

  user: {
    modelName: 'users',
    // A tabela existente ja tem created_at e updated_at em snake_case. Sem este
    // mapeamento o Better Auth criaria createdAt e updatedAt em paralelo, e a
    // tabela passaria a ter duas colunas de data significando a mesma coisa,
    // com uma delas sempre desatualizada.
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  emailAndPassword: {
    enabled: true,
    // As senhas existentes estao em bcrypt. O padrao do Better Auth e scrypt,
    // entao a verificacao e sobrescrita para que quem ja tem conta continue
    // entrando com a mesma senha, sem precisar redefinir nada.
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // A sessao viaja em cookie httpOnly entre dominios diferentes (Vercel no
  // front, Render na API), o que exige SameSite=None com Secure.
  advanced: {
    database: {
      // users.id e UUID, e o Better Auth gera ids em formato proprio por
      // padrao - o Postgres rejeita com "invalid input syntax for type uuid".
      // Gerar UUID cobre todos os modelos: nas tabelas do proprio Better Auth
      // o id e text, e um UUID em texto cabe sem problema.
      generateId: () => randomUUID(),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  },

  trustedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
})
