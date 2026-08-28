import { create } from 'zustand'
import * as Sentry from '@sentry/react'

interface User { id: string; name: string; email: string }

// A store nao guarda mais token: a sessao vive num cookie httpOnly que o
// JavaScript nao consegue ler, que e justamente o ponto. O que sobra aqui e um
// espelho do usuario da sessao, para a interface nao precisar consultar o
// servidor a cada render.
//
// A fonte da verdade e o servidor. Quem quiser o estado autoritativo usa o
// hook useSession do auth-client; esta store existe para conveniencia de
// leitura e para alimentar o Sentry.
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => {
    Sentry.setUser(user ? { id: user.id } : null)
    set({ user, isAuthenticated: !!user })
  },
  clear: () => {
    Sentry.setUser(null)
    set({ user: null, isAuthenticated: false })
  },
}))
