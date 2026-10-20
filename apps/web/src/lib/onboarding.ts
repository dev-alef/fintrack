export const kinds = ['config','bill','card','invoice','loan','client','subscription','expense'] as const
export type Kind = typeof kinds[number]
export type Item = { id:string; kind:Kind; fields:Record<string,string|number|boolean>; action:'pending'|'create'|'reuse'; existing_id?:string; duplicate_ack:boolean }
export type Draft = { conversation_started?:boolean; profile:'personal'|'professional'|'both'; month:number; year:number; step:Exclude<Kind,'invoice'>|'review'; skipped:Kind[]; absent:Kind[]; items:Item[] }
export type SavedDraft = { version:number; data:Draft; question:string; conversation?:{ready:boolean;missing:string[];next_step:Draft['step']}; ai_available:boolean; existing:Record<Kind,Record<string,string|number>[]> }
export type Preview = { version:number; token:string; can_commit:boolean; pending_count:number; current_period:string; reference_period:string; rows:(Item & { issues:string[]; matches:Record<string,string|number>[] })[] }
export type CommitRequest = { version:number; token:string; request_id:string; reference_period:string }
export const titles:Record<Kind,string> = {config:'Saldo e receita',bill:'Contas fixas',card:'Cartões',invoice:'Faturas',loan:'Empréstimos',client:'Clientes',subscription:'Assinaturas',expense:'Despesas profissionais'}
export type Field = { key:string; label:string; type?:'money'|'number'|'date'|'card'|'client'|'checkbox'; options?:[string,string][]; optional?:boolean }
export const fields:Record<Kind,Field[]> = {
  config:[{key:'month',label:'Mês',type:'number'},{key:'year',label:'Ano',type:'number'},{key:'balance',label:'Saldo Atual (R$)',type:'money',optional:true},{key:'estimated_income',label:'Receita estimada integral do mês (R$)',type:'money',optional:true}],
  bill:[{key:'name',label:'Nome da conta'},{key:'amount',label:'Valor mensal (R$)',type:'money'},{key:'due_day',label:'Dia de vencimento',type:'number'},{key:'recurring',label:'Confirmo que esta conta se repete todo mês',type:'checkbox'}],
  card:[{key:'name',label:'Nome do cartão'},{key:'due_day',label:'Dia de vencimento',type:'number'}],
  invoice:[{key:'card_ref',label:'Cartão',type:'card'},{key:'month',label:'Mês',type:'number'},{key:'year',label:'Ano',type:'number'},{key:'amount',label:'Valor da fatura (R$)',type:'money'}],
  loan:[{key:'person',label:'Pessoa'},{key:'direction',label:'Tipo',options:[['payable','Eu devo'],['receivable','Me devem']]},{key:'amount',label:'Saldo ainda pendente (R$)',type:'money'},{key:'due_date',label:'Prazo',type:'date',optional:true},{key:'description',label:'Motivo',optional:true}],
  client:[{key:'name',label:'Nome do cliente'},{key:'contact',label:'Contato',optional:true}],
  subscription:[{key:'client_ref',label:'Cliente',type:'client'},{key:'service_name',label:'Serviço'},{key:'amount',label:'Valor por período (R$)',type:'money'},{key:'interval_months',label:'Periodicidade',options:[['1','Mensal'],['3','Trimestral'],['12','Anual']]},{key:'start_date',label:'Primeiro vencimento',type:'date'}],
  expense:[{key:'title',label:'Descrição'},{key:'amount',label:'Valor (R$)',type:'money'},{key:'spent_on',label:'Data da despesa realizada',type:'date'},{key:'category',label:'Categoria',optional:true}],
}
export function steps(profile:Draft['profile']):Draft['step'][] {
  return [...(profile !== 'professional' ? ['config','bill','card','loan'] as const : []),...(profile !== 'personal' ? ['client','subscription','expense'] as const : []),'review']
}
export function itemTitle(i:Item) { return String(i.fields.name || i.fields.person || i.fields.service_name || i.fields.title || titles[i.kind]) }
export function fieldValue(i:Item, f:Field, all:Item[]) {
  const value = i.fields[f.key]
  if (f.type === 'card' && i.fields.card_name) return String(i.fields.card_name)
  if (f.type === 'client' && i.fields.client_name) return String(i.fields.client_name)
  if (value === undefined || value === '') return 'Não informado'
  if (f.type === 'money') return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  if (f.type === 'checkbox') return value ? 'Sim' : 'Não confirmado'
  if (f.type === 'card' || f.type === 'client') return itemTitle(all.find(x => x.id === value) || { ...i,fields:{} })
  if (f.options) return f.options.find(([v]) => v === String(value))?.[1] || String(value)
  if (f.type === 'date') return String(value).split('-').reverse().join('/')
  return String(value)
}

/** Respostas curtas inequívocas são navegação local, sem envio ao provedor. */
export function localConversationReply(step:Draft['step'],text:string):'absent'|'skip'|null {
  const value=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[.!?]+$/,'')
  if(['nao sei','ainda nao sei','pular por enquanto','pular'].includes(value))return 'skip'
  if(step==='config'||step==='review')return null
  const specific:Partial<Record<Draft['step'],string[]>>={bill:['nao tenho contas fixas'],card:['nao tenho cartao','nao tenho cartoes'],loan:['nao tenho emprestimos'],client:['nao tenho clientes'],subscription:['nao tenho assinaturas'],expense:['nao tive despesas','ainda nao tive despesas']}
  return ['nao tenho','nao se aplica',...(specific[step]||[])].includes(value)?'absent':null
}
