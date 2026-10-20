import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import api from '../services/api'
export function OnboardingInvitation({userId}:{userId:string}) {
  const qc=useQueryClient()
  const key=['onboardingInvitation',userId]
  const q=useQuery<{show:boolean;resumable:boolean}>({queryKey:key,queryFn:()=>api.get('/onboarding/invitation').then(r=>r.data)})
  const dismiss=useMutation({mutationFn:()=>api.post('/onboarding/dismiss'),onSuccess:()=>qc.invalidateQueries({queryKey:key})})
  if(!q.data?.show)return null
  return <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4" aria-label="Assistente de configuração inicial">
    <div><h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18}/>{q.data.resumable?'Continue sua configuração':'Vamos organizar suas finanças?'}</h2><p className="mt-1 text-sm text-muted">Responda algumas perguntas e confira os cadastros antes de salvar.</p></div>
    <div className="flex flex-wrap items-center gap-3"><Link className="rounded-full bg-primary px-4 py-2 text-sm text-primary-fg" to="/assistente-inicial">{q.data.resumable?'Continuar rascunho':'Começar configuração'}</Link><button className="text-sm text-muted underline" disabled={dismiss.isPending} onClick={()=>dismiss.mutate()}>Agora não</button></div>
    {dismiss.isError&&<p role="alert" className="text-sm text-muted">Não foi possível ocultar o convite. Tente novamente.</p>}
  </section>
}
