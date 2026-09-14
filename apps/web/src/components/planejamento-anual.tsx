import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDownToLine, Check, Loader2 } from "lucide-react"
import api from "../services/api"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

export type CartaoDoAno = {
  id: string
  name: string
  color: string
  monthly_breakdown?: { month: number; amount: string; paid?: boolean }[]
}

export type LinhaDoAno = {
  month: number
  estimated_income: string
  total_fixed_bills: string
  total_card_expenses: string
}

type Rascunho = {
  receita: string
  cartoes: Record<string, string>
}

export type MesProjetado = { receita: number; faturas: number }

/**
 * "Seguindo assim, quanto eu tenho em dezembro?"
 *
 * A pergunta que originou a Provisão, e a única das quatro que o app não
 * respondia: havia o total do ano, mas não o acumulado — quanto sobra no bolso
 * depois de somar mês a mês o que entra e o que sai.
 *
 * Mora aqui, junto da tabela que produz os dados que ela soma, mas quem exibe
 * o resultado é o cartão da IA no painel — lá o número é fechado com
 * investimentos e metas, virando o patrimônio de dezembro.
 *
 * Esta tabela já mostrou o mesmo cálculo no rodapé, e saiu: sem investimentos
 * e metas dava um valor menor que o do painel, e a mesma pergunta respondida
 * com dois números na mesma tela não ajuda ninguém a decidir nada.
 *
 * Só conta mês PLANEJADO. Mês sem receita cadastrada entra como zero, e não
 * como "vai repetir o atual": chutar a favor infla a projeção justamente de
 * quem ainda não planejou, que é quem mais precisaria do número honesto.
 */
export function projecaoFimDoAno({
  saldoAtual,
  mesAtual,
  fixasPorMes,
  meses,
}: {
  saldoAtual: number
  mesAtual: number
  fixasPorMes: number
  meses: Map<number, MesProjetado>
}): { valor: number; mesesConsiderados: number; somaPlanejada: number } {
  let somaPlanejada = 0
  let mesesConsiderados = 0

  for (let m = mesAtual + 1; m <= 12; m++) {
    const dados = meses.get(m)
    if (!dados || dados.receita <= 0) continue
    somaPlanejada += dados.receita - dados.faturas - fixasPorMes
    mesesConsiderados++
  }

  // As parcelas voltam separadas, e nao so o total: quem le um numero sobre o
  // proprio dinheiro precisa poder conferir de onde ele veio.
  return { valor: saldoAtual + somaPlanejada, mesesConsiderados, somaPlanejada }
}

/**
 * Planejamento do ano inteiro numa tela só.
 *
 * # Por que existe
 *
 * Para saber onde o ano termina, é preciso ter receita e fatura de cada mês
 * até dezembro. Antes disso só dava para preencher um mês de cada vez,
 * trocando o seletor e recarregando a tela a cada um — doze vezes. Ninguém faz
 * isso, e sem isso a visão anual fica pela metade.
 *
 * A tabela anual já existia aqui, só que apenas para leitura. Torná-la
 * editável foi de propósito, em vez de criar uma tela nova: é a mesma tabela
 * que a pessoa já usa para olhar o ano, no mesmo lugar.
 *
 * # Duas naturezas de dado, dois comportamentos
 *
 * **Valores** (receita, fatura) são planejamento: mudam em rascunho e só vão
 * ao servidor quando você confirma. Dá para preencher doze meses e revisar
 * antes de gravar.
 *
 * **Pago** é fato consumado, como nas contas fixas: marcou, gravou. Segurar
 * isso num rascunho faria a pessoa marcar a fatura, sair da tela e descobrir
 * depois que não tinha salvo.
 */
