import { useState } from 'react'
import { Sparkles, Loader2, Bot, AlertCircle } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Insights() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ insights: string; summary: { total_income: string; total_expense: string; balance: string } } | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/insights')
      setResult(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao gerar insights')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="m-0 mb-2 text-2xl font-semibold tracking-tight text-text">Insights com IA</h2>
        <p className="mb-6 text-sm text-muted">Análise inteligente dos seus gastos usando Gemini AI</p>
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {loading ? 'Analisando seus dados...' : 'Gerar análise com IA'}
      </Button>

      {error && (
        <Card className="border-danger/20 bg-danger/10">
          <CardContent className="p-5">
            <p className="m-0 flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </p>
            {error.includes('GEMINI_API_KEY') && (
              <p className="mt-2 text-xs text-muted">
                Adicione sua chave no arquivo <code className="text-primary">apps/api/.env</code>: GEMINI_API_KEY=sua_chave
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Receitas', value: result.summary.total_income, color: 'text-income' },
              { label: 'Despesas', value: result.summary.total_expense, color: 'text-expense' },
              { label: 'Saldo', value: result.summary.balance, color: 'text-primary' },
            ].map(item => (
              <Card key={item.label} className="min-w-[140px] flex-1">
                <CardContent className="p-4">
                  <p className="mb-1 text-xs text-muted">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>
                    {Number(item.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-7">
              <div className="mb-4 flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="m-0 text-base font-medium text-primary">Análise do Gemini AI</h3>
              </div>
              <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-text">
                {result.insights}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
