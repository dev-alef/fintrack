import { createHash, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import pool from '../db/client'
import { createBill, createCard } from './finance.service'
import { createLoan } from './loans.service'
import { createClient, createSubscription, createExpense } from './business.service'
import { businessToday } from './business-calendar'
import { allowed, schemas, draftSchema, emptyDraft, nextQuestion, titles, validateItem, type Draft, type Item, type Kind } from './onboarding-domain'

export class OnboardingError extends Error { constructor(public status: number, message: string) { super(message) } }
const stale = () => new OnboardingError(409, 'O rascunho ou os cadastros mudaram. Recarregue e revise novamente.')
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
type Db = Pick<PoolClient, 'query'>
type Existing = Record<Kind, Record<string, any>[]>
async function tx<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect()
  try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result }
  catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
}
async function ensure(c: Db, uid: string) {
  await c.query(`INSERT INTO onboarding_drafts (user_id,data) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [uid, JSON.stringify(emptyDraft())])
  // No transcript is stored. Inactive structured drafts expire after 30 days.
  await c.query(`UPDATE onboarding_drafts SET data=$2,version=version+1,updated_at=now() WHERE user_id=$1 AND updated_at < now()-interval '30 days'`, [uid, JSON.stringify(emptyDraft())])
}
async function load(c: Db, uid: string, lock = false) {
  const r = await c.query(`SELECT * FROM onboarding_drafts WHERE user_id=$1${lock ? ' FOR UPDATE' : ''}`, [uid])
  if (!r.rows[0]) throw stale()
  if (new Date(r.rows[0].updated_at).getTime() < Date.now()-30*86400000) throw stale()
  return r.rows[0] as { version: number; data: Draft; dismissed: boolean }
}
async function existing(c: Db, uid: string): Promise<Existing> {
  const r = await c.query(`SELECT
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT id,month,year,balance::text,estimated_income::text FROM monthly_config WHERE user_id=$1) t),'[]') AS config,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT id,name,amount::text,due_day FROM fixed_bills WHERE user_id=$1 AND active) t),'[]') AS bill,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT id,name,due_day FROM credit_cards WHERE user_id=$1) t),'[]') AS card,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT e.id,e.card_id,c.name AS card_name,e.month,e.year,e.amount::text FROM card_expenses e JOIN credit_cards c ON c.id=e.card_id AND c.user_id=e.user_id WHERE e.user_id=$1) t),'[]') AS invoice,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT l.id,l.person,l.direction,(l.amount-COALESCE((SELECT sum(p.amount) FROM loan_payments p WHERE p.loan_id=l.id),0))::numeric(12,2)::text AS amount,l.description,l.due_date::text FROM loans l WHERE l.user_id=$1) t),'[]') AS loan,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT id,name,contact FROM professional_clients WHERE user_id=$1 AND NOT archived) t),'[]') AS client,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT s.id,s.client_id,c.name AS client_name,s.service_name,s.amount::text,s.interval_months,s.start_date::text,s.end_date::text FROM service_subscriptions s JOIN professional_clients c ON c.id=s.client_id AND c.user_id=s.user_id WHERE s.user_id=$1) t),'[]') AS subscription,
    COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM (SELECT id,title,amount::text,spent_on::text,category FROM professional_expenses WHERE user_id=$1 AND deleted_at IS NULL) t),'[]') AS expense`, [uid])
  return r.rows[0]
}
const normal = (v: unknown) => String(v ?? '').normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ')
function similar(i: Item, row: Record<string, any>, resolve: (ref: unknown) => string | undefined) {
  const f = i.fields
  switch (i.kind) {
    case 'config': return Number(row.month) === f.month && Number(row.year) === f.year
    case 'invoice': return row.card_id === resolve(f.card_ref) && Number(row.month) === f.month && Number(row.year) === f.year
    case 'loan': return normal(row.person) === normal(f.person) && row.direction === f.direction
    case 'subscription': return row.client_id === resolve(f.client_ref) && normal(row.service_name) === normal(f.service_name)
    case 'expense': return normal(row.title) === normal(f.title) && row.spent_on === f.spent_on
    default: return normal(row.name) === normal(f.name)
  }
}
export async function getDraft(uid: string) {
  return tx(async c => { await ensure(c, uid); const row = await load(c, uid); return { ...row, question: nextQuestion(row.data), existing: await existing(c, uid), ai_available: Boolean(process.env.GEMINI_API_KEY) } })
}
export async function saveDraft(uid: string, version: number, data: Draft) {
  const valid = draftSchema.parse(data)
  const r = await pool.query(`UPDATE onboarding_drafts SET data=$3,version=version+1,updated_at=now() WHERE user_id=$1 AND version=$2 AND updated_at>=now()-interval '30 days' RETURNING version,data,dismissed`, [uid, version, JSON.stringify(valid)])
  if (!r.rows[0]) throw stale()
  return { ...r.rows[0], question: nextQuestion(valid) }
}
export async function dismiss(uid: string) {
  await ensure(pool, uid)
  await pool.query('UPDATE onboarding_drafts SET dismissed=true WHERE user_id=$1', [uid])
}
export async function discard(uid: string, version: number) {
  return saveDraft(uid, version, emptyDraft())
}
export async function invitation(uid: string) {
  const r = await pool.query(`SELECT
    EXISTS(SELECT 1 FROM onboarding_drafts WHERE user_id=$1 AND dismissed) AS dismissed,
    EXISTS(SELECT 1 FROM onboarding_drafts WHERE user_id=$1 AND jsonb_array_length(data->'items')>0 AND updated_at>=now()-interval '30 days') AS resumable,
    EXISTS(SELECT 1 FROM monthly_config WHERE user_id=$1 UNION ALL SELECT 1 FROM credit_cards WHERE user_id=$1 UNION ALL SELECT 1 FROM fixed_bills WHERE user_id=$1 UNION ALL SELECT 1 FROM loans WHERE user_id=$1 UNION ALL SELECT 1 FROM professional_clients WHERE user_id=$1 UNION ALL SELECT 1 FROM transactions WHERE user_id=$1 UNION ALL SELECT 1 FROM goals WHERE user_id=$1 UNION ALL SELECT 1 FROM investments WHERE user_id=$1) AS has_data`, [uid])
  const r0 = r.rows[0]; return { show: !r0.dismissed && (!r0.has_data || r0.resumable), resumable: r0.resumable }
}
function publicFields(row: Record<string, any>, original: Item) {
  const result = Object.fromEntries(Object.entries(row).filter(([key,value]) => key !== 'id' && value != null))
  if (original.kind === 'bill') result.recurring = true
  if (original.kind === 'invoice') result.card_ref = original.fields.card_ref
  if (original.kind === 'subscription') result.client_ref = original.fields.client_ref
  return result
}
function previewData(version: number, data: Draft, records: Existing) {
  const resolve = (ref: unknown) => data.items.find(i => i.id === ref && i.action === 'reuse')?.existing_id
  const rows = data.items.map(i => {
    const issues: string[] = []
    const matches = records[i.kind].filter(r => similar(i, r, resolve))
    const reused = i.action === 'reuse' ? records[i.kind].find(r => r.id === i.existing_id) : undefined
    if (i.action !== 'pending') {
      if (!allowed(i.kind, data.profile)) issues.push('Fora do perfil escolhido; deixe pendente ou altere o perfil.')
      if (i.action === 'reuse') {
        if (!records[i.kind].some(r => r.id === i.existing_id)) issues.push('Selecione um cadastro existente da sua conta.')
      } else {
        issues.push(...validateItem(i).map(f => `Confira ${f}.`))
        if (matches.length && (['config','invoice'].includes(i.kind) || !i.duplicate_ack)) issues.push(['config','invoice'].includes(i.kind) ? 'Já existe neste período. Use o existente ou edite pela tela original.' : 'Há um cadastro semelhante. Use o existente ou confirme que este é distinto.')
        const refKind = i.kind === 'invoice' ? 'card' : i.kind === 'subscription' ? 'client' : null
        if (refKind) {
          const ref = data.items.find(v => v.id === i.fields[refKind === 'card' ? 'card_ref' : 'client_ref'] && v.kind === refKind)
          if (!ref || ref.action === 'pending') issues.push(`Selecione um ${titles[refKind]} incluído nesta confirmação.`)
        }
      }
    }
    return { id: i.id, kind: i.kind, action: i.action, fields: reused ? publicFields(reused,i) : i.fields, existing_id: i.existing_id, issues, matches }
  })
  // Duplicate names in the same draft also need a deliberate distinct-record choice.
  const identities = new Map<string, Item[]>()
  for (const i of data.items.filter(i => i.action === 'create' && !['config','invoice'].includes(i.kind))) {
    const f=i.fields
    const key = i.kind === 'loan' ? `${normal(f.person)}:${f.direction}` : i.kind === 'subscription' ? `${resolve(f.client_ref)||f.client_ref}:${normal(f.service_name)}` : i.kind === 'expense' ? `${normal(f.title)}:${f.spent_on}` : normal(f.name)
    const identity = `${i.kind}:${key}`
    identities.set(identity,[...(identities.get(identity)||[]),i])
  }
  for (const group of identities.values()) if (group.length > 1) for (const i of group) {
    if (!i.duplicate_ack) rows.find(r=>r.id===i.id)!.issues.push('Há outro item semelhante neste rascunho. Remova a repetição ou confirme que são cadastros distintos.')
  }
  // Multiple draft entries for the same monthly slot would otherwise collide mid-commit.
  const slots = new Set<string>()
  for (const i of data.items.filter(i => i.action === 'create' && ['config','invoice'].includes(i.kind))) {
    const slot = `${i.kind}:${i.kind === 'invoice' ? resolve(i.fields.card_ref) || i.fields.card_ref : ''}:${i.fields.year}:${i.fields.month}`
    if (slots.has(slot)) rows.find(r => r.id === i.id)!.issues.push('Este período aparece duas vezes no rascunho.')
    slots.add(slot)
  }
  return { version, rows, pending_count: rows.filter(r => r.action === 'pending').length,
    can_commit: rows.some(r => r.action !== 'pending') && rows.every(r => !r.issues.length),
    token: hash({ version, data, records, today: businessToday().slice(0,7) }),
    current_period: businessToday().slice(0,7), reference_period: `${data.year}-${String(data.month).padStart(2,'0')}` }
}
export async function preview(uid: string, version: number) {
  return tx(async c => { const row = await load(c, uid, true); if (row.version !== version) throw stale(); return previewData(version,row.data,await existing(c,uid)) })
}
export type CommitInput = { version: number; token: string; request_id: string; reference_period: string }
export async function commit(uid: string, input: CommitInput) {
  return tx(async c => {
    const row = await load(c, uid, true)
    const requestHash = hash({ version: input.version, token: input.token, reference_period: input.reference_period })
    const past = await c.query('SELECT request_hash,result FROM onboarding_commits WHERE user_id=$1 AND request_id=$2', [uid,input.request_id])
    if (past.rows[0]) { if (past.rows[0].request_hash !== requestHash) throw stale(); return past.rows[0].result }
    if (row.version !== input.version) throw stale()
    // Existing CRUD endpoints do not share an advisory lock. Short table locks ensure
    // their writes cannot race the preview comparison and this atomic initial import.
    await c.query("SET LOCAL lock_timeout = '3s'")
    await c.query('LOCK TABLE monthly_config,fixed_bills,credit_cards,card_expenses,loans,loan_payments,professional_clients,service_subscriptions,professional_expenses IN SHARE ROW EXCLUSIVE MODE')
    const check = previewData(row.version,row.data,await existing(c,uid))
    if (check.token !== input.token || check.reference_period !== input.reference_period) throw stale()
    if (!check.can_commit) throw new OnboardingError(400, 'Revise os itens antes de confirmar.')
    const ids = new Map<string,string>()
    const chosen = row.data.items.filter(i => i.action !== 'pending')
    for (const i of chosen.filter(i => i.action === 'reuse')) ids.set(i.id,i.existing_id!)
    const order: Kind[] = ['config','bill','card','loan','client','invoice','subscription','expense']
    for (const kind of order) for (const i of chosen.filter(i => i.kind === kind && i.action === 'create')) {
      // Parse again at the write boundary, never trusting AI or browser validation.
      const f = schemasFields(i)
      let id: string
      if (kind === 'config') {
        const r = await c.query('INSERT INTO monthly_config(user_id,month,year,balance,estimated_income) VALUES($1,$2,$3,$4,$5) RETURNING id', [uid,f.month,f.year,f.balance ?? null,f.estimated_income ?? null]); id = r.rows[0].id
      } else if (kind === 'bill') id = (await createBill(uid, { name: f.name, amount: f.amount, due_day: f.due_day },c)).id
      else if (kind === 'card') id = (await createCard(uid, { name: f.name, due_day: f.due_day },c)).id
      else if (kind === 'loan') id = (await createLoan(uid, { person: f.person,direction: f.direction, amount:f.amount,description:f.description || '',due_date:f.due_date },c)).id
      else if (kind === 'client') id = (await createClient(uid,{ id:randomUUID(),name:f.name,contact:f.contact || '',notes:'' },c)).id
      else if (kind === 'invoice') {
        const r = await c.query('INSERT INTO card_expenses(user_id,card_id,month,year,amount) VALUES($1,$2,$3,$4,$5) RETURNING id', [uid,ids.get(f.card_ref),f.month,f.year,f.amount]); id = r.rows[0].id
      } else if (kind === 'subscription') id = (await createSubscription(uid,{ id:randomUUID(),client_id:ids.get(f.client_ref)!,service_name:f.service_name,amount:f.amount,interval_months:f.interval_months,start_date:f.start_date,notes:'' },c)).id
      else id = (await createExpense(uid,{ id:randomUUID(),title:f.title,amount:f.amount,spent_on:f.spent_on,category:f.category || '',notes:'' },c)).id
      ids.set(i.id,id)
    }
    // Keep parent references in the remaining draft as reuse, so skipped dependent items
    // can be completed later without recreating the parent.
    const requiredRefs = new Set(row.data.items.filter(i => i.action === 'pending').flatMap(i => [i.fields.card_ref,i.fields.client_ref]).filter(Boolean))
    const items = row.data.items.filter(i => i.action === 'pending' || requiredRefs.has(i.id)).map(i => ids.has(i.id) ? { ...i,action:'reuse' as const,existing_id:ids.get(i.id) } : i)
    const data = { ...row.data, items, step:'review' as const }
    const result = { created: chosen.filter(i => i.action === 'create').length, reused: chosen.filter(i => i.action === 'reuse').length, pending: items.filter(i => i.action === 'pending').length, version:row.version+1 }
    await c.query('UPDATE onboarding_drafts SET data=$2,version=version+1,dismissed=true,updated_at=now() WHERE user_id=$1', [uid,JSON.stringify(data)])
    await c.query('INSERT INTO onboarding_commits(user_id,request_id,request_hash,result) VALUES($1,$2,$3,$4)', [uid,input.request_id,requestHash,JSON.stringify(result)])
    return result
  })
}
function schemasFields(i: Item): Record<string,any> { return schemas[i.kind].parse(i.fields) }
