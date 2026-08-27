import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  // A sessao vai em cookie httpOnly. Sem isto o navegador nao envia o cookie
  // para a API, que esta em outro dominio, e toda requisicao volta 401.
  withCredentials: true,
})

// O interceptor de refresh de token deixou de existir junto com os tokens.
//
// Antes havia aqui um lock compartilhado para impedir que varias requisicoes
// disparassem refresh concorrentes e derrubassem a sessao. Esse problema
// desapareceu por construcao: quem renova a sessao agora e o proprio Better
// Auth, do lado do servidor, e o navegador apenas carrega o cookie.
//
// Tambem nao ha mais token para anexar em header, nem nada em localStorage
// para um XSS roubar.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sessao ausente ou expirada: manda para o login, a menos que ja estejamos
    // nele - senao a tela recarregaria em loop quando a propria verificacao de
    // sessao falhasse.
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