export function PlanejamentoAnual({
  ano,
  mesAtual,
  cartoes,
  linhas,
  formata,
}: {
  ano: number
  mesAtual: number
  cartoes: CartaoDoAno[]
  linhas: LinhaDoAno[]
  formata: (valor: number) => string
}) {
  const qc = useQueryClient()
  const [rascunho, setRascunho] = useState<Record<number, Rascunho>>({})
  const [salvo, setSalvo] = useState(false)

  // Contas fixas valem para todos os meses - o resumo anual as soma sem filtro
  // de mês. Por isso não há coluna editável para elas aqui: mexer numa conta
  // fixa muda o ano inteiro, e isso se faz na lista acima, não célula a célula.
  const fixasPorMes = Number(linhas[0]?.total_fixed_bills || 0)

  const valorSalvo = (mes: number) => {
    const linha = linhas.find((l) => l.month === mes)
    return {
      receita: linha?.estimated_income ? String(Number(linha.estimated_income)) : "",
      cartoes: Object.fromEntries(
        cartoes.map((c) => {
          const b = c.monthly_breakdown?.find((x) => x.month === mes)
          return [c.id, b?.amount ? String(Number(b.amount)) : ""]
        }),
      ),
    }
  }

  const valorAtual = (mes: number): Rascunho => rascunho[mes] ?? valorSalvo(mes)

  const mexeu = useMemo(() => Object.keys(rascunho).length > 0, [rascunho])

  function editaReceita(mes: number, valor: string) {
    setSalvo(false)
    setRascunho((r) => ({ ...r, [mes]: { ...valorAtual(mes), receita: valor } }))
  }

  function editaCartao(mes: number, cartaoId: string, valor: string) {
    setSalvo(false)
    const atual = valorAtual(mes)
    setRascunho((r) => ({
      ...r,
      [mes]: { ...atual, cartoes: { ...atual.cartoes, [cartaoId]: valor } },
    }))
  }

  /**
   * Copia a linha para todos os meses seguintes. É o atalho que torna o ano
   * preenchível: salário e fatura costumam repetir, e os meses que fogem do
   * padrão você ajusta depois - bem menos trabalho que digitar os doze.
   */
  function repetirParaBaixo(mes: number) {
    setSalvo(false)
    const origem = valorAtual(mes)
    setRascunho((r) => {
      const novo = { ...r }
      for (let m = mes + 1; m <= 12; m++) {
        novo[m] = { receita: origem.receita, cartoes: { ...origem.cartoes } }
      }
      return novo
    })
  }

  const salvar = useMutation({
    mutationFn: () => {
      const meses = Object.entries(rascunho).map(([mes, dados]) => ({
        month: Number(mes),
        estimated_income: dados.receita === "" ? 0 : Number(dados.receita),
        cards: cartoes
          .filter((c) => dados.cartoes[c.id] !== undefined && dados.cartoes[c.id] !== "")
          .map((c) => ({ cardId: c.id, amount: Number(dados.cartoes[c.id]) })),
      }))
      return api.post("/finance/planejamento", { year: ano, meses })
    },
    onSuccess: () => {
      setRascunho({})
      setSalvo(true)
      for (const k of ["annualSummary", "annual", "config", "expenses"]) {
        qc.invalidateQueries({ queryKey: [k] })
      }
    },
  })

  const marcarFatura = useMutation({
    mutationFn: (d: { cardId: string; month: number; paid: boolean }) =>
      api.post("/finance/cards/expenses/toggle", { ...d, year: ano }),
    onSuccess: () => {
      for (const k of ["annual", "expenses", "annualSummary"]) {
        qc.invalidateQueries({ queryKey: [k] })
      }
    },
  })

  const totalReceita = MESES.reduce((s, _, i) => s + Number(valorAtual(i + 1).receita || 0), 0)

  // So os meses planejados, igual as linhas acima: mes sem receita mostra "—"
  // na coluna de contas fixas, e somar os doze aqui faria o total do rodape
  // nao fechar com o que esta visivel.
  const mesesPlanejados = MESES.filter((_, i) => valorAtual(i + 1).receita !== "").length
  const totalFixas = fixasPorMes * mesesPlanejados
  const totalGastos = MESES.reduce((s, _, i) => {
    const v = valorAtual(i + 1)
    const cart = cartoes.reduce((a, c) => a + Number(v.cartoes[c.id] || 0), 0)
    return s + cart + (v.receita ? fixasPorMes : 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Preencha um mês e use{" "}
          <ArrowDownToLine className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" /> para
          repetir nos seguintes. Ajuste depois só os que fogem do padrão.
        </p>

        <div className="flex items-center gap-3">
          {salvo && !mexeu && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
              Salvo
            </span>
          )}
          <Button type="button" onClick={() => salvar.mutate()} disabled={!mexeu || salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {mexeu ? "Salvar o ano" : "Sem alterações"}
          </Button>
        </div>
      </div>

      {salvar.isError && (
        <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          Não foi possível salvar. Nada foi alterado — pode tentar de novo.
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Mês</TableHead>
              <TableHead className="text-right">Receita estimada</TableHead>
              {cartoes.map((c) => (
                <TableHead key={c.id} className="text-right" style={{ color: c.color }}>
                  {c.name}
                </TableHead>
              ))}
              <TableHead className="text-right">Contas fixas</TableHead>
              {/* Gastos = contas fixas + todas as faturas. Estava na tabela
                  antiga e faz falta: sem ela, para saber o que sai no mes e
                  preciso somar de cabeca as colunas de cartao mais as fixas. */}
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Sobra</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {MESES.map((nome, i) => {
              const mes = i + 1
              const v = valorAtual(mes)
              const receita = Number(v.receita || 0)
              const cart = cartoes.reduce((a, c) => a + Number(v.cartoes[c.id] || 0), 0)
              // Sem receita, o mês ainda não foi planejado: mostrar "sobra
              // negativa" das contas fixas assustaria sem significar nada.
              const sobra = v.receita ? receita - cart - fixasPorMes : 0
              const ehAtual = mes === mesAtual
              const editado = rascunho[mes] !== undefined

              return (
                <TableRow
                  key={nome}
                  className={cn(ehAtual && "bg-primary/10", editado && "bg-warning/5")}
                >
                  <TableCell className={cn(ehAtual ? "font-bold text-primary" : "text-text")}>
                    {nome}
                  </TableCell>

                  <TableCell className="text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={v.receita}
                      onChange={(e) => editaReceita(mes, e.target.value)}
                      placeholder="—"
                      aria-label={`Receita estimada de ${nome}`}
                      className="w-28 rounded-md border border-border bg-field px-2 py-1 text-right text-sm text-text tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </TableCell>

                  {cartoes.map((c) => {
                    const pago = c.monthly_breakdown?.find((x) => x.month === mes)?.paid ?? false
                    const temValor = Number(v.cartoes[c.id] || 0) > 0
                    return (
                      <TableCell key={c.id} className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            value={v.cartoes[c.id] ?? ""}
                            onChange={(e) => editaCartao(mes, c.id, e.target.value)}
                            placeholder="—"
                            aria-label={`Fatura ${c.name} de ${nome}`}
                            className="w-24 rounded-md border border-border bg-field px-2 py-1 text-right text-sm text-text tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          {/* Só aparece com fatura lançada: marcar "pago" numa
                              fatura vazia não quer dizer nada.

                              Mesmo ponto redondo das contas fixas no painel -
                              é a mesma ação, e um controle de aparência
                              diferente pareceria outra coisa. */}
                          {temValor && (
                            <button
                              type="button"
                              onClick={() => marcarFatura.mutate({ cardId: c.id, month: mes, paid: !pago })}
                              aria-pressed={pago}
                              aria-label={`Fatura ${c.name} de ${nome} paga`}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              style={{ background: pago ? "var(--success)" : "transparent" }}
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: pago ? "var(--surface)" : "transparent" }}
                              />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    )
                  })}

                  <TableCell className="text-right text-muted tabular-nums">
                    {v.receita ? formata(fixasPorMes) : "—"}
                  </TableCell>

                  <TableCell className="text-right text-expense tabular-nums">
                    {v.receita ? formata(cart + fixasPorMes) : "—"}
                  </TableCell>

                  <TableCell
                    className={cn("text-right tabular-nums", sobra >= 0 ? "text-income" : "text-expense")}
                  >
                    {v.receita ? formata(sobra) : "—"}
                  </TableCell>

                  <TableCell className="text-right">
                    {mes < 12 && (
                      <button
                        type="button"
                        onClick={() => repetirParaBaixo(mes)}
                        title={`Repetir ${nome} até dezembro`}
                        aria-label={`Repetir os valores de ${nome} até dezembro`}
                        className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
                      >
                        <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}

            <TableRow className="border-t-2 border-border font-bold">
              <TableCell className="text-text">Total</TableCell>
              <TableCell className="text-right text-income tabular-nums">{formata(totalReceita)}</TableCell>
              {cartoes.map((c) => (
                <TableCell key={c.id} className="text-right tabular-nums" style={{ color: c.color }}>
                  {formata(
                    MESES.reduce((s, _, i) => s + Number(valorAtual(i + 1).cartoes[c.id] || 0), 0),
                  )}
                </TableCell>
              ))}
              <TableCell className="text-right text-muted tabular-nums">{formata(totalFixas)}</TableCell>
              <TableCell className="text-right text-expense tabular-nums">{formata(totalGastos)}</TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  totalReceita - totalGastos >= 0 ? "text-income" : "text-expense",
                )}
              >
                {formata(totalReceita - totalGastos)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

    </div>
  )
}
