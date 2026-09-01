import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Settings, Receipt, Calendar, AlertCircle, Pencil, Trash2 } from "lucide-react"
import api from "../services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const fmt = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
// Paleta que o usuario escolhe para identificar cada cartao. Sao dados, nao
// decoracao de tema: o valor vai para credit_cards.color, que e VARCHAR(7).
// Precisa ser hex e nao pode virar token - "var(--primary)" nao cabe na coluna
// e faria o cartao mudar de cor junto com o tema, perdendo a distincao visual.
// Hex literal, nao token: este valor vira credit_cards.color, VARCHAR(7) no
// banco - "var(--cat-1)" tem 12 caracteres e o INSERT falharia.
const CARD_COLORS = ["#c67139", "#7a8a5e", "#d89a67", "#a8b389", "#8f4d24", "#c3ceac", "#b05f2d"]

interface Card { id: string; name: string; due_day: number; color: string }
interface Bill { id: string; name: string; amount: string; due_day: number; paid?: boolean; payment_id?: string }
interface CardExpense { card_id: string; card_name: string; color: string; due_day: number; amount: string }
interface Config { estimated_income: string; balance: string; investments: string }
interface AnnualCard { id: string; name: string; color: string; annual_total: string }

export default function FinanceControl() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [newCard, setNewCard] = useState({ name: "", due_day: "", color: "#c67139" })
  const [newBill, setNewBill] = useState({ name: "", amount: "", due_day: "" })
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [showNewCard, setShowNewCard] = useState(false)
  const [showNewBill, setShowNewBill] = useState(false)
  const qc = useQueryClient()

  const inv = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

  const { data: cards = [], isLoading: cardsLoading, isError: cardsError } = useQuery<Card[]>({ queryKey: ["cards"], queryFn: () => api.get("/finance/cards").then((r) => r.data) })
  const { data: bills = [], isLoading: billsLoading, isError: billsError } = useQuery<Bill[]>({ queryKey: ["payments", month, year], queryFn: () => api.get(`/finance/payments?month=${month}&year=${year}`).then((r) => r.data) })
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<CardExpense[]>({ queryKey: ["expenses", month, year], queryFn: () => api.get(`/finance/cards/expenses?month=${month}&year=${year}`).then((r) => r.data) })
  const { data: config, isLoading: configLoading, isError: configError } = useQuery<Config>({ queryKey: ["config", month, year], queryFn: () => api.get(`/finance/config?month=${month}&year=${year}`).then((r) => r.data) })
  const { data: annual = [] } = useQuery<AnnualCard[]>({ queryKey: ["annual", year], queryFn: () => api.get(`/finance/cards/annual?year=${year}`).then((r) => r.data) })
  const { data: annualSummary = [], isLoading: annualLoading } = useQuery<{ month: number; estimated_income: string; total_fixed_bills: string; total_card_expenses: string }[]>({ queryKey: ["annualSummary", year], queryFn: () => api.get(`/finance/annual?year=${year}`).then((r) => r.data) })

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { data: prevConfig } = useQuery<Config>({ queryKey: ["config", prevMonth, prevYear], queryFn: () => api.get(`/finance/config?month=${prevMonth}&year=${prevYear}`).then((r) => r.data) })

  const createCard = useMutation({ mutationFn: (d: unknown) => api.post("/finance/cards", d), onSuccess: () => { inv(["cards"]); setShowNewCard(false); setNewCard({ name: "", due_day: "", color: "#c67139" }) } })
  const updateCard = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; due_day?: number; color?: string }) => api.put(`/finance/cards/${id}`, d), onSuccess: () => { inv(["cards"]); setEditingCard(null) } })
  const deleteCard = useMutation({ mutationFn: (id: string) => api.delete(`/finance/cards/${id}`), onSuccess: () => inv(["cards", "expenses", "annual"]) })
  const createBill = useMutation({ mutationFn: (d: unknown) => api.post("/finance/bills", d), onSuccess: () => { inv(["payments", "annualSummary"]); setShowNewBill(false); setNewBill({ name: "", amount: "", due_day: "" }) } })
  const updateBill = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; amount?: number; due_day?: number }) => api.put(`/finance/bills/${id}`, d), onSuccess: () => { inv(["payments", "annualSummary"]); setEditingBill(null) } })
  const deleteBill = useMutation({ mutationFn: (id: string) => api.delete(`/finance/bills/${id}`), onSuccess: () => inv(["payments", "annualSummary"]) })
  const togglePayment = useMutation({ mutationFn: (d: unknown) => api.post("/finance/payments/toggle", d), onSuccess: () => inv(["payments"]) })
  const setExpense = useMutation({ mutationFn: (d: unknown) => api.post("/finance/cards/expenses", d), onSuccess: () => inv(["expenses", "annual", "annualSummary"]) })
  const saveConfig = useMutation({ mutationFn: (d: unknown) => api.post("/finance/config", d), onSuccess: () => inv(["config", "annualSummary"]) })

  const totalBills = bills.reduce((s: number, b: Bill) => s + Number(b.amount), 0)
  const totalPaid = bills.filter((b: Bill) => b.paid).reduce((s: number, b: Bill) => s + Number(b.amount), 0)
  const totalCards = expenses.reduce((s: number, e: CardExpense) => s + Number(e.amount), 0)
  const estimatedIncome = Number(config?.estimated_income || 0)
  const balance = Number(config?.balance || 0)
  const investments = Number(config?.investments || 0)
  const leftover = estimatedIncome - totalBills - totalCards
  const annualTotal = annualSummary.reduce((s, r) => s + Number(r.estimated_income || 0), 0)
  const annualBills = annualSummary.reduce((s, r) => s + Number(r.total_fixed_bills || 0) + Number(r.total_card_expenses || 0), 0)

  const isLoading = cardsLoading || billsLoading || expensesLoading || configLoading || annualLoading
  const hasError = cardsError || billsError || configError

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Controle Financeiro</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasError && (
        <Card className="border-danger/30 bg-danger/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger">
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> Erro ao carregar dados financeiros.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-[86px] bg-surface-2/50" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { label: "Receita estimada", value: estimatedIncome, tone: "text-income" as const },
            { label: "Mês anterior", value: Number(prevConfig?.estimated_income || 0), tone: "text-primary" as const },
            { label: "Total contas fixas", value: totalBills, tone: "text-warning" as const },
            { label: "Total faturas", value: totalCards, tone: "text-expense" as const },
            { label: "Sobrou no mês", value: leftover, tone: leftover >= 0 ? "text-income" as const : "text-expense" as const },
            { label: "Saldo atual", value: balance, tone: "text-primary" as const },
            { label: "Investimentos", value: investments, tone: "text-income" as const },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="mb-1 text-xs text-muted">{item.label}</p>
                <p className={cn("text-base font-bold", item.tone)}>{fmt(item.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-muted" aria-hidden="true" /> Configuração do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Receita estimada (R$)", key: "estimated_income", val: config?.estimated_income || "" },
              { label: "Saldo atual (R$)", key: "balance", val: config?.balance || "" },
              { label: "Investimentos (R$)", key: "investments", val: config?.investments || "" },
            ].map((f) => (
              <div key={`${f.key}-${month}-${year}`}>
                <Label htmlFor={`fc-${f.key}`} className="mb-1.5 block text-xs">{f.label}</Label>
                <Input
                  id={`fc-${f.key}`}
                  type="number"
                  step="0.01"
                  defaultValue={f.val}
                  onBlur={(e) => saveConfig.mutate({ month, year, [f.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted" aria-hidden="true" /> Faturas dos cartões
            </CardTitle>
            <Button size="sm" onClick={() => setShowNewCard(true)}>+ Cartão</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showNewCard && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                <Input placeholder="Nome do cartão" value={newCard.name} onChange={(e) => setNewCard((n) => ({ ...n, name: e.target.value }))} />
                <Input type="number" placeholder="Dia de vencimento" value={newCard.due_day} onChange={(e) => setNewCard((n) => ({ ...n, due_day: e.target.value }))} />
                <div className="flex flex-wrap gap-1.5">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Selecionar cor ${c}`}
                      aria-pressed={newCard.color === c}
                      onClick={() => setNewCard((n) => ({ ...n, color: c }))}
                      className={cn("h-6 w-6 rounded-full border-2", newCard.color === c ? "border-primary-fg ring-2 ring-ring" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => createCard.mutate({ name: newCard.name, due_day: Number(newCard.due_day), color: newCard.color })}>Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewCard(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {cards.map((c: Card) => {
                const exp = expenses.find((e: CardExpense) => e.card_id === c.id)
                const val = exp ? Number(exp.amount) : 0
                return editingCard?.id === c.id ? (
                  <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                    <Input value={editingCard.name} onChange={(e) => setEditingCard((ec) => (ec ? { ...ec, name: e.target.value } : ec))} />
                    <Input type="number" value={editingCard.due_day} onChange={(e) => setEditingCard((ec) => (ec ? { ...ec, due_day: Number(e.target.value) } : ec))} />
                    <div className="flex flex-wrap gap-1.5">
                      {CARD_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          aria-label={`Selecionar cor ${col}`}
                          aria-pressed={editingCard.color === col}
                          onClick={() => setEditingCard((ec) => (ec ? { ...ec, color: col } : ec))}
                          className={cn("h-5 w-5 rounded-full border-2", editingCard.color === col ? "border-primary-fg ring-2 ring-ring" : "border-transparent")}
                          style={{ background: col }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateCard.mutate({ id: editingCard.id, name: editingCard.name, due_day: editingCard.due_day, color: editingCard.color })}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCard(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div key={`${c.id}-${month}-${year}`} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{c.name} <span className="text-xs font-normal text-muted">venc. dia {c.due_day}</span></p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      defaultValue={val || ""}
                      onBlur={(e) => setExpense.mutate({ cardId: c.id, month, year, amount: Number(e.target.value) })}
                      className="w-[110px] text-right"
                    />
                    <Button variant="ghost" size="icon" aria-label={`Editar cartão ${c.name}`} onClick={() => setEditingCard(c)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir cartão ${c.name}`} onClick={() => deleteCard.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
              {cards.length === 0 && <p className="text-sm text-muted">Nenhum cartão cadastrado</p>}
              {totalCards > 0 && (
                <div className="mt-1 flex justify-between border-t border-border pt-2.5">
                  <span className="text-sm text-muted">Total faturas</span>
                  <span className="text-sm font-bold text-expense">{fmt(totalCards)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-muted" aria-hidden="true" /> Despesas fixas mensais
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewBill(true)}>+ Conta</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewBill && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg p-3">
              <div className="min-w-[140px] flex-1">
                <Label className="mb-1 block text-xs">Nome</Label>
                <Input value={newBill.name} onChange={(e) => setNewBill((n) => ({ ...n, name: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Valor (R$)</Label>
                <Input type="number" step="0.01" value={newBill.amount} onChange={(e) => setNewBill((n) => ({ ...n, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Dia venc.</Label>
                <Input type="number" className="w-[90px]" value={newBill.due_day} onChange={(e) => setNewBill((n) => ({ ...n, due_day: e.target.value }))} />
              </div>
              <Button size="sm" onClick={() => createBill.mutate({ name: newBill.name, amount: Number(newBill.amount), due_day: Number(newBill.due_day) || undefined })}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewBill(false)}>Cancelar</Button>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bills.map((b: Bill) =>
              editingBill?.id === b.id ? (
                <div key={b.id} className="col-span-full flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg p-3">
                  <Input className="min-w-[120px] flex-1" value={editingBill.name} onChange={(e) => setEditingBill((eb) => (eb ? { ...eb, name: e.target.value } : eb))} />
                  <Input className="w-[110px]" type="number" step="0.01" value={editingBill.amount} onChange={(e) => setEditingBill((eb) => (eb ? { ...eb, amount: e.target.value } : eb))} />
                  <Input className="w-[80px]" type="number" value={editingBill.due_day || ""} onChange={(e) => setEditingBill((eb) => (eb ? { ...eb, due_day: Number(e.target.value) } : eb))} />
                  <Button size="sm" onClick={() => updateBill.mutate({ id: editingBill.id, name: editingBill.name, amount: Number(editingBill.amount), due_day: editingBill.due_day })}>✓</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingBill(null)}>✕</Button>
                </div>
              ) : (
                <div key={b.id} className={cn("flex items-center gap-2.5 rounded-lg border bg-bg p-3", b.paid ? "border-success/30" : "border-border")}>
                  <input type="checkbox" checked={!!b.paid} onChange={() => togglePayment.mutate({ billId: b.id, month, year, paid: !b.paid })} className="h-4 w-4 shrink-0 cursor-pointer accent-success" aria-label={`Marcar ${b.name} como ${b.paid ? "pendente" : "paga"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", b.paid ? "text-muted line-through" : "text-text")}>{b.name}</p>
                    {b.due_day ? <p className="text-xs text-muted">vence dia {b.due_day}</p> : null}
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold", b.paid ? "text-muted" : "text-warning")}>{fmt(b.amount)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Editar conta ${b.name}`} onClick={() => setEditingBill(b)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir conta ${b.name}`} onClick={() => deleteBill.mutate(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )
            )}
          </div>
          {bills.length > 0 && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="text-muted">Pagas: {fmt(totalPaid)} / Total: {fmt(totalBills)}</span>
              <span className="font-bold text-warning">Pendente: {fmt(totalBills - totalPaid)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" /> Totais anuais — {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Mês</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Sobrou</TableHead>
                {annual.map((c: AnnualCard) => (
                  <TableHead key={c.id} className="text-right" style={{ color: c.color }}>{c.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((m, i) => {
                const row = annualSummary.find((r) => r.month === i + 1)
                const income = Number(row?.estimated_income || 0)
                const gastos = Number(row?.total_fixed_bills || 0) + Number(row?.total_card_expenses || 0)
                const sob = income - gastos
                const isCurrentMonth = i + 1 === month && year === now.getFullYear()
                return (
                  <TableRow key={m} className={isCurrentMonth ? "bg-primary/10" : ""}>
                    <TableCell className={cn(isCurrentMonth ? "font-bold text-primary" : "text-text")}>{m}</TableCell>
                    <TableCell className="text-right text-income">{income > 0 ? fmt(income) : "-"}</TableCell>
                    <TableCell className="text-right text-expense">{gastos > 0 ? fmt(gastos) : "-"}</TableCell>
                    <TableCell className={cn("text-right", sob >= 0 ? "text-income" : "text-expense")}>{income > 0 ? fmt(sob) : "-"}</TableCell>
                    {annual.map((c: AnnualCard) => {
                      const cardRow = (c as unknown as { monthly_breakdown?: { month: number; amount: string }[] }).monthly_breakdown?.find((b) => b.month === i + 1)
                      return <TableCell key={c.id} className="text-right text-muted">{cardRow ? fmt(cardRow.amount) : "-"}</TableCell>
                    })}
                  </TableRow>
                )
              })}
              <TableRow className="border-t-2 border-border font-bold">
                <TableCell className="text-text">Total</TableCell>
                <TableCell className="text-right text-income">{fmt(annualTotal)}</TableCell>
                <TableCell className="text-right text-expense">{fmt(annualBills)}</TableCell>
                <TableCell className={cn("text-right", annualTotal - annualBills >= 0 ? "text-income" : "text-expense")}>{fmt(annualTotal - annualBills)}</TableCell>
                {annual.map((c: AnnualCard) => (
                  <TableCell key={c.id} className="text-right" style={{ color: c.color }}>
                    {fmt(c.annual_total)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
