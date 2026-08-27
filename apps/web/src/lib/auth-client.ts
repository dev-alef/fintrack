import { createAuthClient } from 'better-auth/react'

// O cliente fala com o handler do Better Auth montado em /api/auth na API.
// A sessao viaja em cookie httpOnly, entao nao ha token para guardar nem para
// anexar em header - o navegador cuida disso sozinho, desde que as
// requisicoes sejam feitas com credenciais.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession } = authClient
