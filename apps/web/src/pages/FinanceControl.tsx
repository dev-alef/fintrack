import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CARD_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

interface Card { id: string; name: string; due_day: number; color: string }
interface Bill { id: string; name: string; amount: string; due_day: number; paid?: boolean; payment_id?: string }
interface CardExpense { card_id: string; card_name: string; color: string; due_day: number; amount: string }
interface Config { estimated_income: string; balance: string; investments: string }
interface AnnualCard { id: string; name: string; color: string; annual_total: string }

const inp = { padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: 13 }
const btn = (bg: string) => ({ padding: '8px 14px', borderRadius: 6, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 as const })

export default function FinanceControl() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [newCard, setNewCard] = useState({ name: '', due_day: '', color: '#6366f1' })
  const [newBill, setNewBill] = useState({ name: '', amount: '', due_day: '' })
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [showNewCard, setShowNewCard] = useState(false)
  const [showNewBill, setShowNewBill] = useState(false)
  const qc = useQueryClient()

  const inv = (keys: string[]) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))

  const { data: cards = [] } = useQuery<Card[]>({ queryKey: ['cards'], queryFn: () => api.get('/finance/cards').then(r => r.data) })
  const { data: bills = [] } = useQuery<Bill[]>({ queryKey: ['payments', month, year], queryFn: () => api.get(`/finance/payments?month=${month}&year=${year}`).then(r => r.data) })
  const { data: expenses = [] } = useQuery<CardExpense[]>({ queryKey: ['expenses', month, year], queryFn: () => api.get(`/finance/cards/expenses?month=${month}&year=${year}`).then(r => r.data) })
  const { data: config } = useQuery<Config>({ queryKey: ['config', month, year], queryFn: () => api.get(`/finance/config?month=${month}&year=${year}`).then(r => r.data) })
  const { data: annual = [] } = useQuery<AnnualCard[]>({ queryKey: ['annual', year], queryFn: () => api.get(`/finance/cards/annual?year=${year}`).then(r => r.data) })
  const { data: annualSummary = [] } = useQuery<{ month: number; estimated_income: string; total_fixed_bills: string; total_card_expenses: string }[]>({ queryKey: ['annualSummary', year], queryFn: () => api.get(`/finance/annual?year=${year}`).then(r => r.data) })

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { data: prevConfig } = useQuery<Config>({ queryKey: ['config', prevMonth, prevYear], queryFn: () => api.get(`/finance/config?month=${prevMonth}&year=${prevYear}`).then(r => r.data) })

  const createCard = useMutation({ mutationFn: (d: unknown) => api.post('/finance/cards', d), onSuccess: () => { inv(['cards']); setShowNewCard(false); setNewCard({ name: '', due_day: '', color: '#6366f1' }) } })
  const updateCard = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; due_day?: number; color?: string }) => api.put(`/finance/cards/${id}`, d), onSuccess: () => { inv(['cards']); setEditingCard(null) } })
  const deleteCard = useMutation({ mutationFn: (id: string) => api.delete(`/finance/cards/${id}`), onSuccess: () => inv(['cards', 'expenses', 'annual']) })
  const createBill = useMutation({ mutationFn: (d: unknown) => api.post('/finance/bills', d), onSuccess: () => { inv(['payments']); setShowNewBill(false); setNewBill({ name: '', amount: '', due_day: '' }) } })
  const updateBill = useMutation({ mutationFn: ({ id, ...d }: { id: string; name?: string; amount?: number; due_day?: number }) => api.put(`/finance/bills/${id}`, d), onSuccess: () => { inv(['payments']); setEditingBill(null) } })
  const deleteBill = useMutation({ mutationFn: (id: string) => api.delete(`/finance/bills/${id}`), onSuccess: () => inv(['payments']) })
  const togglePayment = useMutation({ mutationFn: (d: unknown) => api.post('/finance/payments/toggle', d), onSuccess: () => inv(['payments']) })
  const setExpense = useMutation({ mutationFn: (d: unknown) => api.post('/finance/cards/expenses', d), onSuccess: () => inv(['expenses', 'annual', 'annualSummary']) })
  const saveConfig = useMutation({ mutationFn: (d: unknown) => api.post('/finance/config', d), onSuccess: () => inv(['config', 'annualSummary']) })

  const totalBills = bills.reduce((s: number, b: Bill) => s + Number(b.amount), 0)
  const totalPaid = bills.filter((b: Bill) => b.paid).reduce((s: number, b: Bill) => s + Number(b.amount), 0)
  const totalCards = expenses.reduce((s: number, e: CardExpense) => s + Number(e.amount), 0)
  const estimatedIncome = Number(config?.estimated_income || 0)
  const balance = Number(config?.balance || 0)
  const investments = Number(config?.investments || 0)
  const leftover = estimatedIncome - totalBills - totalCards
  const annualTotal = annualSummary.reduce((s, r) => s + Number(r.estimated_income || 0), 0)
  const annualBills = annualSummary.reduce((s, r) => s + Number(r.total_fixed_bills || 0) + Number(r.total_card_expenses || 0), 0)

  const section = (title: string, action?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#ccc' }}>{title}</h3>
      {action}
    </div>
  )

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a3e', ...extra }}>{children}</div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>💳 Controle Financeiro</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={inp} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select style={inp} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Resumo do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Receita estimada', value: estimatedIncome, color: '#10b981' },
          { label: 'Mês anterior', value: Number(prevConfig?.estimated_income || 0), color: '#6366f1' },
          { label: 'Total contas fixas', value: totalBills, color: '#f59e0b' },
          { label: 'Total faturas', value: totalCards, color: '#ef4444' },
          { label: 'Sobrou no mês', value: leftover, color: leftover >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Saldo atual', value: balance, color: '#8b5cf6' },
          { label: 'Investimentos', value: investments, color: '#06b6d4' },
        ].map(item => (
          <div key={item.label} style={{ background: '#1a1a2e', borderRadius: 10, padding: '14px 16px', border: '1px solid #2a2a3e' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px' }}>{item.label}</p>
            <p style={{ color: item.color, fontSize: 16, fontWeight: 700, margin: 0 }}>{fmt(item.value)}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Config mensal */}
        {card(<>
          {section('⚙️ Configuração do mês')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Receita estimada (R$)', key: 'estimated_income', val: config?.estimated_income || '' },
              { label: 'Saldo atual (R$)', key: 'balance', val: config?.balance || '' },
              { label: 'Investimentos (R$)', key: 'investments', val: config?.investments || '' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }}
                  type="number" step="0.01" defaultValue={f.val}
                  onBlur={e => saveConfig.mutate({ month, year, [f.key]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
        </>)}

        {/* Faturas dos cartões */}
        {card(<>
          {section('💳 Faturas dos cartões',
            <button style={btn('#6366f1')} onClick={() => setShowNewCard(true)}>+ Cartão</button>
          )}

          {showNewCard && (
            <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inp} placeholder="Nome do cartão" value={newCard.name} onChange={e => setNewCard(n => ({ ...n, name: e.target.value }))} />
              <input style={inp} type="number" placeholder="Dia de vencimento" value={newCard.due_day} onChange={e => setNewCard(n => ({ ...n, due_day: e.target.value }))} />
              <div style={{ display: 'flex', gap: 6 }}>
                {CARD_COLORS.map(c => (
                  <div key={c} onClick={() => setNewCard(n => ({ ...n, color: c }))}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: newCard.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn('#10b981')} onClick={() => createCard.mutate({ name: newCard.name, due_day: Number(newCard.due_day), color: newCard.color })}>Salvar</button>
                <button style={btn('#555')} onClick={() => setShowNewCard(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((c: Card) => {
              const exp = expenses.find((e: CardExpense) => e.card_id === c.id)
              const val = exp ? Number(exp.amount) : 0
              return editingCard?.id === c.id ? (
                <div key={c.id} style={{ background: '#0f0f1a', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input style={inp} value={editingCard.name} onChange={e => setEditingCard(ec => ec ? { ...ec, name: e.target.value } : ec)} />
                  <input style={inp} type="number" value={editingCard.due_day} onChange={e => setEditingCard(ec => ec ? { ...ec, due_day: Number(e.target.value) } : ec)} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {CARD_COLORS.map(col => (
                      <div key={col} onClick={() => setEditingCard(ec => ec ? { ...ec, color: col } : ec)}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: col, cursor: 'pointer', border: editingCard.color === col ? '2px solid #fff' : '2px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btn('#10b981')} onClick={() => updateCard.mutate({ id: editingCard.id, name: editingCard.name, due_day: editingCard.due_day, color: editingCard.color })}>Salvar</button>
                    <button style={btn('#555')} onClick={() => setEditingCard(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{c.name} <span style={{ color: '#888', fontSize: 11 }}>venc. dia {c.due_day}</span></p>
                  </div>
                  <input type="number" step="0.01" placeholder="R$ 0,00"
                    defaultValue={val || ''}
                    style={{ ...inp, width: 110, textAlign: 'right' as const }}
                    onBlur={e => setExpense.mutate({ cardId: c.id, month, year, amount: Number(e.target.value) })} />
                  <button onClick={() => setEditingCard(c)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                  <button onClick={() => deleteCard.mutate(c.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                </div>
              )
            })}
            {cards.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>Nenhum cartão cadastrado</p>}
            {totalCards > 0 && (
              <div style={{ borderTop: '1px solid #2a2a3e', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888', fontSize: 13 }}>Total faturas</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{fmt(totalCards)}</span>
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* Despesas fixas */}
      {card(<>
        {section('📋 Despesas fixas mensais',
          <button style={btn('#6366f1')} onClick={() => setShowNewBill(true)}>+ Conta</button>
        )}

        {showNewBill && (
          <div style={{ background: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Nome</label>
              <input style={inp} value={newBill.name} onChange={e => setNewBill(n => ({ ...n, name: e.target.value }))} /></div>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Valor (R$)</label>
              <input style={inp} type="number" step="0.01" value={newBill.amount} onChange={e => setNewBill(n => ({ ...n, amount: e.target.value }))} /></div>
            <div><label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>Dia venc.</label>
              <input style={{ ...inp, width: 70 }} type="number" value={newBill.due_day} onChange={e => setNewBill(n => ({ ...n, due_day: e.target.value }))} /></div>
            <button style={btn('#10b981')} onClick={() => createBill.mutate({ name: newBill.name, amount: Number(newBill.amount), due_day: Number(newBill.due_day) || undefined })}>Salvar</button>
            <button style={btn('#555')} onClick={() => setShowNewBill(false)}>Cancelar</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {bills.map((b: Bill) => editingBill?.id === b.id ? (
            <div key={b.id} style={{ background: '#0f0f1a', borderRadius: 8, padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input style={{ ...inp, flex: 1, minWidth: 100 }} value={editingBill.name} onChange={e => setEditingBill(eb => eb ? { ...eb, name: e.target.value } : eb)} />
              <input style={{ ...inp, width: 100 }} type="number" step="0.01" value={editingBill.amount} onChange={e => setEditingBill(eb => eb ? { ...eb, amount: e.target.value } : eb)} />
              <input style={{ ...inp, width: 60 }} type="number" value={editingBill.due_day || ''} onChange={e => setEditingBill(eb => eb ? { ...eb, due_day: Number(e.target.value) } : eb)} />
              <button style={btn('#10b981')} onClick={() => updateBill.mutate({ id: editingBill.id, name: editingBill.name, amount: Number(editingBill.amount), due_day: editingBill.due_day })}>✓</button>
              <button style={btn('#555')} onClick={() => setEditingBill(null)}>✕</button>
            </div>
          ) : (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: '#0f0f1a', borderRadius: 8,
              border: b.paid ? '1px solid #10b98133' : '1px solid #2a2a3e',
            }}>
              <input type="checkbox" checked={!!b.paid} onChange={() => togglePayment.mutate({ billId: b.id, month, year, paid: !b.paid })}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10b981', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, color: b.paid ? '#888' : '#fff', textDecoration: b.paid ? 'line-through' : 'none' }}>{b.name}</p>
                {b.due_day && <p style={{ margin: 0, fontSize: 11, color: '#555' }}>vence dia {b.due_day}</p>}
              </div>
              <span style={{ color: b.paid ? '#888' : '#f59e0b', fontSize: 13, fontWeight: 600 }}>{fmt(b.amount)}</span>
              <button onClick={() => setEditingBill(b)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>✏️</button>
              <button onClick={() => deleteBill.mutate(b.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
            </div>
          ))}
        </div>

        {bills.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #2a2a3e' }}>
            <span style={{ color: '#888', fontSize: 13 }}>Pagas: {fmt(totalPaid)} / Total: {fmt(totalBills)}</span>
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>Pendente: {fmt(totalBills - totalPaid)}</span>
          </div>
        )}
      </>, { marginBottom: 20 })}

      {/* Totais anuais */}
      {card(<>
        {section(`📈 Totais anuais — ${year}`)}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#888', padding: '6px 8px', borderBottom: '1px solid #2a2a3e' }}>Mês</th>
                <th style={{ textAlign: 'right', color: '#888', padding: '6px 8px', borderBottom: '1px solid #2a2a3e' }}>Receita</th>
                <th style={{ textAlign: 'right', color: '#888', padding: '6px 8px', borderBottom: '1px solid #2a2a3e' }}>Gastos</th>
                <th style={{ textAlign: 'right', color: '#888', padding: '6px 8px', borderBottom: '1px solid #2a2a3e' }}>Sobrou</th>
                {annual.map((c: AnnualCard) => (
                  <th key={c.id} style={{ textAlign: 'right', color: c.color, padding: '6px 8px', borderBottom: '1px solid #2a2a3e' }}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const row = annualSummary.find(r => r.month === i + 1)
                const income = Number(row?.estimated_income || 0)
                const gastos = Number(row?.total_fixed_bills || 0) + Number(row?.total_card_expenses || 0)
                const sob = income - gastos
                const isCurrentMonth = i + 1 === month && year === now.getFullYear()
                return (
                  <tr key={m} style={{ background: isCurrentMonth ? '#6366f122' : 'transparent' }}>
                    <td style={{ padding: '6px 8px', color: isCurrentMonth ? '#6366f1' : '#ccc', fontWeight: isCurrentMonth ? 700 : 400 }}>{m}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#10b981' }}>{income > 0 ? fmt(income) : '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ef4444' }}>{gastos > 0 ? fmt(gastos) : '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: sob >= 0 ? '#10b981' : '#ef4444' }}>{income > 0 ? fmt(sob) : '-'}</td>
                    {annual.map((c: AnnualCard) => {
                      const cardRow = (c as { monthly_breakdown?: { month: number; amount: string }[] }).monthly_breakdown?.find(b => b.month === i + 1)
                      return <td key={c.id} style={{ padding: '6px 8px', textAlign: 'right', color: '#aaa' }}>{cardRow ? fmt(cardRow.amount) : '-'}</td>
                    })}
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid #2a2a3e', fontWeight: 700 }}>
                <td style={{ padding: '8px', color: '#ccc' }}>Total</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#10b981' }}>{fmt(annualTotal)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#ef4444' }}>{fmt(annualBills)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: annualTotal - annualBills >= 0 ? '#10b981' : '#ef4444' }}>{fmt(annualTotal - annualBills)}</td>
                {annual.map((c: AnnualCard) => (
                  <td key={c.id} style={{ padding: '8px', textAlign: 'right', color: c.color }}>{fmt(c.annual_total)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  )
}
