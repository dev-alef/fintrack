import { create } from 'zustand'

interface User { id: string; name: string; email: string }

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
  },
}))
