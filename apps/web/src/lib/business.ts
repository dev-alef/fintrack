export interface BusinessClient { id: string; name: string; contact: string; notes: string; archived: boolean }
export interface Subscription { id: string; client_id: string; client_name: string; service_name: string; amount: string; interval_months: number; start_date: string; end_date: string | null; notes: string }
export interface Due { subscription_id: string; client_name: string; service_name: string; amount: string; due_on: string; receipt_id: string | null; status: 'received' | 'overdue' | 'pending' }
export interface Receipt { id: string; subscription_id: string; client_name: string; service_name: string; amount: string; due_on: string; paid_on: string; notes: string; voided_at: string | null }
export interface BusinessExpense { id: string; title: string; category: string; amount: string; spent_on: string; notes: string }
export interface BusinessData {
  clients: BusinessClient[]; subscriptions: Subscription[]; dues: Due[]; previous: Due[]; receipts: Receipt[]; expenses: BusinessExpense[]; today: string
  totals: { expected: string; received: string; expenses: string; result: string; pending: string; overdue: string; monthly_recurring: string; active_subscriptions: number }
}
