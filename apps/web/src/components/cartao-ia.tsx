import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"

const KEYFRAMES = `
@keyframes ia-breathe {0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.08);opacity:.8}}
@keyframes ia-ring {0%{transform:scale(.86);opacity:.4}100%{transform:scale(1.6);opacity:0}}
`

type Meta = { titulo: string; atual: number; alvo: number }

type Props = {
  sobrou: number
  contasFixas: number
  faturas: number
  contasPagas: number
  totalContas: number
  investimentos: number
  meta?: Meta
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
export function CartaoIA({
  sobrou,
  contasFixas,
  faturas,
  contasPagas,
  totalContas,
  investimentos,
  meta,
  formata,
}: Props) {
  const [indice, setIndice] = useState(0)
  const [reduzido, setReduzido] = useState(false)

  const faltamPagar = totalContas - contasPagas
  const progressoMeta = meta && meta.alvo > 0 ? Math.min(100, Math.round((meta.atual / meta.alvo) * 100)) : 0

  const frases = [
    sobrou >= 0 ? `Sobraram ${formata(sobrou)} no seu mês.` : `Seu mês está ${formata(Math.abs(sobrou))} no vermelho.`,
    faltamPagar > 0
      ? `Faltam ${faltamPagar} ${faltamPagar === 1 ? "conta fixa" : "contas fixas"} para pagar.`
      : totalContas > 0
        ? "Todas as contas fixas do mês estão pagas."
        : `Suas contas fixas somam ${formata(contasFixas)}.`,
    meta ? `${meta.titulo} está em ${progressoMeta}% da sua meta.` : `Você tem ${formata(investimentos)} investidos.`,
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

  const play = reduzido ? "paused" : "running"

  return (
    <div className="rounded-2xl border border-border p-6" style={{ background: "var(--ai-card)" }}>
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

          {/* Uma barra grande e as demais informações abaixo, do mesmo
              tamanho entre si. A meta fica em destaque porque é a única que
              mede um caminho até algum lugar — as outras duas são fotografias
              do mês, e nivelá-las com a meta achataria a diferença. */}
          {meta && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm text-text" title={meta.titulo}>
                  {meta.titulo}
                </p>
                <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: "var(--income)" }}>
                  {progressoMeta}%
                </p>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "var(--track)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${progressoMeta}%`, background: "var(--income)" }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {formata(meta.atual)} de {formata(meta.alvo)}
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 px-4 py-3" style={{ background: "var(--surface)" }}>
              <p className="text-xs text-muted">Investimentos</p>
              <p className="mt-1 text-base font-semibold tabular-nums" style={{ color: "var(--income)" }}>
                {formata(investimentos)}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 px-4 py-3" style={{ background: "var(--surface)" }}>
              <p className="text-xs text-muted">Contas fixas</p>
              <p className="mt-1 text-base font-semibold text-text">
                {totalContas === 0
                  ? "nenhuma cadastrada"
                  : faltamPagar > 0
                    ? `faltam ${faltamPagar} de ${totalContas}`
                    : "todas pagas"}
              </p>
            </div>
          </div>

          <Link
            to="/insights"
            className="mt-5 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            Ver o plano da IA
          </Link>
        </div>
      </div>
    </div>
  )
}
