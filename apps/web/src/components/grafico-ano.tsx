const KEYFRAMES = `@keyframes pv-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}`

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export type MesDoAno = { mes: number; entrou: number; saiu: number }

type Props = {
  dados: MesDoAno[]
  mesAtual: number
  formata: (valor: number) => string
}

/**
 * Entradas e saídas no ano — 12 pares de barras, sem biblioteca de gráfico.
 *
 * Recharts daria o mesmo dado, mas não este desenho: barras finas com o topo
 * arredondado e a base reta, subindo do chão. São dois divs e uma animação; a
 * lib entraria só para reimplementar o que o CSS já faz, e ainda por cima
 * dificultaria o arredondamento assimétrico.
 */
export function GraficoAno({ dados, mesAtual, formata }: Props) {
  // A escala é comum às duas séries: normalizar cada uma pelo próprio máximo
  // faria uma despesa pequena parecer do tamanho de uma receita grande.
  const maior = Math.max(...dados.flatMap((m) => [m.entrou, m.saiu]), 1)

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <style>{KEYFRAMES}</style>

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl text-text" style={{ fontFamily: "var(--font-heading)" }}>
          Entradas e saídas no ano
        </h2>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--income)" }} />
            entrou
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--expense)" }} />
            saiu
          </span>
        </div>
      </div>

      <div className="mt-6 flex h-[200px] items-end gap-2">
        {dados.map((m) => {
          const atual = m.mes === mesAtual
          return (
            <div key={m.mes} className="flex h-full flex-1 flex-col items-center gap-2.5">
              <div className="flex w-full flex-1 items-end justify-center gap-[3px]">
                {/* title dá o valor no hover sem exigir tooltip: as barras são
                    estreitas e o eixo Y foi removido, então sem isso o número
                    exato ficaria inacessível. */}
                <span
                  title={`${MESES_CURTOS[m.mes - 1]}: entrou ${formata(m.entrou)}`}
                  className="w-[38%] origin-bottom"
                  style={{
                    height: `${(m.entrou / maior) * 100}%`,
                    background: "var(--income)",
                    borderRadius: "999px 999px 3px 3px",
                    animation: "pv-rise 900ms cubic-bezier(.3,0,.2,1) both",
                  }}
                />
                <span
                  title={`${MESES_CURTOS[m.mes - 1]}: saiu ${formata(m.saiu)}`}
                  className="w-[38%] origin-bottom"
                  style={{
                    height: `${(m.saiu / maior) * 100}%`,
                    background: "var(--expense)",
                    borderRadius: "999px 999px 3px 3px",
                    animation: "pv-rise 900ms cubic-bezier(.3,0,.2,1) both",
                  }}
                />
              </div>
              <span
                className="text-[11px]"
                style={{ color: atual ? "var(--link)" : "var(--text-3)", fontWeight: atual ? 600 : 400 }}
              >
                {MESES_CURTOS[m.mes - 1]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
