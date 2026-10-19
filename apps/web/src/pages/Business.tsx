import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BriefcaseBusiness, Plus, Pencil, Archive, Check, Undo2, Trash2 } from 'lucide-react'
import api from '@/services/api'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { BusinessData, BusinessClient, Subscription, BusinessExpense, Due, Receipt } from '@/lib/business'

const fmt = (value: string | number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = (date: string) => date.split('-').reverse().join('/')
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const frequency: Record<number, string> = { 1: 'Mensal', 3: 'Trimestral', 12: 'Anual' }
const errorText = (error: unknown) => isAxiosError<{ error: string }>(error) && error.response?.data?.error ? error.response.data.error : 'Não foi possível salvar. Verifique a conexão e tente novamente.'
type Target = { kind: 'client' | 'subscription' | 'expense' | 'receive' | 'end' | 'archive' | 'void' | 'deleteExpense'; client?: BusinessClient; subscription?: Subscription; expense?: BusinessExpense; due?: Due; receipt?: Receipt }
const titles: Record<Target['kind'], string> = { client: 'Cliente', subscription: 'Assinatura de serviço', expense: 'Despesa profissional realizada', receive: 'Confirmar recebimento', end: 'Encerrar assinatura', archive: 'Arquivar cliente', void: 'Estornar recebimento', deleteExpense: 'Excluir despesa profissional' }

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}
const nativeSelect = 'h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-text'

