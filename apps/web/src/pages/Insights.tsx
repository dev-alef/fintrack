import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Bot, AlertCircle, RotateCw } from 'lucide-react'
import api from '../services/api'
import { useSession } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Resultado = {
  insights: string
  summary: { total_income: string; total_expense: string; balance: string }
}

type Guardado = { userId: string; resultado: Resultado; geradoEm: string }

const CHAVE = 'provisao:insights'

/**
 * A analise fica guardada em sessionStorage, e nao em estado local: assim ela
 * sobrevive a navegar para outra tela e voltar, ou a recarregar a pagina, e
 * some sozinha quando a aba fecha - que foi o comportamento pedido.
 *
 * localStorage nao serviria: a analise ficaria no computador depois de fechar
 * o navegador, e ela descreve as financas de alguem.
 *
 * O userId vai junto porque a mesma aba pode trocar de dono - sair e outra
 * pessoa entrar. Sem essa checagem, ela leria a analise de quem estava antes.
 */
function leGuardado(userId?: string): Guardado | null {
  if (!userId) return null
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const dado = JSON.parse(bruto) as Guardado
    return dado.userId === userId ? dado : null
  } catch {
    // JSON corrompido nao pode derrubar a tela: melhor comecar sem analise.
    return null
  }
}

export default function Insights() {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState<Guardado | null>(null)
  const [error, setError] = useState('')

  const result = guardado?.resultado ?? null

  // A sessao chega assincrona: na primeira renderizacao userId ainda e
  // undefined, e ler antes disso descartaria a analise por "dono diferente".
  useEffect(() => {
    if (userId) setGuardado(leGuardado(userId))
  }, [userId])

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/insights')
      const novo: Guardado = { userId: userId ?? '', resultado: data, geradoEm: new Date().toISOString() }
      setGuardado(novo)
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify(novo))
      } catch {
        // Cota estourada ou modo restrito: a analise continua na tela, so nao
        // sobrevive a navegacao. Falhar aqui seria pior que degradar.
      }
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

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : result ? (
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? 'Analisando seus dados...' : result ? 'Gerar novamente' : 'Gerar análise com IA'}
        </Button>

        {/* A analise persiste, entao pode estar velha em relacao aos
            lancamentos. Sem a hora, nao ha como saber se ela ja considera o
            que foi cadastrado depois. */}
        {guardado && (
          <span className="text-xs text-muted">
            gerada às{' '}
            {new Date(guardado.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

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
