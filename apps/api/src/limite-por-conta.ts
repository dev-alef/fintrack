/**
 * Limita tentativas de login pela CONTA alvo, nao por IP.
 *
 * # Por que existe
 *
 * Contar por IP sempre dependeu de adivinhar topologia alheia. Pelo proxy da
 * Vercel a cadeia para no IP de saida dela, que e compartilhado entre clientes e
 * muda sem aviso; direto no Render o IP e real, mas trocavel por qualquer um com
 * uma lista de proxies. Nos dois casos o numero que conta esta, em algum grau,
 * na mao de quem ataca.
 *
 * A conta alvo nao esta. Quem quer entrar na conta de alguem precisa mandar o
 * e-mail dessa pessoa - e a unica coisa da requisicao que o atacante NAO pode
 * variar, porque variar significa desistir do alvo. Trocar de IP, de proxy, de
 * pais ou de provedor de nuvem nao ajuda em nada aqui.
 *
 * O limite por IP continua, como rede de fundo grosseira. Este e o que segura.
 *
 * # Por que so /sign-in/email, e nao /sign-up/email tambem
 *
 * Sign-up com um e-mail que ja existe custa quase nada - devolve 422 sem criar
 * conta nem mandar e-mail nenhum - e o app ja revela de proposito que o
 * endereco existe (ver erroDeCadastro em Login.tsx: quem tenta se cadastrar
 * descobre de qualquer forma). Bloquear a CONTA por falhas de sign-up nao
 * defenderia nada que ja nao seja publico.
 *
 * E colocaria as duas rotas na mesma chave criaria um ataque novo, mais facil
 * que o brute-force que este arquivo existe para impedir: mandar dez sign-ups
 * com o e-mail de uma vitima - sem saber a senha dela - trancaria o LOGIN
 * dessa vitima por quinze minutos. Negacao de servico de graca. Por isso
 * sign-up fica de fora daqui; o limite por IP (customRules em auth.ts) e quem
 * cobre o volume ali.
 *
 * # Onde roda
 *
 * Nos hooks do proprio Better Auth, nao num middleware do Express. O corpo da
 * requisicao e lido do stream pelo handler dele, entao um middleware antes que
 * quisesse ler o e-mail consumiria o stream e deixaria o login sem corpo. Nos
 * hooks o corpo ja chega parseado, e `ctx.path` ja vem sem o prefixo.
 *
 * # Decisoes
 *
 * **Conta FALHA, nao tentativa.** Entrar certo zera o contador. Sem isso, quem
 * usa o app varias vezes no dia acabaria barrado por usar o app.
 *
 * **Nao revela se a conta existe.** O contador sobe para qualquer e-mail, exista
 * ou nao, porque os dois devolvem o mesmo erro. Se so subisse para conta
 * existente, a mensagem de bloqueio viraria um detector de quem tem conta aqui -
 * exatamente o que a mensagem de login generica evita.
 *
 * **Dez falhas, quinze minutos.** Uma pessoa que esqueceu a senha raramente erra
 * dez vezes seguidas nesse tempo; forca bruta precisa de milhoes. E curto de
 * proposito: bloqueio longo vira arma, porque qualquer um tranca a conta alheia
 * so errando senha de proposito. Quinze minutos incomoda quem ataca e e
 * absorvivel por quem so errou.
 *
 * **Na memoria do processo.** Uma instancia no Render, um mapa. Banco aqui
 * significaria uma escrita a cada tentativa, inclusive nas do ataque -
 * transformar o limitador em amplificador de carga. Reiniciar zera os
 * contadores, e a janela e de quinze minutos: o que se perde e pouco.
 */
import { APIError } from 'better-auth/api'

/**
 * Caminho protegido - so o login. E o `ctx.path` do Better Auth, ja sem o
 * prefixo /api/auth. Ver a secao "Por que so /sign-in/email" acima.
 */
