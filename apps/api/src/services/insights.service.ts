import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSummary } from './transaction.service'
import { getBillPayments, getCardExpenses, getMonthlyConfig } from './finance.service'
import { listInvestments, getPortfolioSummary } from './investments.service'

export async function generateInsights(userId: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [summary, bills, expenses, config, investments, portfolio] = await Promise.all([
    getSummary(userId, String(month), String(year)),
    getBillPayments(userId, month, year),
    getCardExpenses(userId, month, year),
    getMonthlyConfig(userId, month, year),
    listInvestments(userId),
    getPortfolioSummary(userId),
  ])

  const { total_income, total_expense } = summary.totals
  const byCategory = summary.byCategory

  const totalBills = bills.reduce((s: number, b: { amount: string }) => s + Number(b.amount), 0)
  const totalPaid = bills.filter((b: { paid: boolean }) => b.paid).reduce((s: number, b: { amount: string }) => s + Number(b.amount), 0)
  const totalCards = expenses.reduce((s: number, e: { amount: string }) => s + Number(e.amount), 0)
  const estimatedIncome = Number(config?.estimated_income || 0)
  const saldo = Number(config?.balance || 0)
  const investmentsValue = Number(config?.investments || 0)
  const leftover = estimatedIncome - totalBills - totalCards
  const balanceReal = saldo + leftover
  const patrimonio = balanceReal + investmentsValue

  // Totais da carteira de investimentos
  const totalInvested = portfolio.reduce((s: number, p: { total_invested: string }) => s + Number(p.total_invested), 0)
  const totalCurrent = portfolio.reduce((s: number, p: { total_current: string }) => s + Number(p.total_current), 0)
  const totalProfit = totalCurrent - totalInvested
  const returnPct = totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : '0'

  const billsText = bills.length === 0 ? 'Nenhuma conta fixa cadastrada.'
    : bills.map((b: { name: string; amount: string; paid: boolean; due_day?: number }) =>
        `- ${b.name}: R$ ${Number(b.amount).toFixed(2)} — ${b.paid ? 'PAGA' : 'PENDENTE'}${b.due_day ? ` (vence dia ${b.due_day})` : ''}`
      ).join('\n')

  const cardsText = expenses.length === 0 ? 'Nenhuma fatura de cartão lançada.'
    : expenses.map((e: { card_name: string; amount: string; due_day?: number }) =>
        `- ${e.card_name}: R$ ${Number(e.amount).toFixed(2)}${e.due_day ? ` (vence dia ${e.due_day})` : ''}`
      ).join('\n')

  const categoryText = byCategory.length === 0 ? 'Nenhuma transação categorizada.'
    : byCategory.map((c: { category: string; type: string; total: string; count: string }) =>
        `- ${c.category} (${c.type === 'income' ? 'receita' : 'despesa'}): R$ ${Number(c.total).toFixed(2)} em ${c.count} transação(ões)`
      ).join('\n')

  const portfolioText = portfolio.length === 0 ? 'Nenhum investimento cadastrado.'
    : portfolio.map((p: { icon?: string; name: string; total_invested: string; total_current: string; total_profit: string }) => {
        const profit = Number(p.total_current) - Number(p.total_invested)
        const pct = Number(p.total_invested) > 0 ? ((profit / Number(p.total_invested)) * 100).toFixed(2) : '0'
        return `- ${p.icon || '📈'} ${p.name}: investido R$ ${Number(p.total_invested).toFixed(2)}, atual R$ ${Number(p.total_current).toFixed(2)} (${profit >= 0 ? '+' : ''}${pct}%)`
      }).join('\n')

  const investmentsDetail = investments.length === 0 ? 'Nenhum ativo cadastrado.'
    : investments.slice(0, 10).map((i: { type_icon?: string; name: string; invested_amount: string; current_value: string; monthly_rate: string; target_percent: string }) =>
        `- ${i.type_icon || '📈'} ${i.name}: R$ ${Number(i.current_value).toFixed(2)}${Number(i.monthly_rate) > 0 ? ` (${i.monthly_rate}%/mês)` : ''}${Number(i.target_percent) > 0 ? ` — meta: ${i.target_percent}% da carteira` : ''}`
      ).join('\n')

  const prompt = `Você é um assistente financeiro pessoal chamado FinTrack AI. Analise os dados financeiros completos do usuário e forneça insights práticos, motivadores e personalizados em português brasileiro.

=== RESUMO DO MÊS (${now.toLocaleString('pt-BR', { month: 'long' })} de ${year}) ===
- Receita estimada: R$ ${estimatedIncome.toFixed(2)}
- Receita registrada em transações: R$ ${Number(total_income).toFixed(2)}
- Despesas em transações: R$ ${Number(total_expense).toFixed(2)}
- Total contas fixas: R$ ${totalBills.toFixed(2)} (pagas: R$ ${totalPaid.toFixed(2)}, pendentes: R$ ${(totalBills - totalPaid).toFixed(2)})
- Total faturas cartões: R$ ${totalCards.toFixed(2)}
- Sobrou no mês: R$ ${leftover.toFixed(2)}
- Saldo real (base + sobrou): R$ ${balanceReal.toFixed(2)}
- Patrimônio total (saldo + investimentos): R$ ${patrimonio.toFixed(2)}

=== CONTAS FIXAS ===
${billsText}

=== FATURAS DOS CARTÕES ===
${cardsText}

=== TRANSAÇÕES POR CATEGORIA ===
${categoryText}

=== CARTEIRA DE INVESTIMENTOS ===
- Total investido: R$ ${totalInvested.toFixed(2)}
- Valor atual da carteira: R$ ${totalCurrent.toFixed(2)}
- Lucro/Prejuízo total: R$ ${totalProfit.toFixed(2)} (${returnPct}%)

Por categoria:
${portfolioText}

Ativos:
${investmentsDetail}

Com base em TODOS esses dados, forneça uma análise completa e personalizada:
1. Avaliação geral da saúde financeira do mês
2. Alertas importantes (contas pendentes, dívidas altas, saldo baixo, etc.)
3. Análise da carteira de investimentos (se houver) — rentabilidade, diversificação
4. 2-3 pontos positivos
5. 2-3 sugestões práticas e específicas para melhorar as finanças

Seja direto, amigável, específico com os números reais do usuário. Não use markdown, apenas texto corrido com quebras de linha.`

  const result = await model.generateContent(prompt)
  const insights = result.response.text()

  return {
    insights,
    summary: {
      ...summary.totals,
      estimated_income: config?.estimated_income || 0,
      total_bills: totalBills,
      total_paid: totalPaid,
      total_cards: totalCards,
      leftover,
      balance: balanceReal,
      investments: investmentsValue,
      patrimonio,
      portfolio_invested: totalInvested,
      portfolio_current: totalCurrent,
      portfolio_profit: totalProfit,
    }
  }
}
