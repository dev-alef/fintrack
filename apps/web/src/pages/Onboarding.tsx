import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useSession } from '../lib/auth-client'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fields, titles, steps, itemTitle, fieldValue, localConversationReply, type Draft, type Item, type Kind, type SavedDraft, type Preview, type CommitRequest } from '@/lib/onboarding'

import { OnboardingFrame, OnboardingPrivacy, TypedQuestion, type OnboardingPhase } from '@/components/onboarding-frame'

const selectClass = 'w-full min-w-0 rounded-lg border border-border bg-surface p-2 text-sm text-text'
class UserNotice extends Error {}
class UnsentAnswer extends UserNotice { constructor(){super('Envie ou apague sua resposta antes de mudar de etapa.')} }
const errorText = (e:unknown) => e instanceof UserNotice?e.message: (e as {response?:{data?:{error?:string}}}).response?.data?.error || 'Sem conexão. Confira o que ficou salvo antes de continuar.'
export default function Onboarding() {
  const {data:session} = useSession()
  return session?.user ? <Assistant key={session.user.id} userId={session.user.id} name={session.user.name || 'você'}/> : null
}
function Assistant({userId,name}:{userId:string;name:string}) {
  const qc = useQueryClient(), navigate = useNavigate()
  const [params]=useSearchParams()
  const [phase,setPhase]=useState<OnboardingPhase>(params.get('welcome')==='1'?'transition':'intro')
  const [guided,setGuided]=useState(false)
  const inputRef=useRef<HTMLTextAreaElement>(null)
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
  async function load(initial=false) {
    setBusy(true);setError('')
    try { const {data} = await api.get<SavedDraft>('/onboarding');setSaved(data);setDraft(data.data);setDirty(false);setPreview(null);if(initial&&(pending||((data.data.items.length||data.data.conversation_started)&&params.get('welcome')!=='1')))setPhase('conversation') }
    catch(e) {setError(errorText(e))} finally {setBusy(false)}
  }
  useEffect(() => { void load(true) }, [])
  useEffect(()=>{
    if(phase!=='transition')return
    const t=setTimeout(()=>{setPhase('intro');navigate('/assistente-inicial',{replace:true})},matchMedia('(prefers-reduced-motion: reduce)').matches?200:3400)
    return()=>clearTimeout(t)
  },[phase])
  useEffect(()=>{if(phase==='conversation')inputRef.current?.focus()},[phase,draft?.step])
  useEffect(() => {
    const warn = (e:BeforeUnloadEvent) => { if (dirty||text.trim()) {e.preventDefault();e.returnValue=''} }
    window.addEventListener('beforeunload',warn);return () => window.removeEventListener('beforeunload',warn)
  },[dirty,text])
  function change(data:Draft) {setDraft(data);setDirty(true);setPreview(null);setConfirmed(false);setNotice('')}
  async function persist(data = draft, consumesAnswer=false) {
    if (!data || !saved) throw new Error('Rascunho indisponível')
    if(text.trim()&&data.step!==draft?.step&&!consumesAnswer)throw new UnsentAnswer()
    const r = await api.put('/onboarding',{version:saved.version,data})
    if(consumesAnswer)setText('')
    const next = {...saved,...r.data};setSaved(next);setDraft(next.data);setDirty(false);void qc.invalidateQueries({queryKey:['onboardingInvitation',userId]});return next as SavedDraft
  }
  async function run(fn:()=>Promise<void>) {setBusy(true);setError('');try {await fn()} catch(e) {setError(errorText(e))} finally {setBusy(false)}}
  function add(kind:Kind) {
    if (!draft) return
    const item:Item = {id:crypto.randomUUID(),kind,fields:kind==='config'||kind==='invoice'?{month:draft.month,year:draft.year}:{},action:'create',duplicate_ack:false}
    change({...draft,items:[...draft.items,item],absent:draft.absent.filter(k=>k!==kind)})
  }
  function edit(id:string, patch:Partial<Item>) {if(draft) change({...draft,items:draft.items.map(i=>i.id===id?{...i,...patch}:i)})}
  async function review(data = draft, consumesAnswer=false) {
    setPhase('conversation')
    const next = await persist({...data!,step:'review'},consumesAnswer)
    const response = await api.post<Preview>('/onboarding/preview',{version:next.version})
    setPreview(response.data);setConfirmed(false)
  }
  async function commit() {
    const request = pending || {version:preview!.version,token:preview!.token,reference_period:preview!.reference_period,request_id:crypto.randomUUID()}
    // Persist the same id before sending, including across a reload after a lost response.
    sessionStorage.setItem(storageKey,JSON.stringify(request));setPending(request)
    try {
      const {data} = await api.post('/onboarding/commit',request)
      sessionStorage.removeItem(storageKey);setPending(null)
      await qc.invalidateQueries();await load()
      setPhase('done');setText('');setNotice(`${data.created} cadastro(s) criado(s), ${data.reused} existente(s) utilizado(s). ${data.pending} item(ns) ficaram pendentes no rascunho.`)
    } catch(e) {
      const status = (e as {response?:{status?:number}}).response?.status
      if (status===400 || status===409) {sessionStorage.removeItem(storageKey);setPending(null);setPreview(null);setConfirmed(false)}
      throw e
    }
  }
  if (!draft || !saved) return <div className="space-y-3"><p>{error || 'Carregando seu assistente…'}</p>{error&&<Button onClick={()=>load()}>Tentar novamente</Button>}</div>
  const currentSteps = steps(draft.profile)
  const active = currentSteps.includes(draft.step) ? draft.step : currentSteps[0]
  const currentIndex = currentSteps.indexOf(active)
  const visibleKinds:Kind[] = active==='review' ? [] : active==='card' ? ['card','invoice'] : [active]
  const locked = busy || Boolean(pending)
  const started=Boolean(draft.conversation_started||draft.items.length||active==='review')
  async function exit() { if(text.trim()){setError('Sua resposta ainda não foi enviada. Envie-a ou apague o texto antes de sair; só itens já interpretados ficam no rascunho.');return} await persist();await api.post('/onboarding/dismiss');await qc.invalidateQueries({queryKey:['onboardingInvitation',userId]});navigate('/dashboard') }
  async function chooseProfile(profile:Draft['profile']) {await persist({...draft!,profile,conversation_started:true,step:steps(profile)[0]},true);setText('')}
  async function advanceBlock(mode:'absent'|'skip',consumesAnswer=false) {
    if(mode==='absent'&&draft!.items.some(i=>visibleKinds.includes(i.kind)))throw new UserNotice('Já há itens neste bloco. Confira os campos guiados ou pule por enquanto para deixá-los pendentes.')
    const next={...draft!,skipped:mode==='skip'?[...new Set([...draft!.skipped,active as Kind])]:draft!.skipped.filter(k=>k!==active),absent:mode==='absent'?[...new Set([...draft!.absent,active as Kind])]:draft!.absent.filter(k=>k!==active),items:draft!.items.map(i=>mode==='skip'&&visibleKinds.includes(i.kind)?{...i,action:'pending' as const}:i)}
    if(currentSteps[currentIndex+1]==='review')await review(next,consumesAnswer)
    else await persist({...next,step:currentSteps[currentIndex+1]},consumesAnswer)
    if(consumesAnswer)setText('')
  }
  async function answer() {
    if(!started){
      const v=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      const answer=v.trim().replace(/[.!?]+$/,'')
      if(['ambos','os dois','as duas','pessoal e profissional'].includes(answer))await chooseProfile('both')
      else if(['profissional','meu trabalho','trabalho'].includes(answer))await chooseProfile('professional')
      else if(['pessoal','minha vida pessoal','vida pessoal'].includes(answer))await chooseProfile('personal')
      else setError('Escolha pessoal, profissional ou ambos. Você também pode usar os botões abaixo.')
      return
    }
    const local=localConversationReply(active,text)
    if(local){await advanceBlock(local,true);return}
    const next=await persist()
    const {data}=await api.post('/onboarding/answer',{version:next.version,text,consent:true})
    setSaved({...next,...data});setDraft(data.data);setDirty(false);setText('');setGuided(false);setPreview(null);setConfirmed(false)
    if(data.data.step==='review'){const p=await api.post('/onboarding/preview',{version:data.version});setPreview(p.data)}
  }
  return <OnboardingFrame phase={phase} group={phase==='intro'?0:active==='review'||phase==='done'?3:active==='config'||!started?1:2} onStart={()=>setPhase('conversation')} onExit={()=>run(exit)} locked={locked} error={phase==='intro'||phase==='transition'?error:undefined}>
    {phase==='done'&&<section className="oc-arrive"><h1>Seu espaço está pronto.</h1><p className="oc-description">Os cadastros escolhidos foram confirmados. Você pode ajustar seus dados a qualquer momento.</p><Link to="/dashboard" className="oc-primary">Ir ao Dashboard ↗</Link></section>}
    {error&&<div role="alert" className="rounded-lg border border-border p-3 text-sm text-expense">{error} {!pending&&<button className="ml-2 underline" onClick={()=>load()}>Recarregar versão salva</button>}</div>}
    {notice&&<div role="status" className="rounded-lg border border-border p-3 text-sm text-text">{notice} <Link className="inline-block underline" to="/dashboard">Abrir Dashboard</Link></div>}
    {pending&&<div role="alert" className="rounded-lg border border-border p-4 text-sm text-text">A confirmação ainda precisa ser conferida. Use o mesmo pedido para consultar/concluir sem duplicar cadastros.<Button disabled={busy} className="mt-2" onClick={()=>run(commit)}>Conferir confirmação</Button></div>}
    {phase==='conversation'&&active!=='review'&&<section className="oc-chat">
      <div className="oc-eyebrow">{started?titles[active]:`Prazer, ${name.split(' ')[0]}`}</div>
      <h1><TypedQuestion text={started?(saved.data.step===active?saved.question:questions[active]):'O que você quer organizar primeiro?'}/></h1>
      {!started&&<div className="oc-options oc-profile-options">{([['personal','Minha vida pessoal'],['professional','Meu trabalho'],['both','Os dois']] as const).map(([v,label])=><button disabled={locked} key={v} onClick={()=>run(()=>chooseProfile(v))}>{label}</button>)}</div>}
      {active==='config'&&started&&<p className="oc-description">Saldo Atual é o disponível hoje; receita estimada é a receita integral do mês. A previsão soma os dois e desconta contas fixas e faturas. Renda já incluída no saldo pode ser contada novamente.</p>}
      {['client','subscription','expense'].includes(active)&&started&&<p className="oc-description">Seu caixa profissional fica separado do pessoal. Recebimentos não são marcados automaticamente.</p>}
      <form className="oc-chat-form" onSubmit={e=>{e.preventDefault();if(!locked&&text.trim()&&(!started||localConversationReply(active,text)||(consent&&saved.ai_available)))void run(answer)}}>
        <div className="oc-composer"><textarea ref={inputRef} aria-label="Sua resposta" maxLength={3000} rows={2} value={text} disabled={locked} placeholder={started?'Pode responder do seu jeito…':'Pessoal, profissional ou os dois…'} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/><button aria-label="Enviar resposta" disabled={locked||!text.trim()||(started&&!localConversationReply(active,text)&&(!consent||!saved.ai_available))}>↑</button></div>
        <div className="oc-composer-footer"><span>Enter para enviar · Shift + Enter para nova linha</span><span role="status">{busy?'Preparando sua próxima pergunta…':''}</span></div>
        {started&&<label className="oc-consent"><input disabled={locked} type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo enviar minha resposta e os itens do rascunho ao Google Gemini para interpretar os dados. Posso usar os campos guiados sem envio à IA.</label>}
      </form>
      {started&&!saved.ai_available&&<p role="status" className="oc-small">IA indisponível no momento. Você pode concluir pelos campos guiados.</p>}
      <p className="oc-small">Você pode responder “não tenho” ou “ainda não sei” sem usar IA. Nenhum valor desconhecido vira zero.</p>
      <OnboardingPrivacy/>
      <button className="oc-link" disabled={locked} onClick={()=>setGuided(v=>!v)}>{guided?'Fechar campos guiados':'Prefiro preencher os campos'}</button>
      {draft.items.length>0&&<button disabled={locked} className="oc-link" style={{marginLeft:20}} onClick={()=>run(()=>review())}>Revisar {draft.items.length} item(ns)</button>}
    </section>}
    <fieldset disabled={locked} className="space-y-5">
      {phase==='conversation'&&<details className="oc-guided" open={guided||active==='review'} onToggle={e=>{if(active!=='review')setGuided(e.currentTarget.open)}}><summary>Configuração, etapas e campos guiados</summary>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Quero organizar<select aria-label="Perfil" className={selectClass} value={draft.profile} onChange={e=>{const profile=e.target.value as Draft['profile'];change({...draft,profile,conversation_started:true,step:steps(profile)[0]})}}><option value="both">Pessoal e profissional</option><option value="personal">Pessoal</option><option value="professional">Profissional</option></select></label>
        <label className="space-y-1 text-sm">Mês de referência<Input aria-label="Mês de referência" type="number" min={1} max={12} value={draft.month} onChange={e=>change({...draft,month:Number(e.target.value)})}/></label>
        <label className="space-y-1 text-sm">Ano de referência<Input aria-label="Ano de referência" type="number" min={2000} max={2099} value={draft.year} onChange={e=>change({...draft,year:Number(e.target.value)})}/></label>
      </div>
      <p className="text-xs text-muted">O período orienta novos itens. Alterá-lo não move os valores já preenchidos. Rascunhos sem uso expiram após 30 dias; você também pode descartá-los.</p>
      <nav aria-label="Etapas da configuração" className="flex flex-wrap gap-2">{currentSteps.map((step,index)=><button key={step} type="button" aria-current={active===step?'step':undefined} className={`rounded-full border border-border px-3 py-1.5 text-sm ${active===step?'bg-primary text-primary-fg':'text-muted'}`} onClick={()=>run(async()=>{if(step==='review') await review();else await persist({...draft,step})})}>{index+1}. {step==='review'?'Revisão':titles[step]}</button>)}</nav>
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
      </details>}
      {phase==='conversation'&&active==='review'&&<section className="space-y-4" aria-labelledby="onboarding-review-title">
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
        <Button variant="outline" onClick={()=>run(()=>review())}>Atualizar revisão</Button>
        {preview&&<div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm">{preview.rows.filter(i=>i.action==='create').length} novos · {preview.rows.filter(i=>i.action==='reuse').length} existentes · {preview.pending_count} pendentes.</p>
          {preview.current_period!==preview.reference_period&&<p className="text-sm text-warning">O período de referência {preview.reference_period} é diferente do mês atual {preview.current_period}. Confira mês/ano de cada item.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi os valores e períodos acima, com referência {preview.reference_period}, e quero salvar somente os itens incluídos.</label>
          <Button disabled={!preview.can_commit||!confirmed||dirty} onClick={()=>run(commit)}>Confirmar e cadastrar</Button>
          {!preview.can_commit&&<p className="text-sm text-muted">Corrija os avisos ou deixe os itens incompletos pendentes. Depois atualize a revisão.</p>}
        </div>}
      </section>}
      {phase==='conversation'&&started&&<div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={currentIndex===0} onClick={()=>run(async()=>{await persist({...draft,step:currentSteps[currentIndex-1]})})}><ArrowLeft size={16}/> Voltar</Button>
        {active!=='review'&&<>
          <Button variant="outline" onClick={()=>run(()=>advanceBlock('skip'))}>Pular por enquanto</Button>
          <Button variant="outline" disabled={draft.items.some(i=>visibleKinds.includes(i.kind))} onClick={()=>run(()=>advanceBlock('absent'))}>Não tenho / não se aplica</Button>
          <Button onClick={()=>run(async()=>{if(currentSteps[currentIndex+1]==='review')await review();else await persist({...draft,step:currentSteps[currentIndex+1]})})}>Continuar <ArrowRight size={16}/></Button>
        </>}
      </div>}
      <details className="text-sm text-muted"><summary className="cursor-pointer">Descartar este rascunho</summary><p className="my-2">Apaga somente o rascunho. Os cadastros financeiros já confirmados são preservados.</p><Button variant="outline" onClick={()=>run(async()=>{await api.post('/onboarding/discard',{version:saved.version});await load()})}>Descartar rascunho e recomeçar</Button></details>
    </fieldset>
    <p role="status" className="text-xs text-muted">{busy?'Salvando ou consultando…':dirty?'Há alterações ainda não salvas. Use Continuar ou Salvar rascunho e sair.':'Rascunho salvo.'}</p>
  </OnboardingFrame>
}
const questions:Record<string,string>={config:'Quanto você tem disponível hoje e qual é sua receita estimada?',bill:'Quais contas se repetem todo mês?',card:'Quais cartões e faturas você tem?',loan:'Você deve para alguém ou tem dinheiro a receber?',client:'Quais clientes você atende?',subscription:'Quais serviços recorrentes oferece?',expense:'Quais despesas profissionais já realizou?'}
