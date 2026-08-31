import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts"
import { Gem, PieChart as PieIcon, Briefcase, FolderPlus, Calculator, AlertCircle, Pencil, Trash2, Plus } from "lucide-react"
import api from "../services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const fmt = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmtPct = (v: string | number) => `${Number(v).toFixed(2)}%`
// Cores dos graficos e da paleta de tipos de investimento. Hex por dois
// motivos: Recharts recebe cor por prop SVG, nao por CSS; e TYPE_COLORS vira
// investment_types.color, que e VARCHAR(7) no banco e nao comporta um token.
const COLORS = ["#c67139", "#7a8a5e", "#d89a67", "#a8b389", "#8f4d24", "#c3ceac", "#b05f2d", "#6f8a72"]
const ICONS = ["📈", "💰", "🏦", "₿", "🏠", "💎", "📊", "🌍"]
const TYPE_COLORS = ["#c67139", "#7a8a5e", "#d89a67", "#a8b389", "#8f4d24", "#c3ceac", "#b05f2d"]

interface InvestmentType { id: string; name: string; description?: string; color: string; icon: string; total_invested: string; total_current: string }
interface Investment { id: string; type_id: string; type_name: string; type_color: string; type_icon: string; name: string; invested_amount: string; current_value: string; monthly_rate: string; target_percent: string; profit: string; return_pct: string; notes?: string }

