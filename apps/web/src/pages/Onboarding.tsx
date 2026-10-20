import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useSession } from '../lib/auth-client'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fields, titles, steps, itemTitle, fieldValue, type Draft, type Item, type Kind, type SavedDraft, type Preview, type CommitRequest } from '@/lib/onboarding'

const selectClass = 'w-full min-w-0 rounded-lg border border-border bg-surface p-2 text-sm text-text'
const errorText = (e:unknown) => (e as {response?:{data?:{error?:string}}}).response?.data?.error || 'Sem conexão. Confira o que ficou salvo antes de continuar.'
export default function Onboarding() {
  const {data:session} = useSession()
  return session?.user ? <Assistant key={session.user.id} userId={session.user.id}/> : null
}
function Assistant({userId}:{userId:string}) {
  const qc = useQueryClient(), navigate = useNavigate()
  const [saved,setSaved] = useState<SavedDraft|null>(null)
  const [draft,setDraft] = useState<Draft|null>(null)
  const [dirty,setDirty] = useState(false)
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('')
  const [text,setText] = useState(''), [consent,setConsent] = useState(false)
  const [preview,setPreview] = useState<Preview|null>(null), [confirmed,setConfirmed] = useState(false)
  const storageKey = `onboarding-commit:${userId}`
  const [pending,setPending] = useState<CommitRequest|null>(() => {
    try { const raw = sessionStorage.getItem(storageKey);return raw ? JSON.parse(raw) : null } catch {return null}
  })
  async function load() {
    setBusy(true);setError('')
    try { const {data} = await api.get<SavedDraft>('/onboarding');setSaved(data);setDraft(data.data);setDirty(false);setPreview(null) }
    catch(e) {setError(errorText(e))} finally {setBusy(false)}
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const warn = (e:BeforeUnloadEvent) => { if (dirty) {e.preventDefault();e.returnValue=''} }
    window.addEventListener('beforeunload',warn);return () => window.removeEventListener('beforeunload',warn)
  },[dirty])
  function change(data:Draft) {setDraft(data);setDirty(true);setPreview(null);setConfirmed(false);setNotice('')}
  async function persist(data = draft) {
    if (!data || !saved) throw new Error('Rascunho indisponível')
    const r = await api.put('/onboarding',{version:saved.version,data})
    const next = {...saved,...r.data};setSaved(next);setDraft(next.data);setDirty(false);void qc.invalidateQueries({queryKey:['onboardingInvitation',userId]});return next as SavedDraft
  }
  async function run(fn:()=>Promise<void>) {setBusy(true);setError('');try {await fn()} catch(e) {setError(errorText(e))} finally {setBusy(false)}}
  function add(kind:Kind) {
    if (!draft) return
    const item:Item = {id:crypto.randomUUID(),kind,fields:kind==='config'||kind==='invoice'?{month:draft.month,year:draft.year}:{},action:'create',duplicate_ack:false}
    change({...draft,items:[...draft.items,item],absent:draft.absent.filter(k=>k!==kind)})
  }
  function edit(id:string, patch:Partial<Item>) {if(draft) change({...draft,items:draft.items.map(i=>i.id===id?{...i,...patch}:i)})}
  async function review() {
    const next = await persist({...draft!,step:'review'})
    const {data} = await api.post<Preview>('/onboarding/preview',{version:next.version})
    setPreview(data);setConfirmed(false)
  }
  async function commit() {
    const request = pending || {version:preview!.version,token:preview!.token,reference_period:preview!.reference_period,request_id:crypto.randomUUID()}
    // Persist the same id before sending, including across a reload after a lost response.
    sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request)
    try {
      const {data} = await api.post('/onboarding/commit',request)
      sessionStorage.removeItem(storageKey);setPending(null)
      await qc.invalidateQueries();await load()
      setNotice(`${data.created} cadastro(s) criado(s), ${data.reused} existente(s) utilizado(s). ${data.pending} item(ns) ficaram pendentes no rascunho.`)
    } catch(e) {
      const status = (e as {response?:{status?:number}}).response?.status
      if (status===400 || status===409) {sessionStorage.removeItem(storageKey);setPending(null);setPreview(null);setConfirmed(false)}
      throw e
    }
  }
  if (!draft || !saved) return <div className="space-y-3"><p>{error || 'Carregando seu assistente…'}</p>{error&&<Button onClick={load}>Tentar novamente</Button>}</div>
  const currentSteps = steps(draft.profile)
  const active = currentSteps.includes(draft.step) ? draft.step : currentSteps[0]
  const currentIndex = currentSteps.indexOf(active)
  const visibleKinds:Kind[] = active==='review' ? [] : active==='card' ? ['card','invoice'] : [active]
  const locked = busy || Boolean(pending)
  return <div className="mx-auto max-w-4xl space-y-5 pb-10">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold text-text"><Sparkles size={22}/> Vamos configurar o seu Provisão</h1><p className="mt-2 text-sm text-muted">Conte como organiza seu dinheiro. Você revisa tudo antes de cadastrar.</p></div>
      <Button variant="outline" disabled={locked} onClick={()=>run(async()=>{await persist();navigate('/dashboard')})}>Salvar rascunho e sair</Button>
    </header>
    {error&&<div role="alert" className="rounded-lg border border-border p-3 text-sm text-expense">{error} {!pending&&<button className="ml-2 underline" onClick={load}>Recarregar versão salva</button>}</div>}
    {notice&&<div role="status" className="rounded-lg border border-border p-3 text-sm text-text">{notice} <Link className="inline-block underline" to="/dashboard">Abrir Dashboard</Link></div>}
    {pending&&<div role="alert" className="rounded-lg border border-border p-4 text-sm text-text">A confirmação ainda precisa ser conferida. Use o mesmo pedido para consultar/concluir sem duplicar cadastros.<Button disabled={busy} className="mt-2" onClick={()=>run(commit)}>Conferir confirmação</Button></div>}
    <fieldset disabled={locked} className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Quero organizar<select aria-label="Perfil" className={selectClass} value={draft.profile} onChange={e=>{const profile=e.target.value as Draft['profile'];change({...draft,profile,step:steps(profile)[0]})}}><option value="both">Pessoal e profissional</option><option value="personal">Pessoal</option><option value="professional">Profissional</option></select></label>
        <label className="space-y-1 text-sm">Mês de referência<Input aria-label="Mês de referência" type="number" min={1} max={12} value={draft.month} onChange={e=>change({...draft,month:Number(e.target.value)})}/></label>
        <label className="space-y-1 text-sm">Ano de referência<Input aria-label="Ano de referência" type="number" min={2000} max={2099} value={draft.year} onChange={e=>change({...draft,year:Number(e.target.value)})}/></label>
      </div>
      <p className="text-xs text-muted">O período orienta novos itens. Alterá-lo não move os valores já preenchidos. Rascunhos sem uso expiram após 30 dias; você também pode descartá-los.</p>
      <nav aria-label="Etapas da configuração" className="flex flex-wrap gap-2">{currentSteps.map((step,index)=><button key={step} type="button" aria-current={active===step?'step':undefined} className={`rounded-full border border-border px-3 py-1.5 text-sm ${active===step?'bg-primary text-primary-fg':'text-muted'}`} onClick={()=>run(async()=>{if(step==='review') await review();else await persist({...draft,step})})}>{index+1}. {step==='review'?'Revisão':titles[step]}</button>)}</nav>
      {active!=='review'&&<section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-semibold text-text">{titles[active]}</h2>
        <p className="text-sm text-text">{saved.data.step===active?saved.question:questions[active]}</p>
        {active==='config'&&<p className="text-sm text-muted">Saldo Atual é o disponível hoje; receita estimada é a receita integral do mês. A previsão soma os dois e desconta contas fixas e faturas. Se a renda já estiver no saldo, essa soma pode contar o mesmo dinheiro novamente. Não é uma consulta ao banco.</p>}
        {['client','subscription','expense'].includes(active)&&<p className="text-sm text-muted">O caixa profissional fica separado do dinheiro pessoal. Assinaturas não são marcadas como recebidas automaticamente.</p>}
        <label className="block text-sm">Sua resposta<textarea aria-label="Sua resposta" maxLength={3000} rows={3} className={`${selectClass} mt-2`} placeholder="Ex.: recebo 3 mil, tenho 800 na conta e pago 120 de internet todo mês…" value={text} onChange={e=>setText(e.target.value)}/></label>
        <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo enviar esta resposta e os itens do rascunho ao Google Gemini para interpretar os dados. Posso usar somente os campos abaixo. A conversa não é armazenada no FinTrack.</label>
        <Button disabled={!consent||!text.trim()||!saved.ai_available} onClick={()=>run(async()=>{const next=await persist();const {data}=await api.post('/onboarding/answer',{version:next.version,text,consent:true});setSaved({...next,...data});setDraft(data.data);setDirty(false);setText('');setNotice('Interpretação concluída. Confira os itens e preencha o que faltar nos campos abaixo.')})}>Interpretar resposta com IA</Button>
        {!saved.ai_available&&<p className="text-sm text-muted">IA indisponível no momento. Você pode concluir pelos campos guiados.</p>}
        <p className="text-xs text-muted">Nenhum valor desconhecido será considerado zero. Informe 0 somente se esse for o valor correto.</p>
      </section>}
      {visibleKinds.map(kind=><section key={kind} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{titles[kind]} · campos guiados</h3><Button variant="outline" disabled={draft.items.length>=80} onClick={()=>add(kind)}><Plus size={16}/> Adicionar {titles[kind].toLowerCase()}</Button></div>
        {saved.existing[kind].length>0&&<details className="text-sm text-muted"><summary className="cursor-pointer">Usar um dos {saved.existing[kind].length} cadastros existentes</summary><div className="mt-2 space-y-2">{saved.existing[kind].map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"><span>{String(row.name||row.person||row.service_name||row.title||`${row.month}/${row.year}`)}</span><Button size="sm" variant="outline" onClick={()=>{const f=Object.fromEntries(Object.entries(row).filter(([key,value])=>key!=='id'&&value!=null));change({...draft,items:[...draft.items,{id:crypto.randomUUID(),kind,fields:f,action:'reuse',existing_id:String(row.id),duplicate_ack:false}]})}}>Usar existente</Button></div>)}</div></details>}
        {draft.items.filter(i=>i.kind===kind).map(i=><article key={i.id} className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-2"><h4 className="font-medium">{itemTitle(i)}</h4><button aria-label={`Remover ${itemTitle(i)} do rascunho`} onClick={()=>change({...draft,items:draft.items.filter(x=>x.id!==i.id)})}><Trash2 size={16}/></button></div>
          {i.existing_id?<p className="text-sm text-muted">Cadastro existente selecionado. Será utilizado sem alterar seus dados.</p>:<div className="grid gap-3 sm:grid-cols-2">{fields[kind].map(f=>{
            const inputId=`${i.id}-${f.key}`, value=i.fields[f.key]
            const update=(raw:string|boolean)=>{const updated={...i.fields};if(raw==='')delete updated[f.key];else updated[f.key]=typeof raw==='boolean'?raw:(f.type==='money'||f.type==='number'||f.key==='interval_months'?Number(raw):raw);edit(i.id,{fields:updated,duplicate_ack:false})}
            const options=f.type==='card'||f.type==='client'?draft.items.filter(x=>x.kind===f.type).map(x=>[x.id,itemTitle(x)]):f.options
            return <div key={f.key} className="space-y-1 text-sm"><label htmlFor={inputId}>{f.label}{f.optional?' (opcional)':''}</label>{f.type==='checkbox'?<input id={inputId} className="ml-2" type="checkbox" checked={value===true} onChange={e=>update(e.target.checked)}/>:options?<select id={inputId} className={selectClass} value={String(value??'')} onChange={e=>update(e.target.value)}><option value="">Selecione</option>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>:<Input id={inputId} type={f.type==='date'?'date':f.type==='money'||f.type==='number'?'number':'text'} step={f.type==='money'?'0.01':undefined} value={String(value??'')} onChange={e=>update(e.target.value)} />}</div>
          })}</div>}
          <label className="flex gap-2 text-sm text-muted"><input type="checkbox" checked={i.action!=='pending'} onChange={e=>edit(i.id,{action:e.target.checked?(i.existing_id?'reuse':'create'):'pending'})}/>Incluir na confirmação final</label>
        </article>)}
      </section>)}
      {active==='review'&&<section className="space-y-4" aria-labelledby="onboarding-review-title">
        <h2 id="onboarding-review-title" className="text-xl font-semibold">Confira antes de salvar</h2>
        <p className="text-sm text-muted">Somente os itens incluídos serão cadastrados. Os demais permanecem no rascunho. Nenhum pagamento, recebimento ou transferência será realizado.</p>
        {draft.items.length===0&&<p className="text-sm">Nenhum item no rascunho. Volte a uma etapa para adicionar.</p>}
        {draft.items.map(i=>{
          const result=preview?.rows.find(r=>r.id===i.id)
          const display = result && i.action==='reuse' ? {...i,fields:result.fields} : i
          return <article key={i.id} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{titles[i.kind]}: {itemTitle(display)}</h3><button className="text-sm underline" onClick={()=>run(async()=>{await persist({...draft,step:i.kind==='invoice'?'card':i.kind})})}>Editar</button></div>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">{fields[i.kind].map(f=><div key={f.key}><dt className="text-muted">{f.label}</dt><dd className="break-words text-text">{fieldValue(display,f,draft.items)}</dd></div>)}</dl>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={i.action!=='pending'} onChange={e=>edit(i.id,{action:e.target.checked?(i.existing_id?'reuse':'create'):'pending'})}/>{i.action==='reuse'?'Usar existente, sem alterar':'Incluir este cadastro'}</label>
            {result?.matches.length ? <div className="text-sm space-y-2"><p>Encontramos cadastros semelhantes:</p>{result.matches.map(row=><button key={row.id} className="block underline" onClick={()=>edit(i.id,{action:'reuse',existing_id:String(row.id),fields:Object.fromEntries(Object.entries(row).filter(([key])=>key!=='id'&&row[key]!=null)) as Item['fields']})}>Usar {String(row.name||row.person||row.service_name||row.title||`${row.month}/${row.year}`)} já cadastrado</button>)}{!['config','invoice'].includes(i.kind)&&i.action!=='reuse'&&<label className="flex gap-2"><input type="checkbox" checked={i.duplicate_ack} onChange={e=>edit(i.id,{duplicate_ack:e.target.checked})}/>Conferi: este é um cadastro distinto.</label>}</div>:null}
            {result?.issues.some(issue=>issue.includes('neste rascunho'))&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={i.duplicate_ack} onChange={e=>edit(i.id,{duplicate_ack:e.target.checked})}/>Conferi: este item é distinto dos outros do rascunho.</label>}
            {result?.issues.map(issue=><p key={issue} className="text-sm text-expense">{issue}</p>)}
          </article>
        })}
        <p className="text-xs text-muted">Sem itens informados: {[...draft.absent].map(k=>titles[k]).join(', ')||'nenhum bloco marcado'}. Etapas puladas: {draft.skipped.map(k=>titles[k]).join(', ')||'nenhuma'}.</p>
        <Button variant="outline" onClick={()=>run(review)}>Atualizar revisão</Button>
        {preview&&<div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm">{preview.rows.filter(i=>i.action==='create').length} novos · {preview.rows.filter(i=>i.action==='reuse').length} existentes · {preview.pending_count} pendentes.</p>
          {preview.current_period!==preview.reference_period&&<p className="text-sm text-warning">O período de referência {preview.reference_period} é diferente do mês atual {preview.current_period}. Confira mês/ano de cada item.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi os valores e períodos acima, com referência {preview.reference_period}, e quero salvar somente os itens incluídos.</label>
          <Button disabled={!preview.can_commit||!confirmed||dirty} onClick={()=>run(commit)}>Confirmar e cadastrar</Button>
          {!preview.can_commit&&<p className="text-sm text-muted">Corrija os avisos ou deixe os itens incompletos pendentes. Depois atualize a revisão.</p>}
        </div>}
      </section>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={currentIndex===0} onClick={()=>run(async()=>{await persist({...draft,step:currentSteps[currentIndex-1]})})}><ArrowLeft size={16}/> Voltar</Button>
        {active!=='review'&&<>
          <Button variant="outline" onClick={()=>run(async()=>{await persist({...draft,skipped:[...new Set([...draft.skipped,active])],absent:draft.absent.filter(k=>k!==active),items:draft.items.map(i=>visibleKinds.includes(i.kind)?{...i,action:'pending' as const}:i),step:currentSteps[currentIndex+1]})})}>Pular por enquanto</Button>
          <Button variant="outline" disabled={draft.items.some(i=>visibleKinds.includes(i.kind))} onClick={()=>run(async()=>{await persist({...draft,absent:[...new Set([...draft.absent,active])],skipped:draft.skipped.filter(k=>k!==active),items:draft.items.map(i=>visibleKinds.includes(i.kind)?{...i,action:'pending' as const}:i),step:currentSteps[currentIndex+1]})})}>Não tenho / não se aplica</Button>
          <Button onClick={()=>run(async()=>{if(currentSteps[currentIndex+1]==='review')await review();else await persist({...draft,step:currentSteps[currentIndex+1]})})}>Continuar <ArrowRight size={16}/></Button>
        </>}
      </div>
      <details className="text-sm text-muted"><summary className="cursor-pointer">Descartar este rascunho</summary><p className="my-2">Apaga somente o rascunho. Os cadastros financeiros já confirmados são preservados.</p><Button variant="outline" onClick={()=>run(async()=>{await api.post('/onboarding/discard',{version:saved.version});await load()})}>Descartar rascunho e recomeçar</Button></details>
    </fieldset>
    <p role="status" className="text-xs text-muted">{busy?'Salvando ou consultando…':dirty?'Há alterações ainda não salvas. Use Continuar ou Salvar rascunho e sair.':'Rascunho salvo.'}</p>
  </div>
}
const questions:Record<string,string>={config:'Quanto você tem disponível hoje e qual é sua receita estimada?',bill:'Quais contas se repetem todo mês?',card:'Quais cartões e faturas você tem?',loan:'Você deve para alguém ou tem dinheiro a receber?',client:'Quais clientes você atende?',subscription:'Quais serviços recorrentes oferece?',expense:'Quais despesas profissionais já realizou?'}
