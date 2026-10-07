import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown,
  HandCoins, History, Info, Loader2, Pencil, Plus, Trash2,
} from 'lucide-react'
import api from '@/services/api'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { Direction, Loan, Payment } from '@/lib/loans'

type StatusFilter = 'pending' | 'settled' | 'overdue' | 'all'
type LoansQueryKey = readonly ['loans', string]

interface LoanInput {
  person: string
  description: string
  amount: number
  due_date: string | null
}

const directionLabels: Record<Direction, string> = { payable: 'Eu devo', receivable: 'Me devem' }
const fmt = (value: number | string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const cents = (value: string | number) => Math.round(Number(value) * 100)
const moneyInput = (value: string) => Number(value).toFixed(2).replace('.', ',')
const fmtDate = (value: string) => value.split('-').reverse().join('/')
const modalClass = 'z-[110] max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl'

// Dates are calendar days, not UTC instants. Comparing YYYY-MM-DD strings also
// keeps a due date of today from appearing overdue in Brazilian time zones.
function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount > 0 && amount <= 999999999.99 ? amount : null
}

function errorMessage(error: unknown) {
  if (isAxiosError<{ error?: string }>(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error
  }
  return 'Não foi possível salvar. Verifique sua conexão e tente novamente.'
}

function FormError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{message}</p> : null
}

