export type Direction = 'payable' | 'receivable'

export interface Payment {
  id: string
  amount: string
  paid_on: string
  notes: string
  created_at: string
}

export interface Loan {
  id: string
  direction: Direction
  person: string
  description: string
  amount: string
  paid_amount: string
  remaining_amount: string
  due_date: string | null
  created_at: string
  payments: Payment[]
}
