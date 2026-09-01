const CORES = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"]

export type FatiaCategoria = { nome: string; valor: number }

type Props = {
  fatias: FatiaCategoria[]
  formata: (valor: number) => string
}

/**
 * "Para onde foi" — rosca à esquerda, legenda à direita.
 *
 * A rosca é um `conic-gradient` num círculo com um furo por cima, e não um SVG
 * de biblioteca. Além de ser o desenho pedido, evita o problema que o gráfico
 * anterior tinha: a legenda do Recharts fica embaixo e quebra em telas
 * estreitas, empurrando o gráfico para cima e cortando as fatias.
 */
export function DonutCategorias({ fatias, formata }: Props) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl text-text" style={{ fontFamily: "var(--font-heading)" }}>
          Para onde foi
        </h2>
        <p className="mt-4 text-sm text-muted">Nenhuma despesa categorizada neste período.</p>
      </div>
    )
  }

  // As fatias mais altas primeiro: a rosca fica legível e a legenda vira um
  // ranking, que é a pergunta real de quem olha ("no que gastei mais?").
  const ordenadas = [...fatias].sort((a, b) => b.valor - a.valor)

  // Cada parada de cor começa onde a anterior terminou. O acumulador precisa
  // ser calculado em porcentagem, e não por fatia isolada, senão as fatias se
  // sobrepõem e a última nunca fecha o círculo.
  let acumulado = 0
  const paradas = ordenadas.map((f, i) => {
    const inicio = acumulado
    acumulado += (f.valor / total) * 100
    return `${CORES[i % CORES.length]} ${inicio}% ${acumulado}%`
  })

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl text-text" style={{ fontFamily: "var(--font-heading)" }}>
        Para onde foi
      </h2>

      <div className="mt-5 flex items-center gap-6">
        <div
          className="relative h-[148px] w-[148px] flex-none rounded-full"
          style={{ background: `conic-gradient(${paradas.join(", ")})` }}
          role="img"
          aria-label={`Distribuição de despesas por categoria, total ${formata(total)}`}
        >
          <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-surface">
            <span className="text-lg leading-none text-text" style={{ fontFamily: "var(--font-heading)" }}>
              {formata(total)}
            </span>
            <span className="mt-1 text-[11px] text-muted">no período</span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
          {ordenadas.map((f, i) => (
            <li key={f.nome} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: CORES[i % CORES.length] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-text">{f.nome}</span>
              <span className="tabular-nums text-muted">{Math.round((f.valor / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
