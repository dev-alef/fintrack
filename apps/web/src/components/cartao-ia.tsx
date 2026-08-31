import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"

const KEYFRAMES = `
@keyframes ia-breathe {0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.08);opacity:.8}}
@keyframes ia-ring {0%{transform:scale(.86);opacity:.4}100%{transform:scale(1.6);opacity:0}}
`

type Props = {
  sobrou: number
  contasFixas: number
  faturas: number
  contasPagas: number
  totalContas: number
  formata: (valor: number) => string
}

/**
 * Leitura da IA — mesmo orbe e mesmo ritmo do login, para a tela de entrada e o
 * painel falarem a mesma língua.
 *
 * As frases são calculadas dos dados reais do mês, não fixas. O pacote de design
 * trazia textos de exemplo ("Cortei R$ 118 em assinaturas que você não usava");
 * repeti-los aqui seria inventar um número na cara de quem sabe qual é o dele.
 * Quem produz análise de verdade é a página de Insights, para onde o botão leva.
 */
export function CartaoIA({ sobrou, contasFixas, faturas, contasPagas, totalContas, formata }: Props) {
  const [indice, setIndice] = useState(0)
  const [reduzido, setReduzido] = useState(false)

  const frases = [
    sobrou >= 0
      ? `Sobraram ${formata(sobrou)} no seu mês.`
      : `Seu mês está ${formata(Math.abs(sobrou))} no vermelho.`,
    `Suas contas fixas somam ${formata(contasFixas)}.`,
    faturas > 0 ? `As faturas dos cartões estão em ${formata(faturas)}.` : "Nenhuma fatura lançada neste mês.",
  ]

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const aplica = () => setReduzido(mq.matches)
    aplica()
    mq.addEventListener("change", aplica)
    return () => mq.removeEventListener("change", aplica)
  }, [])

  useEffect(() => {
    // Quem pediu menos movimento fica com a primeira frase, sem rotação.
    if (reduzido) return
    const t = window.setInterval(() => setIndice((i) => (i + 1) % frases.length), 7000)
    return () => window.clearInterval(t)
  }, [reduzido, frases.length])

  const progresso = totalContas > 0 ? Math.round((contasPagas / totalContas) * 100) : 0
  const play = reduzido ? "paused" : "running"

  return (
    <div
      className="rounded-2xl border border-border p-6"
      style={{ background: "var(--ai-card)" }}
    >
      <style>{KEYFRAMES}</style>

      <div className="flex items-start gap-5">
        <div aria-hidden="true" className="relative hidden h-[74px] w-[74px] shrink-0 items-center justify-center sm:flex">
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "var(--ai-ring)", animation: "ia-ring 5s ease-out infinite", animationPlayState: play }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "var(--ai-ring)", animation: "ia-ring 5s ease-out 1.6s infinite both", animationPlayState: play }}
          />
          <span
            className="h-[52px] w-[52px] rounded-full"
            style={{ background: "var(--orb)", animation: "ia-breathe 5s ease-in-out infinite", animationPlayState: play }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Leitura da IA
          </p>

          {/* aria-live para quem usa leitor de tela ouvir a frase trocar sem
              precisar procurar; a rotação é visual e passaria despercebida. */}
          <p
            aria-live="polite"
            className="mt-2 text-lg leading-snug"
            style={{ color: "var(--link)", fontFamily: "var(--font-heading)" }}
          >
            {frases[indice]}
          </p>

          {totalContas > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Contas fixas pagas</span>
                <span>
                  {contasPagas} de {totalContas}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "var(--track)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${progresso}%`, background: "var(--success)" }}
                />
              </div>
            </div>
          )}

          <Link
            to="/insights"
            className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            Ver o plano da IA
          </Link>
        </div>
      </div>
    </div>
  )
}
