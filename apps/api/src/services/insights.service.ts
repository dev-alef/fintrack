import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSummary } from './transaction.service'
import { getBillPayments, getCardExpenses, getMonthlyConfig } from './finance.service'

export async function generateInsights(userId: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [summary, bills, expenses, config] = await Promise.all([
    getSummary(userId, String(month), String(year)),
    getBillPayments(userId, month, year),
    getCardExpenses(userId, month, year),
    getMonthlyConfig(userId, month, year),
  ])

  const { total_income, total_expense } = summary.totals
  const byCategory = summary.byCategory

  const totalBills = bills.reduce((s: number, b: { amount: string }) => s + Number(b.amount), 0)
  const totalPaid = bills.filter((b: { paid: boolean }) => b.paid).reduce((s: number, b: { amount: string }) => s + Number(b.amount), 0)
  const totalCards = expenses.reduce((s: number, e: { amount: string }) => s + Number(e.amount), 0)
  const estimatedIncome = Number(config?.estimated_income || 0)
  const saldo = Number(config?.balance || 0)
  const investments = Number(config?.investments || 0)
  const leftover = estimatedIncome - totalBills - totalCards

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

  const prompt = `Você é um assistente financeiro pessoal chamado FinTrack AI. Analise os dados financeiros completos deste mês e do ano até agora e forneça insights práticos e motivadores em português brasileiro.

=== RESUMO DO MÊS ===
- Receita estimada: R$ ${estimatedIncome.toFixed(2)}
- Receita registrada em transações: R$ ${Number(total_income).toFixed(2)}
- Despesas em transações: R$ ${Number(total_expense).toFixed(2)}
- Total contas fixas: R$ ${totalBills.toFixed(2)} (pagas: R$ ${totalPaid.toFixed(2)}, pendentes: R$ ${(totalBills - totalPaid).toFixed(2)})
- Total faturas cartões: R$ ${totalCards.toFixed(2)}
- Sobrou no mês: R$ ${leftover.toFixed(2)}
- Saldo atual: R$ ${saldo.toFixed(2)}
- Investimentos: R$ ${investments.toFixed(2)}

=== CONTAS FIXAS ===
${billsText}

=== FATURAS DOS CARTÕES ===
${cardsText}

=== TRANSAÇÕES POR CATEGORIA ===
${categoryText}

Com base nesses dados, forneça:
1. Avaliação geral da saúde financeira do mês (2-3 frases)
2. Alertas importantes (contas pendentes, faturas altas, saldo negativo, etc.)
3. 2-3 pontos positivos ou de atenção
4. 1-2 sugestões práticas para o próximo mês

Seja direto, amigável e use linguagem simples. Não use markdown, apenas texto corrido com quebras de linha.`

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
      balance: saldo,
      investments,
    }
  }
}
