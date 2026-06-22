import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts'
import api from '../services/api'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: string | number) => `${Number(v).toFixed(2)}%`
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']
const ICONS = ['📈','💰','🏦','₿','🏠','💎','📊','🌍']
const TYPE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

interface InvestmentType { id: string; name: string; description?: string; color: string; icon: string; total_invested: string; total_current: string }
interface Investment { id: string; type_id: string; type_name: string; type_color: string; type_icon: string; name: string; invested_amount: string; current_value: string; monthly_rate: string; target_percent: string; profit: string; return_pct: string; notes?: string }

const inp = { padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: 13 }
const btnS = (bg: string) => ({ padding: '8px 14px', borderRadius: 6, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 as const })

// Calculadora de juros compostos
function CompoundCalculator() {
  const [form, setForm] = useState({ initial: '', monthly: '', rate: '', period: '12', rateType: 'monthly' })
  const [result, setResult] = useState<{ months: number; data: { month: number; total: number; invested: number; interest: number }[] } | null>(null)

  function calculate() {
    const initial = Number(form.initial) || 0
    const monthly = Number(form.monthly) || 0
    const period = Number(form.period) || 12
    let rate = Number(form.rate) / 100

    if (form.rateType === 'yearly') rate = Math.pow(1 + rate, 1/12) - 1

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
    <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a3e', marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#ccc' }}>🧮 Calculadora de Juros Compostos</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Valor inicial (R$)', key: 'initial', type: 'number', placeholder: '1000' },
          { label: 'Aporte mensal (R$)', key: 'monthly', type: 'number', placeholder: '200' },
          { label: 'Taxa de juros (%)', key: 'rate', type: 'number', placeholder: '1' },
          { label: 'Período (meses)', key: 'period', type: 'number', placeholder: '12' },
        ].map(f => (
          <div key={f.key}>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} type={f.type} placeholder={f.placeholder}
              value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Tipo de taxa</label>
          <select style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.rateType} onChange={e => setForm(p => ({ ...p, rateType: e.target.value }))}>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
      </div>

      <button style={btnS('#6366f1')} onClick={calculate}>Calcular</button>

      {result && last && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 16, textAlign: 'center' as const }}>
              <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>Total investido</p>
              <p style={{ color: '#6366f1', fontSize: 18, fontWeight: 700, margin: 0 }}>{fmt(last.invested)}</p>
            </div>
            <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 16, textAlign: 'center' as const }}>
              <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>Juros gerados</p>
              <p style={{ color: '#10b981', fontSize: 18, fontWeight: 700, margin: 0 }}>{fmt(last.interest)}</p>
            </div>
            <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 16, textAlign: 'center' as const, border: '1px solid #6366f133' }}>
              <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>Montante final</p>
              <p style={{ color: '#f59e0b', fontSize: 20, fontWeight: 700, margin: 0 }}>{fmt(last.total)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={result.data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Meses', position: 'insideBottom', offset: -2, fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" name="Montante" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} />
              <Area type="monotone" dataKey="invested" name="Investido" stroke="#6366f1" fill="#6366f122" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function Investments() {
  const qc = useQueryClient()
  const inv = (keys: string[]) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))

  const [showTypeForm, setShowTypeForm] = useState(false)
  const [showInvForm, setShowInvForm] = useState(false)
  const [editingType, setEditingType] = useState<InvestmentType | null>(null)
  const [editingInv, setEditingInv] = useState<Investment | null>(null)
  const [newType, setNewType] = useState({ name: '', description: '', color: '#6366f1', icon: '📈' })
  const [newInv, setNewInv] = useState({ type_id: '', name: '', invested_amount: '', current_value: '', monthly_rate: '', target_percent: '', notes: '' })

  const { data: types = [] } = useQuery<InvestmentType[]>({ queryKey: ['invTypes'], queryFn: () => api.get('/investments/types').then(r => r.data) })
  const { data: investments = [] } = useQuery<Investment[]>({ queryKey: ['investments'], queryFn: () => api.get('/investments').then(r => r.data) })
  const { data: portfolio = [] } = useQuery<(InvestmentType & { total_profit: string; return_pct?: string })[]>({ queryKey: ['portfolio'], queryFn: () => api.get('/investments/portfolio').then(r => r.data) })

  const totalInvested = portfolio.reduce((s, p) => s + Number(p.total_invested), 0)
  const totalCurrent = portfolio.reduce((s, p) => s + Number(p.total_current), 0)
  const totalProfit = totalCurrent - totalInvested
  const returnPct = totalInvested > 0 ? ((totalProfit / totalInvested) * 100) : 0

  const createType = useMutation({ mutationFn: (d: unknown) => api.post('/investments/types', d), onSuccess: () => { inv(['invTypes', 'portfolio']); setShowTypeForm(false); setNewType({ name: '', description: '', color: '#6366f1', icon: '📈' }) } })
  const updateType = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; description?: string; color?: string; icon?: string }) => api.put(`/investments/types/${id}`, d), onSuccess: () => { inv(['invTypes', 'portfolio']); setEditingType(null) } })
  const deleteType = useMutation({ mutationFn: (id: string) => api.delete(`/investments/types/${id}`), onSuccess: () => inv(['invTypes', 'investments', 'portfolio']) })
  const createInv = useMutation({ mutationFn: (d: unknown) => api.post('/investments', d), onSuccess: () => { inv(['investments', 'portfolio', 'invTypes']); setShowInvForm(false); setNewInv({ type_id: '', name: '', invested_amount: '', current_value: '', monthly_rate: '', target_percent: '', notes: '' }) } })
  const updateInv = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; invested_amount?: number; current_value?: number; monthly_rate?: number; target_percent?: number }) => api.put(`/investments/${id}`, d), onSuccess: () => { inv(['investments', 'portfolio', 'invTypes']); setEditingInv(null) } })
  const deleteInv = useMutation({ mutationFn: (id: string) => api.delete(`/investments/${id}`), onSuccess: () => inv(['investments', 'portfolio', 'invTypes']) })

  const pieData = portfolio.filter(p => Number(p.total_current) > 0).map(p => ({ name: p.name, value: Number(p.total_current), color: p.color }))

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 22 }}>💎 Investimentos</h2>

      {/* Resumo da carteira */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total investido', value: fmt(totalInvested), color: '#6366f1' },
          { label: 'Valor atual', value: fmt(totalCurrent), color: '#10b981' },
          { label: 'Lucro/Prejuízo', value: fmt(totalProfit), color: totalProfit >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Rentabilidade', value: fmtPct(returnPct), color: returnPct >= 0 ? '#10b981' : '#ef4444' },
        ].map(item => (
          <div key={item.label} style={{ background: '#1a1a2e', borderRadius: 10, padding: '16px 20px', border: '1px solid #2a2a3e' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px' }}>{item.label}</p>
            <p style={{ color: item.color, fontSize: 18, fontWeight: 700, margin: 0 }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de distribuição + tipos */}
      {portfolio.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a3e' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#ccc' }}>Distribuição da carteira</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                  {pieData.map((p, i) => <Cell key={i} fill={p.color || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a3e' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#ccc' }}>Por categoria</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {portfolio.map(p => {
                const pct = totalCurrent > 0 ? (Number(p.total_current) / totalCurrent * 100) : 0
                const profit = Number(p.total_current) - Number(p.total_invested)
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#ccc', fontSize: 13 }}>{p.icon} {p.name}</span>
                      <span style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>{fmt(p.total_current)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#555', fontSize: 11 }}>{pct.toFixed(1)}% da carteira</span>
                      <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontSize: 11 }}>
                        {profit >= 0 ? '+' : ''}{fmt(profit)}
                      </span>
                    </div>
                    <div style={{ height: 4, background: '#2a2a3e', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tipos de investimento */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a3e', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#ccc' }}>📂 Tipos de investimento</h3>
          <button style={btnS('#6366f1')} onClick={() => setShowTypeForm(!showTypeForm)}>+ Tipo</button>
        </div>

        {showTypeForm && (
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Nome</label>
              <input style={inp} value={newType.name} onChange={e => setNewType(n => ({ ...n, name: e.target.value }))} /></div>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Descrição</label>
              <input style={inp} value={newType.description} placeholder="Ex: Ações, FIIs..." onChange={e => setNewType(n => ({ ...n, description: e.target.value }))} /></div>
            <div>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Ícone</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {ICONS.map(ic => <button key={ic} onClick={() => setNewType(n => ({ ...n, icon: ic }))}
                  style={{ ...btnS(newType.icon === ic ? '#6366f1' : '#2a2a3e'), padding: '6px 10px', fontSize: 16 }}>{ic}</button>)}
              </div>
            </div>
            <div>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Cor</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TYPE_COLORS.map(c => <div key={c} onClick={() => setNewType(n => ({ ...n, color: c }))}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: newType.color === c ? '2px solid #fff' : '2px solid transparent' }} />)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnS('#10b981')} onClick={() => createType.mutate(newType)}>Salvar</button>
              <button style={btnS('#555')} onClick={() => setShowTypeForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {types.map(t => (
            <div key={t.id} style={{ background: '#0f0f1a', borderRadius: 8, padding: 14, border: `1px solid ${t.color}33` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingType(t)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                  <button onClick={() => deleteType.mutate(t.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                </div>
              </div>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: t.color }}>{t.name}</p>
              {t.description && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#888' }}>{t.description}</p>}
              <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{fmt(t.total_current)}</p>
            </div>
          ))}
          {types.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>Nenhum tipo cadastrado ainda</p>}
        </div>

        {/* Editar tipo */}
        {editingType && (
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 14, marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Nome</label>
              <input style={inp} value={editingType.name} onChange={e => setEditingType(et => et ? { ...et, name: e.target.value } : et)} /></div>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Descrição</label>
              <input style={inp} value={editingType.description || ''} onChange={e => setEditingType(et => et ? { ...et, description: e.target.value } : et)} /></div>
            <div>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Ícone</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {ICONS.map(ic => <button key={ic} onClick={() => setEditingType(et => et ? { ...et, icon: ic } : et)}
                  style={{ ...btnS(editingType.icon === ic ? '#6366f1' : '#2a2a3e'), padding: '6px 10px', fontSize: 16 }}>{ic}</button>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnS('#10b981')} onClick={() => updateType.mutate({ id: editingType.id, name: editingType.name, description: editingType.description, color: editingType.color, icon: editingType.icon })}>Salvar</button>
              <button style={btnS('#555')} onClick={() => setEditingType(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de investimentos */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a3e', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#ccc' }}>💼 Meus investimentos</h3>
          <button style={btnS('#6366f1')} onClick={() => setShowInvForm(!showInvForm)} disabled={types.length === 0}>+ Investimento</button>
        </div>

        {types.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>Crie um tipo de investimento primeiro</p>}

        {showInvForm && (
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Tipo</label>
              <select style={{ ...inp, width: '100%' }} value={newInv.type_id} onChange={e => setNewInv(n => ({ ...n, type_id: e.target.value }))}>
                <option value="">Selecionar...</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            {[
              { label: 'Nome', key: 'name', placeholder: 'Ex: Tesouro Selic' },
              { label: 'Valor investido (R$)', key: 'invested_amount', placeholder: '1000' },
              { label: 'Valor atual (R$)', key: 'current_value', placeholder: '1050' },
              { label: 'Taxa mensal (%)', key: 'monthly_rate', placeholder: '1.0' },
              { label: 'Meta da carteira (%)', key: 'target_percent', placeholder: '30' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder={f.placeholder}
                  value={newInv[f.key as keyof typeof newInv]}
                  onChange={e => setNewInv(n => ({ ...n, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Observações</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={newInv.notes}
                onChange={e => setNewInv(n => ({ ...n, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button style={btnS('#10b981')} onClick={() => createInv.mutate({
                ...newInv,
                invested_amount: Number(newInv.invested_amount),
                current_value: Number(newInv.current_value) || Number(newInv.invested_amount),
                monthly_rate: Number(newInv.monthly_rate),
                target_percent: Number(newInv.target_percent),
              })}>Salvar</button>
              <button style={btnS('#555')} onClick={() => setShowInvForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {investments.map(inv => {
            const profit = Number(inv.profit)
            const pct = Number(inv.return_pct)
            return editingInv?.id === inv.id ? (
              <div key={inv.id} style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, alignItems: 'flex-end' }}>
                {[
                  { label: 'Nome', key: 'name', val: editingInv.name },
                  { label: 'Valor investido', key: 'invested_amount', val: editingInv.invested_amount },
                  { label: 'Valor atual', key: 'current_value', val: editingInv.current_value },
                  { label: 'Taxa mensal (%)', key: 'monthly_rate', val: editingInv.monthly_rate },
                  { label: 'Meta (%)', key: 'target_percent', val: editingInv.target_percent },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={f.val}
                      onChange={e => setEditingInv(ei => ei ? { ...ei, [f.key]: e.target.value } : ei)} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnS('#10b981')} onClick={() => updateInv.mutate({
                    id: editingInv.id, name: editingInv.name,
                    invested_amount: Number(editingInv.invested_amount),
                    current_value: Number(editingInv.current_value),
                    monthly_rate: Number(editingInv.monthly_rate),
                    target_percent: Number(editingInv.target_percent),
                  })}>✓</button>
                  <button style={btnS('#555')} onClick={() => setEditingInv(null)}>✕</button>
                </div>
              </div>
            ) : (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#0f0f1a', borderRadius: 8, border: `1px solid ${inv.type_color}33` }}>
                <span style={{ fontSize: 22 }}>{inv.type_icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500 }}>{inv.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: inv.type_color }}>{inv.type_name}</p>
                  {inv.notes && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#666' }}>{inv.notes}</p>}
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, color: '#aaa' }}>Investido: {fmt(inv.invested_amount)}</p>
                  <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Atual: {fmt(inv.current_value)}</p>
                  <p style={{ margin: 0, fontSize: 12, color: profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {profit >= 0 ? '+' : ''}{fmt(profit)} ({pct >= 0 ? '+' : ''}{fmtPct(pct)})
                  </p>
                </div>
                {Number(inv.monthly_rate) > 0 && (
                  <div style={{ textAlign: 'center' as const, padding: '6px 10px', background: '#1a1a2e', borderRadius: 6 }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Taxa</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#10b981' }}>{fmtPct(inv.monthly_rate)}/m</p>
                  </div>
                )}
                {Number(inv.target_percent) > 0 && (
                  <div style={{ textAlign: 'center' as const, padding: '6px 10px', background: '#1a1a2e', borderRadius: 6 }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Meta</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{fmtPct(inv.target_percent)}</p>
                  </div>
                )}
                <button onClick={() => setEditingInv(inv)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✏️</button>
                <button onClick={() => deleteInv.mutate(inv.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
              </div>
            )
          })}
          {investments.length === 0 && types.length > 0 && <p style={{ color: '#555', fontSize: 13 }}>Nenhum investimento cadastrado ainda</p>}
        </div>
      </div>

      {/* Calculadora de juros compostos */}
      <CompoundCalculator />
    </div>
  )
}