const CAMINHOS = new Set(['/sign-in/email'])

const JANELA_MS = 15 * 60 * 1000
const MAX_FALHAS = 10

/**
 * Teto de contas rastreadas. Sem ele, um ataque com e-mails aleatorios cresceria
 * o mapa ate o processo morrer - o limitador virando o proprio DoS.
 */
const MAX_CONTAS = 10_000

type Registro = { falhas: number; ate: number }

const registros = new Map<string, Registro>()

function limpa(agora: number) {
  for (const [chave, registro] of registros) {
    if (agora >= registro.ate) registros.delete(chave)
  }
  if (registros.size <= MAX_CONTAS) return

  // Ainda cheio depois de expirar os vencidos: derruba os mais antigos. Map
  // itera na ordem de insercao, entao os primeiros sao os que entraram ha mais
  // tempo - e sao os que estao mais perto de expirar sozinhos.
  let removidos = 0
  const sobrando = registros.size - MAX_CONTAS
  for (const chave of registros.keys()) {
    registros.delete(chave)
    if (++removidos >= sobrando) break
  }
}

/**
 * Duas grafias do mesmo e-mail nao podem virar dois baldes. Minusculas e sem
 * espaco cobre o caso real; nao normalizo pontos do Gmail de proposito, porque
 * essa regra e de um provedor so e aplica-la a todos juntaria contas distintas.
 */
function chaveDe(corpo: unknown): string | null {
  const email = (corpo as Record<string, unknown> | undefined)?.email
  if (typeof email !== 'string') return null
  const limpo = email.trim().toLowerCase()
  return limpo.length > 0 && limpo.length <= 254 ? limpo : null
}

/** Barra antes de a senha ser sequer verificada. Lanca 429 quando estourou. */
export function barraSeExcedeu(caminho: string, corpo: unknown): void {
  if (!CAMINHOS.has(caminho)) return

  const chave = chaveDe(corpo)
  if (!chave) return

  const agora = Date.now()
  limpa(agora)

  const registro = registros.get(chave)
  if (!registro || agora >= registro.ate || registro.falhas < MAX_FALHAS) return

  const segundos = Math.ceil((registro.ate - agora) / 1000)
  const minutos = Math.max(1, Math.ceil(segundos / 60))

  throw new APIError(
    'TOO_MANY_REQUESTS',
    {
      message: `Muitas tentativas para esta conta. Tente de novo em ${minutos} ${
        minutos === 1 ? 'minuto' : 'minutos'
      }.`,
      code: 'CONTA_TEMPORARIAMENTE_BLOQUEADA',
    },
    { 'Retry-After': String(segundos) },
  )
}

/** Anota o desfecho. Sucesso zera; falha soma. */
export function anotaTentativa(caminho: string, corpo: unknown, falhou: boolean): void {
  if (!CAMINHOS.has(caminho)) return

  const chave = chaveDe(corpo)
  if (!chave) return

  if (!falhou) {
    registros.delete(chave)
    return
  }

  const agora = Date.now()
  const atual = registros.get(chave)
  const valido = atual !== undefined && agora < atual.ate

  registros.set(chave, {
    falhas: valido ? atual.falhas + 1 : 1,
    // A janela conta da PRIMEIRA falha, nao da ultima. Renovando a cada
    // tentativa, o bloqueio se estenderia para sempre enquanto o ataque
    // continuasse - e quem paga por isso e o dono da conta, nao quem ataca.
    ate: valido ? atual.ate : agora + JANELA_MS,
  })
}

/** Quantas falhas validas a conta acumulou agora. Existe para os testes. */
export function falhasDe(email: string): number {
  const chave = chaveDe({ email })
  const registro = chave ? registros.get(chave) : undefined
  if (!registro || Date.now() >= registro.ate) return 0
  return registro.falhas
}

/** Limpa o estado entre testes. */
export function zeraTudo(): void {
  registros.clear()
}
