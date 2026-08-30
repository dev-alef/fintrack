import * as Sentry from '@sentry/node'
import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const remetente = process.env.EMAIL_FROM

// Sem chave, o envio fica desligado e a mensagem vai para o log. E o que
// permite rodar o projeto local sem conta em servico de e-mail nenhum: o link
// de verificacao aparece no terminal e da para clicar nele.
//
// Em producao isso seria perigoso silencioso - alguem pede recuperacao de
// senha, nada chega, e ninguem percebe. Por isso o aviso abaixo e barulhento.
export const emailHabilitado = Boolean(apiKey && remetente)

if (!emailHabilitado && process.env.NODE_ENV === 'production') {
  console.warn(
    '[email] RESEND_API_KEY ou EMAIL_FROM ausente: nenhum e-mail sera enviado. ' +
      'Verificacao de e-mail e recuperacao de senha nao funcionam sem isso.',
  )
}

const resend = apiKey ? new Resend(apiKey) : null

type Mensagem = {
  para: string
  assunto: string
  html: string
  texto: string
}

/**
 * Envia um e-mail transacional. Nunca lanca: uma falha de envio nao pode
 * derrubar o cadastro nem revelar, pelo comportamento da resposta, se um
 * endereco existe na base.
 *
 * Devolve se o envio foi aceito pelo provedor, para quem chama poder registrar.
 */
export async function enviarEmail({ para, assunto, html, texto }: Mensagem): Promise<boolean> {
  if (!resend || !remetente) {
    // Em desenvolvimento este log e a propria funcionalidade: e daqui que sai o
    // link para concluir o fluxo sem provedor configurado.
    console.log(`\n[email nao enviado - sem provedor]\npara: ${para}\nassunto: ${assunto}\n${texto}\n`)
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: remetente,
      to: para,
      subject: assunto,
      html,
      text: texto,
    })

    if (error) {
      console.error('[email] provedor recusou o envio:', error)
      relata(new Error(`Resend recusou o envio: ${error.name} - ${error.message}`), assunto)
      return false
    }

    return true
  } catch (erro) {
    console.error('[email] falha ao enviar:', erro)
    relata(erro, assunto)
    return false
  }
}

/**
 * Manda a falha para o Sentry.
 *
 * O cadastro e o pedido de recuperacao respondem sucesso mesmo quando o e-mail
 * nao sai - de proposito, para uma indisponibilidade do provedor nao derrubar o
 * cadastro nem revelar quais enderecos existem na base. O efeito colateral e
 * que ninguem percebe: a pessoa espera um e-mail que nunca chega, e do lado de
 * ca so fica uma linha de log que so alguem procurando encontraria.
 *
 * Aconteceu exatamente isso com uma RESEND_API_KEY invalida em producao: o
 * fluxo parecia funcionar, e a falha so apareceu porque fomos ler o log.
 *
 * O assunto entra como contexto porque diz qual fluxo quebrou - confirmacao de
 * conta ou recuperacao de senha. O destinatario NAO entra: e-mail de usuario em
 * relatorio de erro e dado pessoal vazando para outro servico.
 */
function relata(erro: unknown, assunto: string) {
  Sentry.captureException(erro, {
    tags: { area: 'email' },
    extra: { assunto },
  })
}
