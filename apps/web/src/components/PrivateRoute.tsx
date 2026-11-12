import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../lib/auth-client'
import { useAuthStore } from '../store/auth.store'
import { LoadingState } from '@/components/loading-state'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const setUser = useAuthStore((s) => s.setUser)

  // Mantem a store em sincronia com a sessao do servidor, que e a fonte da
  // verdade. Antes o estado inicial vinha de um token em localStorage, o que
  // fazia a interface achar que estava autenticada mesmo com token expirado -
  // e so descobrir na primeira resposta 401.
  useEffect(() => {
    if (session?.user) {
      setUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      })
    } else if (!isPending) {
      setUser(null)
    }
  }, [session, isPending, setUser])

  // A verificacao e assincrona: sem este estado a tela redirecionaria para o
  // login por um instante a cada recarregamento, antes da sessao ser conhecida.
  if (isPending) {
    return <LoadingState variant="screen" title="Carregando sua Provisão…" description="Estamos conferindo sua sessão e preparando seu espaço."
      slowMessage="O servidor pode estar iniciando após um período sem uso. Aguarde nesta tela enquanto preparamos seu acesso." />
  }

  return session?.user ? <>{children}</> : <Navigate to="/login" replace />
}
