export interface User {
  id: string
  name: string
  email: string
  password: string
  created_at: Date
  updated_at: Date
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string | null
  title: string
  amount: number
  type: 'income' | 'expense'
  date: string
  notes?: string
  created_at: Date
  updated_at: Date
}

export interface Goal {
  id: string
  user_id: string
  title: string
  target_amount: number
  current_amount: number
  deadline?: string
  created_at: Date
  updated_at: Date
}

export interface JWTPayload {
  userId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}
