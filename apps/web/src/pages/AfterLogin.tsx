import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { OnboardingFrame, type OnboardingPhase } from '@/components/onboarding-frame'
import api from '@/services/api'
export default function AfterLogin() {
  const {data:session}=useSession()
  const navigate=useNavigate(), qc=useQueryClient()
  const [phase,setPhase]=useState<OnboardingPhase>('transition')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const q=useQuery<{show:boolean;resumable:boolean}>({queryKey:['onboardingInvitation',session?.user.id],enabled:!!session?.user.id,staleTime:0,queryFn:()=>api.get('/onboarding/invitation').then(r=>r.data)})
  useEffect(()=>{
    if(!q.isSuccess)return
    const t=setTimeout(()=>setPhase('intro'),matchMedia('(prefers-reduced-motion: reduce)').matches?200:3400)
    return()=>clearTimeout(t)
  },[q.isSuccess])
  async function exit() {
    setBusy(true);setError('')
    try {
      if(q.data?.show){await api.post('/onboarding/dismiss');await qc.invalidateQueries({queryKey:['onboardingInvitation',session?.user.id]})}
      navigate('/dashboard',{replace:true})
    } catch {setError('Não foi possível continuar. Tente novamente.')} finally {setBusy(false)}
  }
  if(q.isPending)return <div className="grid min-h-screen place-items-center bg-bg text-muted" role="status">Preparando seu espaço…</div>
  if(q.isError)return <div className="grid min-h-screen place-content-center gap-4 bg-bg p-6 text-text"><p>Não foi possível conferir sua configuração.</p><button onClick={()=>q.refetch()} className="text-primary underline">Tentar novamente</button><Link to="/dashboard">Ir ao Dashboard</Link></div>
  return <OnboardingFrame phase={phase} group={0} returning={!q.data.show} locked={busy} error={error}
    onStart={()=>navigate(q.data.show?'/assistente-inicial?conversation=1':'/dashboard',{replace:true})} onExit={()=>void exit()}>{null}</OnboardingFrame>
}
