import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"

const INTERVALO_MS = 7000

const KEYFRAMES = `
@keyframes ia-breathe {0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.08);opacity:.8}}
@keyframes ia-ring {0%{transform:scale(.86);opacity:.4}100%{transform:scale(1.6);opacity:0}}
@keyframes ia-say {
  0%{opacity:0;transform:translateY(8px)}
  9%,88%{opacity:1;transform:none}
  100%{opacity:0;transform:translateY(-6px)}
}
`

type Meta = { titulo: string; atual: number; alvo: number }

type Props = {
  sobrou: number
  contasFixas: number
  faturas: number
  /** Contas fixas JA pagas no mes, em quantidade. */
  contasPagas: number
  totalContas: number
  /**
   * Faturas de cartao pagas e total de faturas lancadas no mes.
   *
   * A barra junta contas fixas e faturas numa conta so, e o motivo e o mesmo
   * que faz o cartao existir: "faltam 2 de 5 contas" escondia a fatura do
   * cartao, que costuma ser o maior compromisso do mes. Separadas, a barra
   * dizia "tudo em dia" com a fatura em aberto.
   */
  faturasPagas: number
  totalFaturas: number
  /** Valor ja pago das faturas - o mesmo papel de contasFixasPagas. */
  faturasPagasValor: number
  /**
   * Onde o ano termina, com as parcelas separadas.
   *
   * `undefined` quando nao ha mes planejado a frente - ai nao ha projecao, e
   * inventar um numero sobre o fim do ano seria repetir o saldo de hoje com
   * outro nome.
   *
   * `guardadoEmMetas` ENTRA na soma: neste produto o dinheiro de uma meta e
   * um terceiro bolso, separado do saldo do mes e dos investimentos. Aparece
   * como parcela propria em vez de somado em silencio - e a unica forma de
   * quem confere perceber se acabou contando o mesmo dinheiro duas vezes.
   */
  dezembro?: {
    saldoHoje: number
    planejado: number
    mesesConsiderados: number
    guardadoEmMetas: number
  }
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
  faturasPagas,
  totalFaturas,
  faturasPagasValor,
  dezembro,
  investimentos,
  patrimonio,
  contasFixasPagas,
  temMetas,
  meta,
  formata,
}: Props) {
  const [indice, setIndice] = useState(0)
  const [reduzido, setReduzido] = useState(false)

  // Contas fixas e faturas contam juntas: sao os dois compromissos fechados do
  // mes, e separar os dois fazia a barra dizer "tudo em dia" com a fatura do
  // cartao - quase sempre a maior delas - ainda em aberto.
  const pagos = contasPagas + faturasPagas
  const totalCompromissos = totalContas + totalFaturas
  const faltamPagar = totalCompromissos - pagos
  const valorEmAberto = contasFixas + faturas - contasFixasPagas - faturasPagasValor

  const progressoMeta = meta && meta.alvo > 0 ? Math.min(100, Math.round((meta.atual / meta.alvo) * 100)) : 0
  const fatiaInvestida = patrimonio > 0 ? Math.round((investimentos / patrimonio) * 100) : 0

  const frases = [
    sobrou >= 0 ? `Sobraram ${formata(sobrou)} no seu mês.` : `Seu mês está ${formata(Math.abs(sobrou))} no vermelho.`,
    faltamPagar > 0
      ? `Falta${faltamPagar === 1 ? "" : "m"} ${faltamPagar} ${
          faltamPagar === 1 ? "conta" : "contas"
        } para pagar, ${formata(valorEmAberto)} no total.`
      : totalCompromissos > 0
        ? "Contas fixas e faturas do mês, tudo pago."
        : `Suas contas fixas somam ${formata(contasFixas)}.`,
    meta ? `${meta.titulo} está em ${progressoMeta}% da sua meta.` : `Você tem ${formata(investimentos)} investidos.`,
    faturas > 0 ? `As faturas dos cartões estão em ${formata(faturas)}.` : "Nenhuma fatura lançada neste mês.",
  ]

  // Saldo projetado + investido + metas = patrimonio em dezembro. Exatamente a
  // mesma regra do card "Patrimonio total" do painel: duas definicoes
  // diferentes de patrimonio na mesma tela seria pior que nenhuma, e quem
  // comparasse os dois numeros nao teria como saber qual acreditar.
  const saldoDezembro = dezembro ? dezembro.saldoHoje + dezembro.planejado : 0
  const patrimonioDezembro = saldoDezembro + investimentos + (dezembro?.guardadoEmMetas ?? 0)

  // A pergunta que originou o app entra na rotacao. Fica por ultimo de
  // proposito: as outras falam do mes, esta olha adiante.
  if (dezembro) {
    frases.push(
      patrimonioDezembro >= 0
        ? `Em dezembro você deve ter ${formata(patrimonioDezembro)}.`
        : `Em dezembro você fecha ${formata(Math.abs(patrimonioDezembro))} no vermelho.`,
    )
  }

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
    const t = window.setInterval(() => setIndice((i) => (i + 1) % frases.length), INTERVALO_MS)
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
          {/* min-h reserva o espaco de duas linhas: sem isso o cartao inteiro
              pula de altura a cada troca, porque as frases tem tamanhos
              diferentes - e o movimento de layout chama mais atencao que o
              esmaecimento. */}
          <div aria-live="polite" className="mt-2 min-h-[3.5rem]">
            {/* key força a remontagem a cada troca, que e o que reinicia a
                animacao. Sem ela o texto mudaria de uma vez, ja opaco. */}
            <p
              key={indice}
              className="text-lg leading-snug"
              style={{
                color: "var(--link)",
                fontFamily: "var(--font-heading)",
                animation: reduzido ? undefined : `ia-say ${INTERVALO_MS}ms ease-in-out both`,
              }}
            >
              {frases[indice]}
            </p>
          </div>

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

            {totalCompromissos > 0 && (
              <Barra
                rotulo="Contas fixas e faturas pagas"
                valor={`${pagos} de ${totalCompromissos}`}
                percentual={(pagos / totalCompromissos) * 100}
                cor="var(--success)"
                detalhe={
                  faltamPagar > 0 ? `faltam ${formata(valorEmAberto)}` : "tudo em dia neste mês"
                }
              />
            )}
          </div>

          {/* O fim do ano, com a conta aberta.

              Cada parcela aparece com o nome de onde saiu. Numero sobre o
              proprio dinheiro sem origem visivel nao se confere, e o que nao
              se confere nao se usa para decidir nada. */}
          {dezembro && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs uppercase tracking-[0.1em] text-muted">Em dezembro você deve ter</p>
              <p
                className="mt-1.5 text-2xl tabular-nums"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: patrimonioDezembro >= 0 ? "var(--income)" : "var(--expense)",
                }}
              >
                {formata(patrimonioDezembro)}
              </p>

              <dl className="mt-4 space-y-1.5 text-[13px]">
                {[
                  { termo: "Saldo de hoje", valor: dezembro.saldoHoje, nota: "saldo base + o que sobrou neste mês" },
                  {
                    termo: `Sobra de ${dezembro.mesesConsiderados} ${dezembro.mesesConsiderados === 1 ? "mês planejado" : "meses planejados"}`,
                    valor: dezembro.planejado,
                    nota: "receita menos contas fixas e faturas, mês a mês",
                  },
                  { termo: "Investimentos", valor: investimentos, nota: "valor aplicado, como você cadastrou" },
                  ...(dezembro.guardadoEmMetas > 0
                    ? [{
                        termo: "Metas",
                        valor: dezembro.guardadoEmMetas,
                        nota: "já guardado, somando todas as suas metas",
                      }]
                    : []),
                ].map((linha) => (
                  <div key={linha.termo} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-muted">
                      {linha.termo} <span className="text-text-3">· {linha.nota}</span>
                    </dt>
                    <dd className="shrink-0 tabular-nums text-text">{formata(linha.valor)}</dd>
                  </div>
                ))}
              </dl>

              {/* O aviso trocou de conteudo junto com a conta. Antes explicava
                  por que metas NAO somavam; agora somam, e o risco virou o
                  oposto: contar o mesmo dinheiro duas vezes. */}
              {dezembro.guardadoEmMetas > 0 && (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  As metas entram como dinheiro separado. Se o valor de uma meta já estiver
                  dentro do seu saldo ou dos investimentos, ele está sendo contado duas vezes.
                </p>
              )}
            </div>
          )}

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
