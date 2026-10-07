import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react'
import api from '@/services/api'
import type { Loan } from '@/lib/loans'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const cents = (value: string) => Math.round(Number(value) * 100)
const fmt = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function LoansSummary({ userId }: { userId: string }) {
  const query = useQuery({ queryKey: ['loans', userId], enabled: !!userId, queryFn: () => api.get<Loan[]>('/loans').then(response => response.data) })
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const pending = (query.data ?? []).filter(loan => cents(loan.remaining_amount) > 0)

  return (
    <section aria-labelledby="loans-summary-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="loans-summary-title" className="flex items-center gap-2 text-sm font-semibold text-text"><HandCoins className="h-4 w-4 text-primary" aria-hidden="true" /> Empréstimos</h3>
          <p className="text-xs text-muted">Pendências atuais, independentemente do mês selecionado. Estes valores não entram no saldo previsto para a quitação dos cartões.</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/emprestimos">Ver todos</Link></Button>
      </div>
      {query.isPending ? (
        <p role="status" className="text-sm text-muted">Carregando empréstimos…</p>
      ) : query.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 p-4 text-sm text-danger">
          Não foi possível carregar os empréstimos.
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['payable', 'receivable'] as const).map(direction => {
              const loans = pending.filter(loan => loan.direction === direction)
              const total = loans.reduce((sum, loan) => sum + cents(loan.remaining_amount), 0)
              const overdue = loans.filter(loan => loan.due_date && loan.due_date < today).reduce((sum, loan) => sum + cents(loan.remaining_amount), 0)
              const payable = direction === 'payable'
              const Icon = payable ? ArrowUpRight : ArrowDownLeft
              return (
                <Card key={direction}>
                  <CardContent className="p-4">
                    <p className="mb-1 flex items-center gap-2 text-xs text-muted"><Icon className="h-4 w-4" aria-hidden="true" />{payable ? 'Eu devo' : 'Me devem'}</p>
                    <p className={cn('text-xl font-bold', payable ? 'text-expense' : 'text-income')}>{fmt(total)}</p>
                    <p className="mt-1 text-xs text-muted">{loans.length} {loans.length === 1 ? 'empréstimo em aberto' : 'empréstimos em aberto'}</p>
                    {overdue > 0 && <p className="mt-1 text-xs text-danger">{fmt(overdue)} em atraso</p>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {pending.length === 0 && <p className="text-sm text-muted">Nenhum empréstimo em aberto. Tudo em dia por aqui.</p>}
        </>
      )}
    </section>
  )
}
