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
  patrimonio: number
  /** Valor ja pago das contas fixas - a contagem sozinha nao diz quanto falta em dinheiro. */
  contasFixasPagas: number
  /** Distingue "nao criou meta nenhuma" de "criou e ainda nao aportou" - o convite muda. */
  temMetas: boolean
  meta?: Meta
  formata: (valor: number) => string
}

/** Uma linha de progresso: rotulo, valor a direita e barra abaixo. */
function Barra({
  rotulo,
  valor,
  percentual,
  cor,
  detalhe,
}: {
  rotulo: string
  valor: string
  percentual: number
  cor: string
  detalhe?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm text-text" title={rotulo}>
          {rotulo}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: cor }}>
          {valor}
        </p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "var(--track)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(100, Math.max(0, percentual))}%`, background: cor }}
        />
      </div>
      {detalhe && <p className="mt-1.5 text-xs text-muted">{detalhe}</p>}
    </div>
  )
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
  patrimonio,
  contasFixasPagas,
  temMetas,
  meta,
  formata,
}: Props) {
  const [indice, setIndice] = useState(0)
  const [reduzido, setReduzido] = useState(false)

  const faltamPagar = totalContas - contasPagas
  const progressoMeta = meta && meta.alvo > 0 ? Math.min(100, Math.round((meta.atual / meta.alvo) * 100)) : 0
  const fatiaInvestida = patrimonio > 0 ? Math.round((investimentos / patrimonio) * 100) : 0

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

          {/* Tudo em barra, nenhum cartao. As tres medem coisas diferentes, e a
              barra deixa isso explicito: quanto do caminho ja foi andado.

              Investimentos nao tem alvo proprio, entao a barra mostra a fatia
              do patrimonio que esta rendendo - a unica leitura de progresso
              honesta para esse numero. Inventar uma meta de investimento seria
              atribuir a pessoa um objetivo que ela nunca definiu. */}
          <div className="mt-5 flex flex-col gap-4">
            {meta ? (
              <Barra
                rotulo={meta.titulo}
                valor={`${progressoMeta}%`}
                percentual={progressoMeta}
                cor="var(--income)"
                detalhe={`${formata(meta.atual)} de ${formata(meta.alvo)}`}
              />
            ) : (
              <p className="text-sm text-muted">
                {temMetas ? "Suas metas ainda não receberam nenhum aporte." : "Você ainda não definiu uma meta."}{" "}
                <Link
                  to="/goals"
                  className="font-medium underline underline-offset-2"
                  style={{ color: "var(--link)" }}
                >
                  {temMetas ? "Registrar um valor" : "Criar a primeira"}
                </Link>
              </p>
            )}

            <Barra
              rotulo="Investido"
              valor={formata(investimentos)}
              percentual={fatiaInvestida}
              cor="var(--primary)"
              detalhe={
                patrimonio > 0
                  ? `${fatiaInvestida}% do seu patrimônio de ${formata(patrimonio)}`
                  : "sem patrimônio registrado neste mês"
              }
            />

            {totalContas > 0 && (
              <Barra
                rotulo="Contas fixas pagas"
                valor={`${contasPagas} de ${totalContas}`}
                percentual={(contasPagas / totalContas) * 100}
                cor="var(--success)"
                detalhe={faltamPagar > 0 ? `faltam ${formata(contasFixas - contasFixasPagas)}` : "tudo em dia neste mês"}
              />
            )}
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
