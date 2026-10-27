export const erroDeServidor = 'Não foi possível conectar ao servidor. Ele pode estar iniciando após um período sem uso. Aguarde cerca de 1 minuto e tente novamente. Se continuar, confira sua conexão ou tente mais tarde.'
export const servidorIndisponivel = (status?: number) => !status || status >= 500

export function erroDeLogin(status?: number): string {
  if (status === 401 || status === 400) return 'E-mail ou senha incorretos. Confira e tente de novo.'
  if (status === 429) return 'Muitas tentativas seguidas. Espere um minuto antes de tentar de novo.'
  if (status === 403) return 'Não foi possível entrar com esta conta. Se você usa o Google, entre por ele.'
  if (servidorIndisponivel(status)) return erroDeServidor
  return 'Não foi possível entrar agora. Tente novamente em instantes.'
}
