import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSummary } from './transaction.service'

export async function generateInsights(userId: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const now = new Date()
  const summary = await getSummary(userId, String(now.getMonth() + 1), String(now.getFullYear()))

  const { total_income, total_expense, balance } = summary.totals
  const byCategory = summary.byCategory

  const categoryText = byCategory.length === 0
    ? 'Nenhuma transação categorizada ainda.'
    : byCategory.map((c: { category: string; type: string; total: string; count: string }) =>
      `- ${c.category} (${c.type === 'income' ? 'receita' : 'despesa'}): R$ ${Number(c.total).toFixed(2)} em ${c.count} transação(ões)`
    ).join('\n')

  const prompt = `Você é um assistente financeiro pessoal. Analise os dados financeiros deste mês e do ano até agora e forneça insights práticos e motivadores em português brasileiro.

Dados do mês atual:
- Receita total: R$ ${Number(total_income).toFixed(2)}
- Despesa total: R$ ${Number(total_expense).toFixed(2)}
- Saldo: R$ ${Number(balance).toFixed(2)}

Por categoria:
${categoryText}

Forneça:
1. Uma avaliação geral da saúde financeira (2-3 frases)
2. 2-3 pontos positivos ou de atenção
3. 1-2 sugestões práticas para o próximo mês

Seja direto, amigável e use linguagem simples. Não use markdown, apenas texto corrido com quebras de linha.`

  const result = await model.generateContent(prompt)
  const insights = result.response.text()

  return { insights, summary: summary.totals }
}
