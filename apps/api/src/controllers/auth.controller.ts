import { Request, Response } from 'express'
import { z } from 'zod'
import { registerUser, loginUser, refreshAccessToken } from '../services/auth.service'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const data = registerSchema.parse(req.body)
    const user = await registerUser(data.name, data.email, data.password)
    res.status(201).json({ message: 'Usuário criado com sucesso', user })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message })
      return
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body)
    const result = await loginUser(data.email, data.password)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message })
      return
    }
    if (err instanceof Error) {
      res.status(401).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token não fornecido' })
      return
    }
    const accessToken = refreshAccessToken(refreshToken)
    res.json({ accessToken })
  } catch (err) {
    if (err instanceof Error) {
      res.status(401).json({ error: err.message })
      return
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ message: 'Logout realizado com sucesso' })
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user })
}
