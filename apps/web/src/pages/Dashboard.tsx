import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CartaoIA } from "@/components/cartao-ia"
import { GraficoAno } from "@/components/grafico-ano"
import { DonutCategorias } from "@/components/donut-categorias"
import { Settings, CreditCard, Receipt, Calendar, Wallet, TrendingUp, AlertCircle, Pencil, Trash2 } from "lucide-react"
import api from "../services/api"
import { useSummary } from "../hooks/useTransactions"
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
// Cores de categoria da paleta Organic. Como sao var(), acompanham os tres
// temas - com hex fixo os graficos ficariam indigo num app creme.
function saudacao() {
  const h = new Date().getHours()
  return h < 6 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite"
}

const CARD_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--primary)"]

interface Card { id: string; name: string; due_day: number; color: string }
interface Bill { id: string; name: string; amount: string; due_day: number; paid?: boolean }
interface CardExpense { card_id: string; card_name: string; color: string; amount: string }
interface Config { estimated_income: string; balance: string; investments: string }
interface AnnualCard { id: string; name: string; color: string; annual_total: string; monthly_breakdown?: { month: number; amount: string }[] }

export default function Dashboard() {
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

  const { data: chartData, isLoading: chartLoading, isError: chartError } = useSummary(String(month), String(year))

  const createCard = useMutation({ mutationFn: (d: unknown) => api.post("/finance/cards", d), onSuccess: () => { inv(["cards"]); setShowNewCard(false); setNewCard({ name: "", due_day: "", color: "#c67139" }) } })
  const updateCard = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; due_day?: number; color?: string }) => api.put(`/finance/cards/${id}`, d), onSuccess: () => { inv(["cards"]); setEditingCard(null) } })
  const deleteCard = useMutation({ mutationFn: (id: string) => api.delete(`/finance/cards/${id}`), onSuccess: () => inv(["cards", "expenses", "annual"]) })
  const createBill = useMutation({ mutationFn: (d: unknown) => api.post("/finance/bills", d), onSuccess: () => { inv(["payments", "annualSummary"]); setShowNewBill(false); setNewBill({ name: "", amount: "", due_day: "" }) } })
  const updateBill = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; amount?: number; due_day?: number }) => api.put(`/finance/bills/${id}`, d), onSuccess: () => { inv(["payments", "annualSummary"]); setEditingBill(null) } })
  const deleteBill = useMutation({ mutationFn: (id: string) => api.delete(`/finance/bills/${id}`), onSuccess: () => inv(["payments", "annualSummary"]) })
  const togglePayment = useMutation({ mutationFn: (d: unknown) => api.post("/finance/payments/toggle", d), onSuccess: () => inv(["payments"]) })
  const setExpense = useMutation({ mutationFn: (d: unknown) => api.post("/finance/cards/expenses", d), onSuccess: () => inv(["expenses", "annual", "annualSummary"]) })
  const saveConfig = useMutation({ mutationFn: (d: unknown) => api.post("/finance/config", d), onSuccess: () => inv(["config", "annualSummary"]) })

  const totalBills = bills.reduce((s, b) => s + Number(b.amount), 0)
  const totalPaid = bills.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0)
  const totalCards = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const estimatedIncome = Number(config?.estimated_income || 0)
  const balanceBase = Number(config?.balance || 0)
  const investments = Number(config?.investments || 0)
  const leftover = estimatedIncome - totalBills - totalCards
  const balance = balanceBase + leftover
  const patrimonio = balance + investments
  const annualTotal = annualSummary.reduce((s, r) => s + Number(r.estimated_income || 0), 0)
  const annualExpenses = annualSummary.reduce((s, r) => s + Number(r.total_fixed_bills || 0) + Number(r.total_card_expenses || 0), 0)

  // O grafico passou de "ultimos 6 meses" para o ano inteiro. A serie vem do
  // annualSummary, que a tela ja buscava para a tabela do fim da pagina - nao
  // ha requisicao nova. Meses sem lancamento entram zerados para as 12 colunas
  // existirem sempre: um ano com buracos deixaria o eixo mentiroso.
  const dadosDoAno = Array.from({ length: 12 }, (_, i) => {
    const linha = annualSummary.find((r) => Number(r.month) === i + 1)
    return {
      mes: i + 1,
      entrou: Number(linha?.estimated_income || 0),
      saiu: Number(linha?.total_fixed_bills || 0) + Number(linha?.total_card_expenses || 0),
    }
  })

  const byCategory = chartData?.byCategory || []
  const fatiasPorCategoria = byCategory.map((c: { category: string; total: string }) => ({
    nome: c.category,
    valor: Number(c.total),
  }))

  const isInitialLoading = cardsLoading || billsLoading || expensesLoading || configLoading || annualLoading || chartLoading
  const hasCriticalError = cardsError || billsError || configError || chartError

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted">{saudacao()}</p>
          {/* O titulo acompanha o seletor de mes: dizer "Dashboard" enquanto a
              tela mostra outro mes esconde justamente o que mudou. */}
          <h2 className="mt-1 text-2xl text-text" style={{ fontFamily: "var(--font-heading)" }}>
            {MONTHS[month - 1]} em uma olhada
          </h2>
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

      {hasCriticalError && (
        <Card className="border-danger/30 bg-danger/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Erro ao carregar dados do dashboard. Tente recarregar a página.
          </CardContent>
        </Card>
      )}

      {isInitialLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-[88px] bg-surface-2/50 p-4" /></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Receita estimada", value: estimatedIncome, tone: "text-income" as const },
              { label: "Mês anterior", value: Number(prevConfig?.estimated_income || 0), tone: "text-primary" as const },
              { label: "Contas fixas", value: totalBills, tone: "text-warning" as const },
              { label: "Faturas cartões", value: totalCards, tone: "text-expense" as const },
              { label: "Total a pagar", value: totalBills + totalCards, tone: "text-expense" as const },
              { label: "Sobrou no mês", value: leftover, tone: leftover >= 0 ? "text-income" as const : "text-expense" as const },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <p className="mb-1 text-xs text-muted">{item.label}</p>
                  <p className={cn("text-base font-bold", item.tone)}>{fmt(item.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Patrimônio */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Saldo atual
                </div>
                <p className={cn("text-xl font-bold", balance >= 0 ? "text-primary" : "text-expense")}>{fmt(balance)}</p>
                <p className="mt-1 text-xs text-muted">Saldo base + sobrou no mês</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Investimentos
                </div>
                <p className="text-xl font-bold text-income">{fmt(investments)}</p>
                <p className="mt-1 text-xs text-muted">Valor aplicado</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-surface">
              <CardContent className="p-5">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Patrimônio total
                </div>
                <p className="text-xl font-bold text-primary">{fmt(patrimonio)}</p>
                <p className="mt-1 text-xs text-muted">Saldo + Investimentos</p>
              </CardContent>
            </Card>
          </div>

          {/* Logo abaixo dos numeros: a leitura da IA comenta justamente o que
              a pessoa acabou de ler, e nao teria sentido antes deles. */}
          <CartaoIA
            sobrou={leftover}
            contasFixas={totalBills}
            faturas={totalCards}
            contasPagas={bills.filter((b) => b.paid).length}
            totalContas={bills.length}
            formata={fmt}
          />
        </>
      )}

      {/* Configuração do mês + Faturas dos cartões */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
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
                <Label htmlFor={`dash-${f.key}`} className="mb-1.5 block text-xs">{f.label}</Label>
                <Input
                  id={`dash-${f.key}`}
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
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-muted" aria-hidden="true" /> Faturas dos cartões
            </CardTitle>
            <Button size="sm" onClick={() => setShowNewCard(true)}>+ Cartão</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showNewCard && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                <Input placeholder="Nome do cartão" value={newCard.name} onChange={(e) => setNewCard((n) => ({ ...n, name: e.target.value }))} />
                <Input type="number" placeholder="Dia vencimento" value={newCard.due_day} onChange={(e) => setNewCard((n) => ({ ...n, due_day: e.target.value }))} />
                <div className="flex flex-wrap gap-1.5">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Selecionar cor ${c}`}
                      aria-pressed={newCard.color === c}
                      onClick={() => setNewCard((n) => ({ ...n, color: c }))}
                      className={cn("h-6 w-6 rounded-full border-2 transition", newCard.color === c ? "border-primary-fg ring-2 ring-ring" : "border-transparent")}
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
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text">
                        {c.name} <span className="text-xs font-normal text-muted">dia {c.due_day}</span>
                      </p>
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

      {/* Despesas fixas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="h-4 w-4 text-muted" aria-hidden="true" /> Despesas fixas
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewBill(true)}>+ Conta</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewBill && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg p-3">
              <div className="min-w-[140px] flex-1">
                <Label htmlFor="newBillName" className="mb-1 block text-xs">Nome</Label>
                <Input id="newBillName" value={newBill.name} onChange={(e) => setNewBill((n) => ({ ...n, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="newBillAmount" className="mb-1 block text-xs">Valor (R$)</Label>
                <Input id="newBillAmount" type="number" step="0.01" value={newBill.amount} onChange={(e) => setNewBill((n) => ({ ...n, amount: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="newBillDue" className="mb-1 block text-xs">Dia venc.</Label>
                <Input id="newBillDue" type="number" className="w-[90px]" value={newBill.due_day} onChange={(e) => setNewBill((n) => ({ ...n, due_day: e.target.value }))} />
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
                <div className={cn("flex items-center gap-2.5 rounded-lg border bg-bg p-3", b.paid ? "border-success/30" : "border-border")} key={b.id}>
                  {/* A linha inteira alterna o pagamento, como no desenho. O
                      checkbox nativo virou um ponto redondo, mas continua sendo
                      um controle de verdade: button com aria-pressed, que
                      leitores de tela anunciam como alternavel. */}
                  <button
                    type="button"
                    onClick={() => togglePayment.mutate({ billId: b.id, month, year, paid: !b.paid })}
                    aria-pressed={!!b.paid}
                    aria-label={`Marcar ${b.name} como ${b.paid ? "pendente" : "paga"}`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ background: b.paid ? "var(--success)" : "transparent" }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: b.paid ? "var(--surface)" : "transparent" }}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("truncate text-sm font-medium", b.paid ? "text-muted" : "text-text")}>{b.name}</p>
                    {b.due_day ? <p className="text-xs text-muted">vence dia {b.due_day}</p> : null}
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold tabular-nums", b.paid ? "text-muted" : "text-text")}>{fmt(b.amount)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Editar conta ${b.name}`} onClick={() => setEditingBill(b)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir conta ${b.name}`} onClick={() => deleteBill.mutate(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )
            )}
            {bills.length === 0 && <p className="text-sm text-muted">Nenhuma conta fixa cadastrada</p>}
          </div>
          {bills.length > 0 && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="text-muted">Pagas: {fmt(totalPaid)} / Total: {fmt(totalBills)}</span>
              <span className="font-bold text-warning">Pendente: {fmt(totalBills - totalPaid)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GraficoAno dados={dadosDoAno} mesAtual={month} formata={fmt} />
        <DonutCategorias fatias={fatiasPorCategoria} formata={fmt} />
      </div>

      {/* Tabela anual */}
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
                {["Mês", "Receita", "Gastos", "Sobrou", ...annual.map((c: AnnualCard) => c.name)].map((h, i) => (
                  <TableHead
                    key={i}
                    className={cn(i === 0 ? "text-left" : "text-right", i >= 4 ? "text-primary" : "")}
                    style={i >= 4 ? { color: (annual[i - 4] as AnnualCard)?.color } : undefined}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((m, i) => {
                const row = annualSummary.find((r) => r.month === i + 1)
                const income = Number(row?.estimated_income || 0)
                const gastos = Number(row?.total_fixed_bills || 0) + Number(row?.total_card_expenses || 0)
                const sob = income - gastos
                const isCurrent = i + 1 === month && year === now.getFullYear()
                return (
                  <TableRow key={m} className={isCurrent ? "bg-primary/10" : ""}>
                    <TableCell className={cn("font-medium", isCurrent ? "text-primary font-bold" : "text-text")}>{m}</TableCell>
                    <TableCell className="text-right text-income">{income > 0 ? fmt(income) : "-"}</TableCell>
                    <TableCell className="text-right text-expense">{gastos > 0 ? fmt(gastos) : "-"}</TableCell>
                    <TableCell className={cn("text-right", sob >= 0 ? "text-income" : "text-expense")}>{income > 0 ? fmt(sob) : "-"}</TableCell>
                    {annual.map((c: AnnualCard) => {
                      const cardRow = c.monthly_breakdown?.find((b) => b.month === i + 1)
                      return (
                        <TableCell key={c.id} className="text-right text-muted">
                          {cardRow ? fmt(cardRow.amount) : "-"}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
              <TableRow className="border-t-2 border-border font-bold">
                <TableCell className="text-text">Total</TableCell>
                <TableCell className="text-right text-income">{fmt(annualTotal)}</TableCell>
                <TableCell className="text-right text-expense">{fmt(annualExpenses)}</TableCell>
                <TableCell className={cn("text-right", annualTotal - annualExpenses >= 0 ? "text-income" : "text-expense")}>
                  {fmt(annualTotal - annualExpenses)}
                </TableCell>
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
