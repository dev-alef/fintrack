import * as Sentry from '@sentry/node'
import { query } from './db/client'
import { enviarEmail } from './email'
import { emailDeAcessoNovo, descreveDispositivo } from './emails/templates'

/**
 * Avisa por e-mail quando a conta e acessada de um dispositivo desconhecido.
 *
 * Uma sessao roubada passa por cima da senha E do 2FA, porque os dois sao
 * verificados no login e nao a cada requisicao. Nao da para impedir o roubo do
 * lado do servidor, entao o que resta e DETECCAO: hoje, alguem entrando com a
 * sessao de outra pessoa nao produz sinal nenhum.
 *
 * O aviso so sai para dispositivo novo, nao a cada login. Um e-mail por dia
 * treina a pessoa a arquivar sem ler - e ai o alerta que importa chega no meio
 * do ruido que nos mesmos criamos.
 */
export async function avisaSeAcessoNovo(sessao: {
  id: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  try {
    if (!sessao.userAgent) return

    // "Conhecido" e ter havido outra sessao com o mesmo user-agent. O IP fica
    // de fora do criterio de proposito: em rede movel ele muda o tempo todo, e
    // usa-lo faria a pessoa receber aviso ao trocar de wi-fi para 4G.
    const conhecido = await query(
      `SELECT 1 FROM "session"
        WHERE "userId" = $1 AND "userAgent" = $2 AND id <> $3
        LIMIT 1`,
      [sessao.userId, sessao.userAgent, sessao.id],
    )
    if (conhecido.rows.length > 0) return

    const usuario = await query('SELECT name, email FROM users WHERE id = $1', [sessao.userId])
    const dados = usuario.rows[0]
    if (!dados?.email) return

    const base = process.env.BETTER_AUTH_URL || 'http://localhost:5173'
    const { assunto, html, texto } = emailDeAcessoNovo({
      nome: dados.name?.trim().split(/\s+/)[0] || 'tudo bem',
      quando: new Date(),
      dispositivo: descreveDispositivo(sessao.userAgent),
      ip: sessao.ipAddress,
      urlSeguranca: `${base}/esqueci-senha`,
    })

    await enviarEmail({ para: dados.email, assunto, html, texto })
  } catch (erro) {
    // Nunca derruba o login. Um aviso que falha e ruim; um aviso que impede a
    // pessoa de entrar na propria conta e muito pior.
    console.error('[acesso-novo]', erro)
    Sentry.captureException(erro)
  }
}
