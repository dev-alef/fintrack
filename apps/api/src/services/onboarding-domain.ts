import { z } from 'zod'
import { businessToday } from './business-calendar'

// Incomplete candidates are valid drafts. Only readyFields may reach financial tables.
const money = z.number().finite().min(0).max(999999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Use até duas casas decimais')
const signedMoney = z.number().finite().min(-999999999.99).max(999999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001)
const name = z.string().trim().min(1).max(100)
const date = z.iso.date().refine(v => v >= '1900-01-01' && v <= '2100-12-31')
const period = { month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2099) }
export const schemas = {
  config: z.object({ ...period, balance: signedMoney.optional(), estimated_income: money.optional() }).strict().refine(v => v.balance !== undefined || v.estimated_income !== undefined, 'Informe saldo ou receita'),
  bill: z.object({ name, amount: money, due_day: z.number().int().min(1).max(31), recurring: z.literal(true) }).strict(),
  card: z.object({ name, due_day: z.number().int().min(1).max(31) }).strict(),
  invoice: z.object({ card_ref: z.uuid(), ...period, amount: money }).strict(),
  loan: z.object({ person: name, direction: z.enum(['payable', 'receivable']), amount: money.refine(v => v > 0), due_date: date.optional(), description: z.string().max(300).optional() }).strict(),
  client: z.object({ name, contact: z.string().max(200).optional() }).strict(),
  subscription: z.object({ client_ref: z.uuid(), service_name: name, amount: money.refine(v => v > 0), interval_months: z.union([z.literal(1), z.literal(3), z.literal(12)]), start_date: date }).strict(),
  expense: z.object({ title: name, amount: money.refine(v => v > 0), spent_on: date.refine(v => v <= businessToday(), 'Registre apenas despesas já realizadas'), category: z.string().max(80).optional() }).strict(),
}
export const kinds = ['config', 'bill', 'card', 'invoice', 'loan', 'client', 'subscription', 'expense'] as const
export type Kind = typeof kinds[number]
export const itemSchema = z.object({
  id: z.uuid(), kind: z.enum(kinds),
  fields: z.record(z.string().max(40), z.union([z.string().max(500), z.number().finite(), z.boolean()])).refine(v => Object.keys(v).length <= 12),
  action: z.enum(['pending', 'create', 'reuse']).default('pending'),
  existing_id: z.uuid().optional(), duplicate_ack: z.boolean().default(false),
}).strict()
export const draftSchema = z.object({
  profile: z.enum(['personal', 'professional', 'both']),
  ...period,
  step: z.enum(['config', 'bill', 'card', 'loan', 'client', 'subscription', 'expense', 'review']),
  skipped: z.array(z.enum(kinds)).max(8).default([]),
  absent: z.array(z.enum(kinds)).max(8).default([]),
  items: z.array(itemSchema).max(80).refine(items => new Set(items.map(i => i.id)).size === items.length, 'Identificadores repetidos'),
}).strict()
export type Draft = z.infer<typeof draftSchema>
export type Item = z.infer<typeof itemSchema>
export const titles: Record<Kind, string> = { config: 'Saldo e receita', bill: 'Conta fixa', card: 'Cartão', invoice: 'Fatura', loan: 'Empréstimo', client: 'Cliente', subscription: 'Assinatura', expense: 'Despesa profissional' }
export const fieldLabels: Record<string, string> = { month: 'mês', year: 'ano', balance: 'Saldo Atual', estimated_income: 'receita estimada', name: 'nome', amount: 'valor', due_day: 'dia de vencimento', recurring: 'confirmação de recorrência', card_ref: 'cartão', person: 'pessoa', direction: 'Eu devo ou Me devem', client_ref: 'cliente', service_name: 'serviço', interval_months: 'periodicidade', start_date: 'primeiro vencimento', title: 'descrição', spent_on: 'data da despesa' }
export function allowed(kind: Kind, profile: Draft['profile']) {
  return profile === 'both' || (['client', 'subscription', 'expense'].includes(kind) ? profile === 'professional' : profile === 'personal')
}
export function validateItem(item: Item) {
  const result = schemas[item.kind].safeParse(item.fields)
  return result.success ? [] : [...new Set(result.error.issues.map(i => fieldLabels[String(i.path[0])] || i.message))]
}
export function emptyDraft(): Draft {
  const today = businessToday()
  return { profile: 'both', year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)), step: 'config', skipped: [], absent: [], items: [] }
}
export function nextQuestion(draft: Draft) {
  const incomplete = draft.items.find(i => allowed(i.kind, draft.profile) && i.action !== 'reuse' && (i.kind === draft.step || (draft.step === 'card' && i.kind === 'invoice')) && validateItem(i).length)
  if (incomplete) return `Para ${titles[incomplete.kind]} (${incomplete.fields.name || incomplete.fields.person || incomplete.fields.service_name || incomplete.fields.title || 'sem nome'}), falta conferir: ${validateItem(incomplete).join(', ')}.`
  const questions: Record<string, string> = {
    config: 'Quanto você tem disponível hoje e qual é a receita estimada integral do mês?',
    bill: 'Quais contas fixas você paga? Informe nome, valor e vencimento.',
    card: 'Quais cartões você usa? Informe nome, vencimento e os valores das faturas que já conhece.',
    loan: 'Você deve para alguém ou tem dinheiro a receber? Informe pessoa, saldo pendente e prazo, se souber.',
    client: 'Quais clientes você atende? Informe os nomes e, se quiser, o contato.',
    subscription: 'Quais serviços por assinatura oferece? Informe cliente, serviço, valor, periodicidade e primeiro vencimento.',
    expense: 'Já teve alguma despesa profissional? Informe descrição, valor e data.',
    review: 'Confira os itens abaixo e escolha o que deseja cadastrar. Nada é salvo nas finanças até confirmar.',
  }
  if (draft.step !== 'review' && draft.items.some(i => i.kind === draft.step)) return 'Dados deste bloco preparados. Quer adicionar outro item ou continuar para a próxima etapa?'
  return questions[draft.step]
}