function Editor({ target, clients, userId, serverToday, close }: { target: Target; clients: BusinessClient[]; userId: string; serverToday: string; close: () => void }) {
  // Keep this identifier across edits/retries if a response was lost.
  const [requestId] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState({
    name: target.client?.name ?? '', contact: target.client?.contact ?? '',
    notes: target.client?.notes ?? target.subscription?.notes ?? target.expense?.notes ?? '',
    service_name: target.subscription?.service_name ?? '',
    client_id: target.subscription?.client_id ?? clients.find(c => !c.archived)?.id ?? '',
    amount: target.subscription?.amount ?? target.expense?.amount ?? '',
    interval_months: String(target.subscription?.interval_months ?? 1),
    start_date: target.subscription?.start_date ?? serverToday,
    end_date: target.subscription?.end_date && target.subscription.end_date < serverToday ? target.subscription.end_date : serverToday,
    paid_on: serverToday, spent_on: target.expense?.spent_on ?? serverToday,
    title: target.expense?.title ?? '', category: target.expense?.category ?? '',
  })
  const [validation, setValidation] = useState('')
  const change = (key: keyof typeof form, value: string) => { setForm(previous => ({ ...previous, [key]: value })); setValidation('') }
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(',', '.'))
      if ((target.kind === 'expense' || (target.kind === 'subscription' && !target.subscription)) && (!Number.isFinite(amount) || amount <= 0 || amount > 999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) throw new Error('Informe um valor positivo com até duas casas decimais.')
      const subId = target.subscription?.id ?? target.due?.subscription_id ?? target.receipt?.subscription_id
      switch (target.kind) {
        case 'client': return target.client ? api.put(`/business/clients/${target.client.id}`, { name: form.name, contact: form.contact, notes: form.notes }) : api.post('/business/clients', { id: requestId, name: form.name, contact: form.contact, notes: form.notes })
        case 'subscription': return target.subscription ? api.put(`/business/subscriptions/${subId}`, { service_name: form.service_name, notes: form.notes }) : api.post('/business/subscriptions', { id: requestId, client_id: form.client_id, service_name: form.service_name, amount, interval_months: Number(form.interval_months), start_date: form.start_date, notes: form.notes })
        case 'expense': return target.expense ? api.put(`/business/expenses/${target.expense.id}`, { title: form.title, category: form.category, amount, spent_on: form.spent_on, notes: form.notes }) : api.post('/business/expenses', { id: requestId, title: form.title, category: form.category, amount, spent_on: form.spent_on, notes: form.notes })
        case 'receive': return api.post(`/business/subscriptions/${subId}/receipts`, { id: requestId, due_on: target.due!.due_on, paid_on: form.paid_on, notes: form.notes })
        case 'end': return api.post(`/business/subscriptions/${subId}/end`, { end_date: form.end_date })
        case 'archive': return api.delete(`/business/clients/${target.client!.id}`)
        case 'void': return api.delete(`/business/subscriptions/${subId}/receipts/${target.due?.receipt_id ?? target.receipt!.id}`)
        case 'deleteExpense': return api.delete(`/business/expenses/${target.expense!.id}`)
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['business', userId] }); close() },
    onError: error => { setValidation(isAxiosError(error) ? errorText(error) : error instanceof Error ? error.message : errorText(error)); void qc.invalidateQueries({ queryKey: ['business', userId] }) },
  })
  const submit = (event: FormEvent) => { event.preventDefault(); setValidation(''); mutation.mutate() }
  const field = (key: keyof typeof form, label: string, props: { type?: string; maxLength?: number; required?: boolean; min?: string; max?: string; inputMode?: 'decimal' } = {}) => <Field id={`business-${key}`} label={label}><Input id={`business-${key}`} value={form[key]} onChange={e => change(key,e.target.value)} {...props} /></Field>
  const destructive = ['end','archive','void','deleteExpense'].includes(target.kind)
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) close() }}><DialogContent className="z-[110] max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl" onEscapeKeyDown={e => { if (mutation.isPending) e.preventDefault() }} onInteractOutside={e => { if (mutation.isPending) e.preventDefault() }}>
    <DialogHeader><DialogTitle>{target.kind === 'client' || target.kind === 'subscription' || target.kind === 'expense' ? `${target.client || target.subscription || target.expense ? 'Editar' : 'Adicionar'} ` : ''}{titles[target.kind]}</DialogTitle><DialogDescription>Controle profissional separado. Esta ação não altera suas transações pessoais nem o Saldo Atual.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
        {target.kind === 'client' && <>{field('name','Nome do cliente',{ required: true, maxLength: 120 })}{field('contact','Contato (opcional)',{ maxLength: 200 })}</>}
        {target.kind === 'subscription' && <>
          {!target.subscription && <Field id="business-client_id" label="Cliente"><select id="business-client_id" className={nativeSelect} required value={form.client_id} onChange={e => change('client_id',e.target.value)}>{clients.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
          {field('service_name','Serviço',{ required: true, maxLength: 150 })}
          {!target.subscription ? <>{field('amount','Valor por período (R$)',{ required: true, inputMode: 'decimal' })}<Field id="business-interval_months" label="Frequência"><select id="business-interval_months" className={nativeSelect} value={form.interval_months} onChange={e => change('interval_months',e.target.value)}>{[1,3,12].map(value => <option key={value} value={value}>{frequency[value]}</option>)}</select></Field>{field('start_date','Primeiro vencimento',{ type: 'date', required: true, min: '1900-01-01', max: '2100-12-31' })}<p className="text-xs text-muted">O dia do primeiro vencimento se repete a cada período. Nos meses mais curtos, usamos o último dia. Datas anteriores geram pendências anteriores.</p></> : <p className="text-sm text-muted">{fmt(target.subscription.amount)} · {frequency[target.subscription.interval_months]}. Para alterar valor, cliente ou frequência, encerre esta assinatura e cadastre outra. O histórico fica preservado.</p>}
        </>}
        {target.kind === 'expense' && <>{field('title','Descrição da despesa',{ required: true, maxLength: 150 })}{field('category','Categoria (opcional)',{ maxLength: 80 })}{field('amount','Valor realizado (R$)',{ required: true, inputMode: 'decimal' })}{field('spent_on','Data do gasto',{ type: 'date', required: true, min: '1900-01-01', max: serverToday })}</>}
        {target.kind === 'receive' && <><p className="text-sm break-words">{target.due!.client_name} · {target.due!.service_name}<br />Vencimento: {dateLabel(target.due!.due_on)} · <strong>{fmt(target.due!.amount)}</strong></p>{field('paid_on','Data em que recebeu',{ type: 'date', required: true, min: '1900-01-01', max: serverToday })}<p className="text-xs text-muted">Confirma o valor integral deste período. Apenas marque depois de verificar o recebimento.</p></>}
        {target.kind === 'end' && <>{field('end_date','Último dia de vigência (inclusive)',{ type: 'date', required: true, min: '1900-01-01', max: target.subscription!.end_date ?? '2100-12-31' })}<p className="text-sm text-muted">Vencimentos até essa data continuam no controle. Os posteriores deixam de ser previstos. Para cancelar antes do início, escolha uma data anterior ao primeiro vencimento. Recebimentos já confirmados são preservados.</p></>}
        {target.kind === 'archive' && <p className="text-sm text-muted">Arquivar {target.client!.name}? Primeiro encerre as assinaturas vigentes ou futuras deste cliente. O histórico permanece disponível.</p>}
        {target.kind === 'void' && <p className="text-sm text-muted">O recebimento será marcado como estornado e o período voltará a ficar pendente. Isso apenas corrige seu controle; não devolve dinheiro ao cliente.</p>}
        {target.kind === 'deleteExpense' && <p className="text-sm text-muted">Excluir “{target.expense!.title}” do resultado profissional?</p>}
        {['client','subscription','expense','receive'].includes(target.kind) && field('notes','Observações (opcional)',{ maxLength: 500 })}
      </fieldset>
      {validation && <p role="alert" className="rounded-lg border border-danger/30 p-3 text-sm text-danger">{validation}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : destructive ? 'Confirmar' : target.kind === 'receive' ? 'Confirmar recebimento' : 'Salvar'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}

function DueList({ dues, edit }: { dues: Due[]; edit: (target: Target) => void }) {
  return <div className="space-y-2">{dues.map(due => <div key={`${due.subscription_id}-${due.due_on}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
    <div className="min-w-0 flex-1 break-words"><p className="font-medium text-text">{due.client_name} · {due.service_name}</p><p className="mt-1 text-xs text-muted">{dateLabel(due.due_on)} · {fmt(due.amount)} · <span className={due.status === 'overdue' ? 'text-danger' : due.status === 'received' ? 'text-income' : 'text-warning'}>{due.status === 'overdue' ? 'Atrasado' : due.status === 'received' ? 'Recebido' : 'Pendente'}</span></p></div>
    <Button size="sm" variant="outline" onClick={() => edit({ kind: due.receipt_id ? 'void' : 'receive', due })}>{due.receipt_id ? <Undo2 className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}{due.receipt_id ? 'Estornar' : 'Receber'}</Button>
  </div>)}</div>
}

function BusinessPage({ userId }: { userId: string }) {
  const [period, setPeriod] = useState(() => today().slice(0,7))
  const [view, setView] = useState('recebimentos')
  const [editor, setEditor] = useState<Target | null>(null)
  const query = useQuery({ queryKey: ['business', userId, period], queryFn: () => api.get<BusinessData>(`/business?year=${period.slice(0,4)}&month=${Number(period.slice(5,7))}`).then(r => r.data) })
  const data = query.data
  const hasClients = data?.clients.some(c => !c.archived)
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-text"><BriefcaseBusiness className="h-6 w-6 text-primary" />Profissional</h1><p className="mt-1 text-sm text-muted">Clientes, serviços por assinatura e resultado do seu trabalho.</p></div><Field id="business-period" label="Mês do controle"><Input id="business-period" type="month" min="1900-01" max="2100-12" value={period} onChange={e => { if (/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value)) setPeriod(e.target.value) }} /></Field></header>
    <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Os valores desta área ficam separados das finanças pessoais. Recebimentos são confirmados manualmente após você verificar o pagamento. Eles não alteram seu Saldo Atual pessoal.</p>
    {query.isPending ? <p role="status" className="text-muted">Carregando controle profissional…</p> : query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-danger/30 p-4 text-danger"><p>Não foi possível carregar os dados profissionais.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
        ['Recebido no mês', data.totals.received, 'Entradas confirmadas pela data do recebimento.'],
        ['Despesas realizadas', data.totals.expenses, 'Gastos profissionais registrados neste mês.'],
        ['Resultado do mês', data.totals.result, 'Recebido no mês menos despesas realizadas.'],
        ['A receber no mês', data.totals.pending, 'Períodos com vencimento neste mês ainda não recebidos.'],
        ['Atrasado até este mês', data.totals.overdue, 'Pendências em aberto hoje, com vencimento até o mês selecionado.'],
        ['Receita recorrente mensal equivalente', data.totals.monthly_recurring, `${data.totals.active_subscriptions} assinaturas vigentes hoje. Trimestrais ÷ 3 e anuais ÷ 12; não é dinheiro recebido.`],
      ].map(([label,value,note]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted">{label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${Number(value) < 0 ? 'text-danger' : 'text-text'}`}>{fmt(value)}</p><p className="mt-1 text-xs text-muted">{note}</p></CardContent></Card>)}</div>
      <nav aria-label="Controle profissional" className="flex flex-wrap gap-2">{[['recebimentos','Recebimentos'],['assinaturas','Assinaturas'],['clientes','Clientes'],['despesas','Despesas']].map(([key,label]) => <Button key={key} variant={view === key ? 'default' : 'outline'} aria-pressed={view === key} onClick={() => setView(key)}>{label}</Button>)}</nav>
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setEditor({ kind: 'client' })}><Plus className="mr-2 h-4 w-4" />Cliente</Button><Button size="sm" variant="outline" disabled={!hasClients} onClick={() => setEditor({ kind: 'subscription' })}><Plus className="mr-2 h-4 w-4" />Assinatura</Button><Button size="sm" variant="outline" onClick={() => setEditor({ kind: 'expense' })}><Plus className="mr-2 h-4 w-4" />Despesa profissional</Button></div>
      {!hasClients && <p className="text-sm text-muted">Comece cadastrando um cliente; depois adicione o serviço recorrente dele.</p>}
      {view === 'recebimentos' && <section className="space-y-5" aria-label="Recebimentos profissionais"><div className="space-y-3"><h2 className="font-semibold text-text">Vencimentos do mês</h2><p className="text-xs text-muted">Previsto por vencimento: {fmt(data.totals.expected)}. Antecipações e atrasos entram no resultado pela data em que você recebeu.</p>{data.dues.length ? <DueList dues={data.dues} edit={setEditor} /> : <p className="text-sm text-muted">Nenhum vencimento de assinatura neste mês.</p>}</div>
        {data.previous.length > 0 && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium text-warning">Pendências anteriores ({data.previous.length})</summary><div className="mt-4 max-h-[28rem] overflow-y-auto"><DueList dues={data.previous} edit={setEditor} /></div></details>}
        <div className="space-y-3"><h2 className="font-semibold text-text">Histórico de recebimentos do mês</h2>{data.receipts.length ? data.receipts.map(receipt => <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div className="min-w-0 flex-1 break-words"><p className="text-sm font-medium text-text">{receipt.client_name} · {receipt.service_name} · {fmt(receipt.amount)}</p><p className="mt-1 text-xs text-muted">Recebido em {dateLabel(receipt.paid_on)} · vencimento {dateLabel(receipt.due_on)}{receipt.voided_at ? ' · Estornado (fora dos totais)' : ''}</p>{receipt.notes && <p className="mt-1 text-xs text-muted">{receipt.notes}</p>}</div>{!receipt.voided_at && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: 'void', receipt })}>Estornar</Button>}</div>) : <p className="text-sm text-muted">Nenhum recebimento registrado nesta competência de caixa.</p>}</div>
      </section>}
      {view === 'assinaturas' && <section aria-label="Assinaturas de serviços" className="space-y-3">{data.subscriptions.length ? data.subscriptions.map(sub => <Card key={sub.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0 flex-1 break-words"><h2 className="font-semibold text-text">{sub.service_name}</h2><p className="text-sm text-muted">{sub.client_name} · {fmt(sub.amount)} · {frequency[sub.interval_months]}</p><p className="mt-1 text-xs text-muted">Primeiro vencimento: {dateLabel(sub.start_date)}{sub.end_date ? ` · Último dia de vigência: ${dateLabel(sub.end_date)}` : sub.start_date > data.today ? ' · Início futuro' : ' · Vigente'}</p>{sub.notes && <p className="mt-1 text-xs text-muted">{sub.notes}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={`Editar assinatura ${sub.service_name}`} onClick={() => setEditor({ kind: 'subscription', subscription: sub })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => setEditor({ kind: 'end', subscription: sub })}>{sub.end_date ? 'Antecipar encerramento' : 'Encerrar'}</Button></div></CardContent></Card>) : <p className="text-sm text-muted">Nenhuma assinatura cadastrada.</p>}</section>}
      {view === 'clientes' && <section aria-label="Clientes profissionais" className="space-y-3">{data.clients.map(client => <Card key={client.id}><CardContent className="flex flex-wrap justify-between gap-3 p-4"><div className="min-w-0 flex-1 break-words"><h2 className="font-semibold text-text">{client.name}{client.archived ? ' · Arquivado' : ''}</h2>{client.contact && <p className="text-sm text-muted">{client.contact}</p>}{client.notes && <p className="mt-1 text-xs text-muted">{client.notes}</p>}</div>{!client.archived && <div className="flex gap-2"><Button size="sm" variant="outline" aria-label={`Editar cliente ${client.name}`} onClick={() => setEditor({ kind: 'client', client })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" aria-label={`Arquivar cliente ${client.name}`} onClick={() => setEditor({ kind: 'archive', client })}><Archive className="h-4 w-4" /></Button></div>}</CardContent></Card>)}</section>}
      {view === 'despesas' && <section aria-label="Despesas profissionais" className="space-y-3"><p className="text-xs text-muted">Registre apenas gastos já realizados; eles são descontados do resultado do mês pela data do gasto.</p>{data.expenses.length ? data.expenses.map(expense => <Card key={expense.id}><CardContent className="flex flex-wrap justify-between gap-3 p-4"><div className="min-w-0 flex-1 break-words"><h2 className="font-semibold text-text">{expense.title} · {fmt(expense.amount)}</h2><p className="text-sm text-muted">{dateLabel(expense.spent_on)}{expense.category ? ` · ${expense.category}` : ''}</p>{expense.notes && <p className="mt-1 text-xs text-muted">{expense.notes}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" aria-label={`Editar despesa ${expense.title}`} onClick={() => setEditor({ kind: 'expense', expense })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" aria-label={`Excluir despesa ${expense.title}`} onClick={() => setEditor({ kind: 'deleteExpense', expense })}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>) : <p className="text-sm text-muted">Nenhuma despesa profissional registrada neste mês.</p>}</section>}
    </>}
    {editor && data && <Editor target={editor} clients={data.clients} userId={userId} serverToday={data.today} close={() => setEditor(null)} />}
  </div>
}
export default function Business() {
  const { data: session } = useSession()
  return session?.user.id ? <BusinessPage key={session.user.id} userId={session.user.id} /> : <p role="status">Carregando sessão…</p>
}