function LoanEditor({ loan, direction, onClose, onSaved }: {
  loan?: Loan
  direction: Direction
  onClose: () => void
  onSaved: (loan: Loan) => void
}) {
  const [form, setForm] = useState({
    direction: loan?.direction ?? direction,
    person: loan?.person ?? '',
    description: loan?.description ?? '',
    amount: loan ? moneyInput(loan.amount) : '',
    due_date: loan?.due_date ?? '',
  })
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: (input: LoanInput) => loan
      ? api.put<Loan>(`/loans/${loan.id}`, input).then(response => response.data)
      : api.post<Loan>('/loans', { ...input, direction: form.direction }).then(response => response.data),
    onSuccess: onSaved,
    onError: error => setError(errorMessage(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    setError('')
    const amount = parseAmount(form.amount)
    if (!form.person.trim() || !form.description.trim()) {
      setError('Informe a pessoa e o motivo do empréstimo.')
      return
    }
    if (amount === null) {
      setError('Informe um valor maior que zero, até R$ 999.999.999,99, com no máximo duas casas decimais.')
      return
    }
    if (loan && cents(amount) < cents(loan.paid_amount)) {
      setError(`O valor original não pode ser menor que ${fmt(loan.paid_amount)}, que já foi acertado.`)
      return
    }
    mutation.mutate({
      person: form.person.trim(), description: form.description.trim(),
      amount, due_date: form.due_date || null,
    })
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent className={modalClass}>
        <DialogHeader>
          <DialogTitle>{loan ? 'Editar empréstimo' : 'Novo empréstimo'}</DialogTitle>
          <DialogDescription>{loan ? 'Atualize os dados deste empréstimo.' : 'Registre o que você precisa pagar ou receber de alguém.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
            {loan ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text">{directionLabels[loan.direction]}</p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="loan-direction">Tipo de empréstimo</Label>
                <Select value={form.direction} onValueChange={value => setForm(previous => ({ ...previous, direction: value as Direction }))}>
                  <SelectTrigger id="loan-direction"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[120]">
                    <SelectItem value="payable">Eu devo — peguei emprestado</SelectItem>
                    <SelectItem value="receivable">Me devem — emprestei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="loan-person">{form.direction === 'payable' ? 'A quem você deve?' : 'Quem deve a você?'}</Label>
              <Input id="loan-person" value={form.person} onChange={event => setForm(previous => ({ ...previous, person: event.target.value }))} placeholder="Nome da pessoa" required maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loan-description">Motivo</Label>
              <Input id="loan-description" value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} placeholder="Ex.: dinheiro emprestado ou compra dividida" required maxLength={300} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-amount">Valor original (R$)</Label>
                <Input id="loan-amount" inputMode="decimal" value={form.amount} onChange={event => setForm(previous => ({ ...previous, amount: event.target.value }))} placeholder="0,00" required maxLength={15} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-due-date">Vencimento (opcional)</Label>
                <Input id="loan-due-date" type="date" value={form.due_date} onChange={event => setForm(previous => ({ ...previous, due_date: event.target.value }))} max="9999-12-31" />
              </div>
            </div>
            {loan && cents(loan.paid_amount) > 0 && <p className="text-xs text-muted">Já acertado: {fmt(loan.paid_amount)}. O valor original precisa cobrir os pagamentos registrados.</p>}
          </fieldset>
          <FormError message={error} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : loan ? 'Salvar alterações' : 'Criar empréstimo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PaymentEditor({ loan, queryKey, onClose, onSaved }: {
  loan: Loan
  queryKey: LoansQueryKey
  onClose: () => void
  onSaved: (loan: Loan) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ amount: '', paid_on: today(), notes: '' })
  const [error, setError] = useState('')
  // The entire open form is one payment attempt. If its response is lost,
  // changing notes or amount must not create a second payment on retry.
  const [paymentId] = useState(() => crypto.randomUUID())
  const submitted = useRef(false)
  const mutation = useMutation({
    mutationFn: (input: { id: string; amount: number; paid_on: string; notes: string }) =>
      api.post<Loan>(`/loans/${loan.id}/payments`, input).then(response => response.data),
    onSuccess: onSaved,
    onError: error => {
      setError(errorMessage(error))
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  function change(field: keyof typeof form, value: string) {
    if (form[field] === value) return
    setForm(previous => ({ ...previous, [field]: value }))
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    setError('')
    const amount = parseAmount(form.amount)
    if (amount === null) {
      setError('Informe um valor maior que zero, com no máximo duas casas decimais.')
      return
    }
    // A refetch may already include a successfully stored payment whose HTTP
    // response was lost. Let an unchanged retry reach the idempotent endpoint.
    if (!submitted.current && cents(amount) > cents(loan.remaining_amount)) {
      setError(`O pagamento não pode ultrapassar os ${fmt(loan.remaining_amount)} pendentes.`)
      return
    }
    if (!form.paid_on) {
      setError('Informe a data do pagamento.')
      return
    }
    submitted.current = true
    mutation.mutate({ id: paymentId, amount, paid_on: form.paid_on, notes: form.notes.trim() })
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent className={modalClass}>
        <DialogHeader>
          <DialogTitle>{loan.direction === 'payable' ? 'Registrar pagamento' : 'Registrar recebimento'}</DialogTitle>
          <DialogDescription className="break-words">{loan.person} · {loan.description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-4">
          <span className="text-sm text-muted">Falta acertar</span>
          <strong className="text-lg text-text">{fmt(loan.remaining_amount)}</strong>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">{loan.direction === 'payable' ? 'Valor pago (R$)' : 'Valor recebido (R$)'}</Label>
              <div className="flex flex-wrap gap-2">
                <Input id="payment-amount" inputMode="decimal" value={form.amount} onChange={event => change('amount', event.target.value)} placeholder="0,00" required maxLength={15} className="min-w-0 flex-1 basis-36" />
                <Button type="button" variant="outline" onClick={() => change('amount', moneyInput(loan.remaining_amount))}>Valor total</Button>
              </div>
              <p className="text-xs text-muted">Você pode registrar parte do valor ou quitar o restante.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">Data do pagamento</Label>
              <Input id="payment-date" type="date" value={form.paid_on} onChange={event => change('paid_on', event.target.value)} required max="9999-12-31" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">Observação (opcional)</Label>
              <Input id="payment-notes" value={form.notes} onChange={event => change('notes', event.target.value)} placeholder="Ex.: recebido por Pix" maxLength={300} />
            </div>
          </fieldset>
          <FormError message={error} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Confirmar registro'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteConfirmation({ loan, payment, onClose, onDeleted }: {
  loan: Loan
  payment?: Payment
  onClose: () => void
  onDeleted: (loan?: Loan) => void
}) {
  const mutation = useMutation({
    mutationFn: () => payment
      ? api.delete<Loan>(`/loans/${loan.id}/payments/${payment.id}`).then(response => response.data)
      : api.delete(`/loans/${loan.id}`).then(() => undefined),
    onSuccess: onDeleted,
  })

  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent className={modalClass}>
        <DialogHeader>
          <DialogTitle>{payment ? 'Excluir pagamento?' : 'Excluir empréstimo?'}</DialogTitle>
          <DialogDescription className="break-words pt-2 leading-relaxed">
            {payment
              ? `O pagamento de ${fmt(payment.amount)} em ${fmtDate(payment.paid_on)} será removido do empréstimo com ${loan.person}. Esse valor voltará a ficar pendente.`
              : `O empréstimo com ${loan.person}, de ${fmt(loan.amount)}, e todo o histórico de pagamentos serão excluídos. Essa ação não pode ser desfeita.`}
          </DialogDescription>
        </DialogHeader>
        <FormError message={mutation.isError ? errorMessage(mutation.error) : ''} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose} autoFocus>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Excluindo…' : payment ? 'Excluir pagamento' : 'Excluir empréstimo e histórico'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoanCard({ loan, currentDay, onEdit, onPayment, onDelete, onDeletePayment }: {
  loan: Loan
  currentDay: string
  onEdit: () => void
  onPayment: () => void
  onDelete: () => void
  onDeletePayment: (payment: Payment) => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const settled = cents(loan.remaining_amount) === 0
  const overdue = !settled && !!loan.due_date && loan.due_date < currentDay
  const progress = Math.min(100, cents(loan.paid_amount) / cents(loan.amount) * 100)
  const payments = [...loan.payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at))

  return (
    <Card className={cn('min-w-0', overdue && 'border-danger/40')}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="break-words text-base font-semibold text-text">{loan.person}</h3>
            <p className="break-words text-sm text-muted">{loan.description}</p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', settled ? 'bg-success/10 text-success' : overdue ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-muted')}>
            {settled ? 'Quitado' : overdue ? 'Vencido' : 'Pendente'}
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{loan.direction === 'payable' ? 'Falta pagar' : 'Falta receber'}</p>
            <p className={cn('mt-1 text-2xl font-semibold tracking-tight', settled ? 'text-muted' : loan.direction === 'payable' ? 'text-expense' : 'text-income')}>{fmt(loan.remaining_amount)}</p>
          </div>
          <div className="text-sm text-muted">
            <p>Original: <span className="text-text">{fmt(loan.amount)}</span></p>
            <p>{loan.direction === 'payable' ? 'Pago' : 'Recebido'}: <span className="text-text">{fmt(loan.paid_amount)}</span></p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`Quitação do empréstimo com ${loan.person}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
        </div>
        <p className={cn('flex items-center gap-1.5 text-xs', overdue ? 'text-danger' : 'text-muted')}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {loan.due_date ? `Vencimento: ${fmtDate(loan.due_date)}` : 'Sem vencimento definido'}
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {!settled && <Button size="sm" onClick={onPayment}><Plus aria-hidden="true" />{loan.direction === 'payable' ? 'Registrar pagamento' : 'Registrar recebimento'}</Button>}
          <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Editar empréstimo com ${loan.person}`}><Pencil aria-hidden="true" />Editar</Button>
          <Button size="icon" variant="ghost" className="ml-auto h-9 w-9 text-muted hover:text-danger" onClick={onDelete} aria-label={`Excluir empréstimo com ${loan.person}`}><Trash2 aria-hidden="true" /></Button>
        </div>
        <div>
          <button type="button" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen} aria-controls={`loan-history-${loan.id}`} className="flex w-full items-center gap-2 rounded-md py-1 text-left text-sm text-muted hover:text-text">
            <History className="h-4 w-4" aria-hidden="true" />
            Histórico de pagamentos ({payments.length})
            <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', historyOpen && 'rotate-180')} aria-hidden="true" />
          </button>
          <div id={`loan-history-${loan.id}`} hidden={!historyOpen}>
            {payments.length === 0 ? <p className="pt-3 text-sm text-muted">Nenhum pagamento registrado ainda.</p> : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border px-3">
                {payments.map(payment => (
                  <li key={payment.id} className="flex items-start gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                        <span className="text-muted">{fmtDate(payment.paid_on)}</span>
                        <strong className="font-medium text-text">{fmt(payment.amount)}</strong>
                      </div>
                      {payment.notes && <p className="mt-1 break-words text-xs text-muted">{payment.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-muted hover:text-danger" onClick={() => onDeletePayment(payment)} aria-label={`Excluir pagamento de ${fmt(payment.amount)} em ${fmtDate(payment.paid_on)}`}><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Loans() {
  const { data: session } = useSession()
  // Changing accounts also unmounts open forms and their payment attempts.
  return session?.user ? <LoansPage key={session.user.id} userId={session.user.id} /> : null
}

function LoansPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const queryKey: LoansQueryKey = ['loans', userId]
  const [direction, setDirection] = useState<Direction>('payable')
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [editor, setEditor] = useState<{ loan?: Loan } | null>(null)
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null)
  const [deletion, setDeletion] = useState<{ loan: Loan; payment?: Payment } | null>(null)
  const [notice, setNotice] = useState('')
  const query = useQuery({ queryKey, enabled: !!userId, queryFn: () => api.get<Loan[]>('/loans').then(response => response.data) })
  const loans = query.data ?? []
  const currentDay = today()
  const totals = loans.reduce((result, loan) => {
    result[loan.direction] += cents(loan.remaining_amount)
    return result
  }, { payable: 0, receivable: 0 })
  const visibleLoans = loans.filter(loan => loan.direction === direction && (
    filter === 'all' || (filter === 'settled' ? cents(loan.remaining_amount) === 0
      : cents(loan.remaining_amount) > 0 && (filter !== 'overdue' || !!loan.due_date && loan.due_date < currentDay))
  )).sort((a, b) => {
    const aSettled = cents(a.remaining_amount) === 0
    const bSettled = cents(b.remaining_amount) === 0
    if (aSettled !== bSettled) return aSettled ? 1 : -1
    return (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31') || b.created_at.localeCompare(a.created_at)
  })

  function saved(loan: Loan, message: string) {
    queryClient.setQueryData<Loan[]>(queryKey, previous => [...(previous ?? []).filter(item => item.id !== loan.id), loan])
    void queryClient.invalidateQueries({ queryKey })
    setNotice(message)
  }

  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'payable' : event.key === 'End' ? 'receivable' : direction === 'payable' ? 'receivable' : 'payable'
    setDirection(next)
    document.getElementById(`loan-tab-${next}`)?.focus()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Empréstimos</h2>
          <p className="mt-1 text-sm text-muted">Acompanhe o que você deve e o que tem a receber.</p>
        </div>
        <Button onClick={() => { setNotice(''); setEditor({}) }}><Plus aria-hidden="true" />Novo empréstimo</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['payable', 'receivable'] as const).map(type => {
          const Icon = type === 'payable' ? ArrowUpRight : ArrowDownLeft
          const count = loans.filter(loan => loan.direction === type && cents(loan.remaining_amount) > 0).length
          return (
            <Card key={type}>
              <CardContent className="flex items-start justify-between gap-3 p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="text-sm text-muted">{type === 'payable' ? 'Total a pagar' : 'Total a receber'}</p>
                  <p className={cn('mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl', type === 'payable' ? 'text-expense' : 'text-income')}>
                    {query.data ? fmt(totals[type] / 100) : '—'}
                  </p>
                  <p className="mt-2 text-xs text-muted">{query.data ? `${count} ${count === 1 ? 'empréstimo pendente' : 'empréstimos pendentes'}` : 'Aguardando dados'}</p>
                </div>
                <span className={cn('rounded-xl p-2.5', type === 'payable' ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface/60 p-3 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Os valores e pagamentos ficam só neste controle. Eles não alteram seu saldo, patrimônio ou projeções.
      </p>

      {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{notice}</p>}
      {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"><p>{query.data ? 'Não foi possível atualizar os empréstimos. Os dados exibidos podem estar desatualizados.' : 'Não foi possível carregar os empréstimos.'}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>{query.isFetching ? 'Carregando…' : 'Tentar novamente'}</Button></div>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Tipo de empréstimo" className="flex rounded-lg border border-border bg-surface p-1">
          {(['payable', 'receivable'] as const).map(type => (
            <button key={type} id={`loan-tab-${type}`} role="tab" type="button" aria-selected={direction === type} aria-controls="loan-list" tabIndex={direction === type ? 0 : -1} onClick={() => setDirection(type)} onKeyDown={tabKeyDown} className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors', direction === type ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-text')}>
              {directionLabels[type]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="loan-filter" className="text-sm text-muted">Mostrar</Label>
          <Select value={filter} onValueChange={value => setFilter(value as StatusFilter)}>
            <SelectTrigger id="loan-filter" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="settled">Quitados</SelectItem>
              <SelectItem value="overdue">Vencidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="loan-list" role="tabpanel" aria-labelledby={`loan-tab-${direction}`} tabIndex={0}>
        {query.isLoading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Carregando empréstimos…</div>
        ) : !query.data ? null : visibleLoans.length === 0 ? (
          <Card><CardContent className="px-6 py-12 text-center">
            <HandCoins className="mx-auto mb-4 h-10 w-10 text-muted" aria-hidden="true" />
            <h3 className="text-base font-medium text-text">{loans.length === 0 ? 'Seus empréstimos, em um só lugar' : filter === 'settled' ? 'Nenhum empréstimo quitado por aqui' : filter === 'overdue' ? 'Nenhum empréstimo vencido por aqui' : filter === 'pending' ? 'Nenhuma pendência por aqui' : 'Nenhum empréstimo nesta aba'}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{loans.length === 0 ? 'Registre quem você precisa pagar e quem precisa devolver dinheiro a você.' : `Não há registros em “${directionLabels[direction]}” com este filtro.`}</p>
            {loans.length === 0 && <Button variant="outline" className="mt-5" onClick={() => setEditor({})}><Plus aria-hidden="true" />Adicionar primeiro empréstimo</Button>}
          </CardContent></Card>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {visibleLoans.map(loan => <LoanCard key={loan.id} loan={loan} currentDay={currentDay} onEdit={() => { setNotice(''); setEditor({ loan }) }} onPayment={() => { setNotice(''); setPaymentLoan(loan) }} onDelete={() => { setNotice(''); setDeletion({ loan }) }} onDeletePayment={payment => { setNotice(''); setDeletion({ loan, payment }) }} />)}
          </div>
        )}
      </div>

      {editor && <LoanEditor loan={editor.loan} direction={direction} onClose={() => setEditor(null)} onSaved={loan => {
        saved(loan, editor.loan ? 'Empréstimo atualizado.' : 'Empréstimo criado.')
        if (!editor.loan) { setDirection(loan.direction); setFilter('pending') }
        setEditor(null)
      }} />}
      {paymentLoan && <PaymentEditor loan={loans.find(loan => loan.id === paymentLoan.id) ?? paymentLoan} queryKey={queryKey} onClose={() => setPaymentLoan(null)} onSaved={loan => {
        saved(loan, cents(loan.remaining_amount) === 0 ? 'Pagamento registrado. Empréstimo quitado!' : 'Pagamento registrado.')
        setPaymentLoan(null)
      }} />}
      {deletion && <DeleteConfirmation loan={deletion.loan} payment={deletion.payment} onClose={() => setDeletion(null)} onDeleted={loan => {
        if (loan) saved(loan, 'Pagamento excluído. O valor voltou a ficar pendente.')
        else {
          queryClient.setQueryData<Loan[]>(queryKey, previous => (previous ?? []).filter(item => item.id !== deletion.loan.id))
          void queryClient.invalidateQueries({ queryKey })
          setNotice('Empréstimo e histórico excluídos.')
        }
        setDeletion(null)
      }} />}
    </div>
  )
}
