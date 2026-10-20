import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import api from '@/services/api'
export default function AfterLogin() {
  const {data:session}=useSession()
  const q=useQuery<{show:boolean;resumable:boolean}>({queryKey:['onboardingInvitation',session?.user.id],enabled:!!session?.user.id,staleTime:0,queryFn:()=>api.get('/onboarding/invitation').then(r=>r.data)})
  if(q.isPending)return <div className="grid min-h-screen place-items-center bg-bg text-muted" role="status">Preparando seu espaço…</div>
  if(q.isError)return <div className="grid min-h-screen place-content-center gap-4 bg-bg p-6 text-text"><p>Não foi possível conferir sua configuração.</p><button onClick={()=>q.refetch()} className="text-primary underline">Tentar novamente</button><Link to="/dashboard">Ir ao Dashboard</Link></div>
  return <Navigate to={q.data.show?'/assistente-inicial?welcome=1':'/dashboard'} replace/>
}
