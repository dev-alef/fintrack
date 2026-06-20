import { useSummary } from '../hooks/useTransactions'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function Card({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{ background: '#1a1a2e', borderRadius: 12, padding: '20px 24px', border: '1px solid #2a2a3e', flex: 1 }}>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 8px' }}>{title}</p>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const now = new Date()
  const { data, isLoading } = useSummary(String(now.getMonth() + 1), String(now.getFullYear()))

  if (isLoading) return <p style={{ color: '#888' }}>Carregando...</p>

  const totals = data?.totals
  const byMonth = data?.byMonth || []
  const byCategory = data?.byCategory || []
  const pieData = byCategory.map((c: { category: string; total: string }) => ({ name: c.category, value: Number(c.total) }))

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 22 }}>Dashboard</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <Card title="Receitas do mês" value={fmt(totals?.total_income || 0)} color="#10b981" />
        <Card title="Despesas do mês" value={fmt(totals?.total_expense || 0)} color="#ef4444" />
        <Card title="Saldo" value={fmt(totals?.balance || 0)} color="#6366f1" />
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 300, background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a3e' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, color: '#ccc' }}>Últimos 6 meses</h3>
          {byMonth.length === 0
            ? <p style={{ color: '#555', fontSize: 13 }}>Nenhuma transação nos últimos 6 meses</p>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byMonth}>
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="income" name="Receita" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="expense" name="Despesa" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
        <div style={{ flex: 1, minWidth: 260, background: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a3e' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, color: '#ccc' }}>Por categoria</h3>
          {pieData.length === 0
            ? <p style={{ color: '#555', fontSize: 13 }}>Sem dados</p>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {pieData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>
    </div>
  )
}
