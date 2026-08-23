import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
})

// Lock compartilhado de refresh: enquanto uma chamada a /auth/refresh estiver
// pendente, todas as requisições que tomarem 401 aguardam a MESMA promise em
// vez de disparar refresh concorrentes (o que causava logout em massa no
// Dashboard, que dispara várias queries em paralelo).
let refreshPromise: Promise<string> | null = null

// Dispara (ou reutiliza) o refresh do access token. Resolve com o novo token.
// Rejeita apenas uma vez, mesmo que várias requisições estejam aguardando.
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) throw new Error('No refresh token')

    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/refresh`,
      { refreshToken }
    )
    localStorage.setItem('accessToken', data.accessToken)
    return data.accessToken
  })()

  try {
    return await refreshPromise
  } finally {
    // IMPORTANTE: limpa a promise ao final (sucesso ou falha). Sem isso, o
    // próximo ciclo de expiração ficaria preso na promise velha resolvida/rejeitada.
    refreshPromise = null
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // _retry impede que a própria requisição repetida (ou um refresh falho)
    // dispare o interceptor de novo em loop. A chamada a /auth/refresh usa o
    // axios "cru" (axios.post), então nem passa por este interceptor.
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const accessToken = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        // refreshAccessToken só rejeita uma vez; o logout acontece aqui, único.
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