// Calculadora de juros compostos
function CompoundCalculator() {
  const [form, setForm] = useState({ initial: "", monthly: "", rate: "", period: "12", rateType: "monthly", periodType: "months" })
  const [result, setResult] = useState<{ months: number; data: { month: number; total: number; invested: number; interest: number }[] } | null>(null)

  function calculate() {
    const initial = Number(form.initial) || 0
    const monthly = Number(form.monthly) || 0
    const period = (Number(form.period) || 12) * (form.periodType === "years" ? 12 : 1)
    let rate = Number(form.rate) / 100

    if (form.rateType === "yearly") rate = Math.pow(1 + rate, 1 / 12) - 1

    const data = []
    let total = initial
    let invested = initial

    for (let m = 1; m <= period; m++) {
      total = total * (1 + rate) + monthly
      invested = initial + monthly * m
      data.push({ month: m, total: Math.round(total * 100) / 100, invested: Math.round(invested * 100) / 100, interest: Math.round((total - invested) * 100) / 100 })
    }
    setResult({ months: period, data })
  }

  const last = result?.data[result.data.length - 1]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted" aria-hidden="true" /> Calculadora de Juros Compostos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Valor inicial (R$)", key: "initial", type: "number", placeholder: "1000" },
            { label: "Aporte mensal (R$)", key: "monthly", type: "number", placeholder: "200" },
            { label: "Taxa de juros (%)", key: "rate", type: "number", placeholder: "1" },
            { label: "Período", key: "period", type: "number", placeholder: "12" },
          ].map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`calc-${f.key}`} className="text-xs">{f.label}</Label>
              <Input
                id={`calc-${f.key}`}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de período</Label>
            <Select value={form.periodType} onValueChange={(v) => setForm((p) => ({ ...p, periodType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="months">Meses</SelectItem>
                <SelectItem value="years">Anos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de taxa</Label>
            <Select value={form.rateType} onValueChange={(v) => setForm((p) => ({ ...p, rateType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={calculate}>Calcular</Button>

        {result && last && (
          <div className="space-y-5 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="bg-bg">
                <CardContent className="p-4 text-center">
                  <p className="mb-1 text-xs text-muted">Total investido</p>
                  <p className="text-lg font-bold text-primary">{fmt(last.invested)}</p>
                </CardContent>
              </Card>
              <Card className="bg-bg">
                <CardContent className="p-4 text-center">
                  <p className="mb-1 text-xs text-muted">Juros gerados</p>
                  <p className="text-lg font-bold text-success">{fmt(last.interest)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-bg">
                <CardContent className="p-4 text-center">
                  <p className="mb-1 text-xs text-muted">Montante final</p>
                  <p className="text-xl font-bold text-warning">{fmt(last.total)}</p>
                </CardContent>
              </Card>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={result.data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fill: "var(--text-2)", fontSize: 11 }} label={{ value: "Meses", position: "insideBottom", offset: -2, fill: "var(--text-2)", fontSize: 11 } as unknown as string} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 11 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 } as React.CSSProperties} />
                <Area type="monotone" dataKey="total" name="Montante" stroke="var(--success)" fill="var(--success)" fillOpacity={0.14} strokeWidth={2} />
                <Area type="monotone" dataKey="invested" name="Investido" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Investments() {
  const qc = useQueryClient()
  const inv = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

  const [showTypeForm, setShowTypeForm] = useState(false)
  const [showInvForm, setShowInvForm] = useState(false)
  const [editingType, setEditingType] = useState<InvestmentType | null>(null)
  const [editingInv, setEditingInv] = useState<Investment | null>(null)
  const [newType, setNewType] = useState({ name: "", description: "", color: "#c67139", icon: "📈" })
  const [newInv, setNewInv] = useState({ type_id: "", name: "", invested_amount: "", current_value: "", monthly_rate: "", target_percent: "", notes: "" })

  const { data: types = [], isLoading: typesLoading, isError: typesError } = useQuery<InvestmentType[]>({ queryKey: ["invTypes"], queryFn: () => api.get("/investments/types").then((r) => r.data) })
  const { data: investments = [], isLoading: invLoading, isError: invError } = useQuery<Investment[]>({ queryKey: ["investments"], queryFn: () => api.get("/investments").then((r) => r.data) })
  const { data: portfolio = [], isLoading: portfolioLoading, isError: portfolioError } = useQuery<(InvestmentType & { total_profit: string; return_pct?: string })[]>({ queryKey: ["portfolio"], queryFn: () => api.get("/investments/portfolio").then((r) => r.data) })

  const totalInvested = portfolio.reduce((s, p) => s + Number(p.total_invested), 0)
  const totalCurrent = portfolio.reduce((s, p) => s + Number(p.total_current), 0)
  const totalProfit = totalCurrent - totalInvested
  const returnPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  const createType = useMutation({ mutationFn: (d: unknown) => api.post("/investments/types", d), onSuccess: () => { inv(["invTypes", "portfolio"]); setShowTypeForm(false); setNewType({ name: "", description: "", color: "#c67139", icon: "📈" }) } })
  const updateType = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; description?: string; color?: string; icon?: string }) => api.put(`/investments/types/${id}`, d), onSuccess: () => { inv(["invTypes", "portfolio"]); setEditingType(null) } })
  const deleteType = useMutation({ mutationFn: (id: string) => api.delete(`/investments/types/${id}`), onSuccess: () => inv(["invTypes", "investments", "portfolio"]) })
  const createInv = useMutation({ mutationFn: (d: unknown) => api.post("/investments", d), onSuccess: () => { inv(["investments", "portfolio", "invTypes"]); setShowInvForm(false); setNewInv({ type_id: "", name: "", invested_amount: "", current_value: "", monthly_rate: "", target_percent: "", notes: "" }) } })
  const updateInv = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; invested_amount?: number; current_value?: number; monthly_rate?: number; target_percent?: number }) => api.put(`/investments/${id}`, d), onSuccess: () => { inv(["investments", "portfolio", "invTypes"]); setEditingInv(null) } })
  const deleteInv = useMutation({ mutationFn: (id: string) => api.delete(`/investments/${id}`), onSuccess: () => inv(["investments", "portfolio", "invTypes"]) })

  const pieData = portfolio.filter((p) => Number(p.total_current) > 0).map((p) => ({ name: p.name, value: Number(p.total_current), color: p.color }))

  const isLoading = typesLoading || invLoading || portfolioLoading
  const hasError = typesError || invError || portfolioError

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
          <Gem className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-text">Investimentos</h2>
      </div>

      {hasError && (
        <Card className="border-danger/30 bg-danger/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger">
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> Erro ao carregar investimentos. Tente novamente.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-[84px] bg-surface-2/50" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total investido", value: fmt(totalInvested), tone: "text-primary" as const },
            { label: "Valor atual", value: fmt(totalCurrent), tone: "text-success" as const },
            { label: "Lucro/Prejuízo", value: fmt(totalProfit), tone: totalProfit >= 0 ? "text-success" as const : "text-danger" as const },
            { label: "Rentabilidade", value: fmtPct(returnPct), tone: returnPct >= 0 ? "text-success" as const : "text-danger" as const },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="mb-1 text-xs text-muted">{item.label}</p>
                <p className={cn("text-lg font-bold", item.tone)}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {portfolio.length > 0 && !isLoading && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieIcon className="h-4 w-4 text-muted" aria-hidden="true" /> Distribuição da carteira
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                    {pieData.map((p, i) => (
                      <Cell key={i} fill={p.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 } as React.CSSProperties} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Por categoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolio.map((p) => {
                const pct = totalCurrent > 0 ? (Number(p.total_current) / totalCurrent) * 100 : 0
                const profit = Number(p.total_current) - Number(p.total_invested)
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-sm text-text">{p.icon} {p.name}</span>
                      <span className="text-sm font-semibold" style={{ color: p.color }}>{fmt(p.total_current)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted">{pct.toFixed(1)}% da carteira</span>
                      <span className={cn("text-xs", profit >= 0 ? "text-success" : "text-danger")}>
                        {profit >= 0 ? "+" : ""}{fmt(profit)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FolderPlus className="h-4 w-4 text-muted" aria-hidden="true" /> Tipos de investimento
          </CardTitle>
          <Button size="sm" onClick={() => setShowTypeForm(!showTypeForm)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Tipo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showTypeForm && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-bg p-4">
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={newType.name} onChange={(e) => setNewType((n) => ({ ...n, name: e.target.value }))} />
              </div>
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={newType.description} placeholder="Ex: Ações, FIIs..." onChange={(e) => setNewType((n) => ({ ...n, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      aria-label={`Selecionar ícone ${ic}`}
                      aria-pressed={newType.icon === ic}
                      onClick={() => setNewType((n) => ({ ...n, icon: ic }))}
                      className={cn("rounded-md border px-2.5 py-1.5 text-base transition", newType.icon === ic ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-text hover:bg-surface-2")}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Selecionar cor ${c}`}
                      aria-pressed={newType.color === c}
                      onClick={() => setNewType((n) => ({ ...n, color: c }))}
                      className={cn("h-6 w-6 rounded-full border-2", newType.color === c ? "border-primary-fg ring-2 ring-ring" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createType.mutate(newType)}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setShowTypeForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <div key={t.id} className="rounded-lg border bg-bg p-3.5" style={{ borderColor: t.color }}>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-lg" aria-hidden="true">{t.icon}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Editar tipo ${t.name}`} onClick={() => setEditingType(t)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir tipo ${t.name}`} onClick={() => deleteType.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: t.color }}>{t.name}</p>
                {t.description && <p className="mb-1 text-xs text-muted">{t.description}</p>}
                <p className="text-xs text-muted">{fmt(t.total_current)}</p>
              </div>
            ))}
            {types.length === 0 && !isLoading && <p className="text-sm text-muted">Nenhum tipo cadastrado ainda</p>}
          </div>

          {editingType && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-bg p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={editingType.name} onChange={(e) => setEditingType((et) => (et ? { ...et, name: e.target.value } : et))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={editingType.description || ""} onChange={(e) => setEditingType((et) => (et ? { ...et, description: e.target.value } : et))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone</Label>
                <div className="flex gap-1.5">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      aria-label={`Selecionar ícone ${ic}`}
                      aria-pressed={editingType.icon === ic}
                      onClick={() => setEditingType((et) => (et ? { ...et, icon: ic } : et))}
                      className={cn("rounded-md border px-2.5 py-1.5 text-base", editingType.icon === ic ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface")}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateType.mutate({ id: editingType.id, name: editingType.name, description: editingType.description, color: editingType.color, icon: editingType.icon })}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingType(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-muted" aria-hidden="true" /> Meus investimentos
          </CardTitle>
          <Button size="sm" onClick={() => setShowInvForm(!showInvForm)} disabled={types.length === 0}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Investimento
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {types.length === 0 && <p className="text-sm text-muted">Crie um tipo de investimento primeiro</p>}

          {showInvForm && (
            <div className="grid gap-3 rounded-lg border border-border bg-bg p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={newInv.type_id} onValueChange={(v) => setNewInv((n) => ({ ...n, type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {[
                { label: "Nome", key: "name", placeholder: "Ex: Tesouro Selic" },
                { label: "Valor investido (R$)", key: "invested_amount", placeholder: "1000" },
                { label: "Valor atual (R$)", key: "current_value", placeholder: "1050" },
                { label: "Taxa mensal (%)", key: "monthly_rate", placeholder: "1.0" },
                { label: "Meta da carteira (%)", key: "target_percent", placeholder: "30" },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input placeholder={f.placeholder} value={newInv[f.key as keyof typeof newInv]} onChange={(e) => setNewInv((n) => ({ ...n, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">Observações</Label>
                <Input value={newInv.notes} onChange={(e) => setNewInv((n) => ({ ...n, notes: e.target.value }))} />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    createInv.mutate({
                      ...newInv,
                      invested_amount: Number(newInv.invested_amount),
                      current_value: Number(newInv.current_value) || Number(newInv.invested_amount),
                      monthly_rate: Number(newInv.monthly_rate),
                      target_percent: Number(newInv.target_percent),
                    })
                  }
                >
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowInvForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {investments.map((inv) => {
              const profit = Number(inv.profit)
              const pct = Number(inv.return_pct) || 0
              return editingInv?.id === inv.id ? (
                <Card key={inv.id} className="bg-bg">
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: "Nome", key: "name", val: editingInv.name },
                      { label: "Valor investido", key: "invested_amount", val: editingInv.invested_amount },
                      { label: "Valor atual", key: "current_value", val: editingInv.current_value },
                      { label: "Taxa mensal (%)", key: "monthly_rate", val: editingInv.monthly_rate },
                      { label: "Meta (%)", key: "target_percent", val: editingInv.target_percent },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-xs">{f.label}</Label>
                        <Input value={f.val} onChange={(e) => setEditingInv((ei) => (ei ? { ...ei, [f.key]: e.target.value } : ei))} />
                      </div>
                    ))}
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateInv.mutate({
                            id: editingInv.id,
                            name: editingInv.name,
                            invested_amount: Number(editingInv.invested_amount),
                            current_value: Number(editingInv.current_value),
                            monthly_rate: Number(editingInv.monthly_rate),
                            target_percent: Number(editingInv.target_percent),
                          })
                        }
                      >
                        ✓
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingInv(null)}>✕</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-bg p-4" style={{ borderColor: inv.type_color }}>
                  <span className="text-xl" aria-hidden="true">{inv.type_icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{inv.name}</p>
                    <p className="text-xs" style={{ color: inv.type_color }}>{inv.type_name}</p>
                    {inv.notes && <p className="text-xs text-muted">{inv.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Investido: {fmt(inv.invested_amount)}</p>
                    <p className="text-sm font-bold text-text">Atual: {fmt(inv.current_value)}</p>
                    <p className={cn("text-xs", profit >= 0 ? "text-success" : "text-danger")}>
                      {profit >= 0 ? "+" : ""}{fmt(profit)} ({pct >= 0 ? "+" : ""}{fmtPct(pct)})
                    </p>
                  </div>
                  {Number(inv.monthly_rate) > 0 && (
                    <div className="rounded-md bg-surface p-2 text-center">
                      <p className="text-xs text-muted">Taxa</p>
                      <p className="text-sm font-semibold text-success">{fmtPct(inv.monthly_rate)}/m</p>
                    </div>
                  )}
                  {Number(inv.target_percent) > 0 && (
                    <div className="rounded-md bg-surface p-2 text-center">
                      <p className="text-xs text-muted">Meta</p>
                      <p className="text-sm font-semibold text-primary">{fmtPct(inv.target_percent)}</p>
                    </div>
                  )}
                  <Button variant="ghost" size="icon" aria-label={`Editar investimento ${inv.name}`} onClick={() => setEditingInv(inv)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir investimento ${inv.name}`} onClick={() => deleteInv.mutate(inv.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
            {investments.length === 0 && types.length > 0 && !isLoading && <p className="text-sm text-muted">Nenhum investimento cadastrado ainda</p>}
          </div>
        </CardContent>
      </Card>

      <CompoundCalculator />
    </div>
  )
}
