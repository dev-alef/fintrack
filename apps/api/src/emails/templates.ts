// Templates de e-mail transacional.
//
// HTML de e-mail nao e HTML de navegador: clientes como Outlook e Gmail
// descartam <style> externo, CSS moderno e boa parte do que se usa na web. Por
// isso tudo aqui e inline e o layout se apoia em tabela - feio de escrever,
// mas e o que renderiza igual em todo lugar.
//
// Toda mensagem sai tambem em texto puro. Nao e enfeite: cliente que bloqueia
// HTML mostra so essa versao, e a ausencia dela e sinal classico de spam.

const COR_PRIMARIA = '#4f46e5'
const COR_TEXTO = '#1f2937'
const COR_APAGADA = '#6b7280'

function layout(conteudo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:${COR_PRIMARIA};">Provisão</p>
          ${conteudo}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
          <p style="margin:0;font-size:12px;line-height:18px;color:${COR_APAGADA};">
            Se você não solicitou este e-mail, pode ignorá-lo com segurança — nada acontece sem que o link seja aberto.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function botao(url: string, rotulo: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${COR_PRIMARIA};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${rotulo}</a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;line-height:20px;color:${COR_APAGADA};">
    Se o botão não funcionar, copie este endereço no navegador:<br>
    <span style="color:${COR_TEXTO};word-break:break-all;">${url}</span>
  </p>`
}

export function emailDeVerificacao(nome: string, url: string) {
  return {
    assunto: 'Confirme seu e-mail no Provisão',
    html: layout(`
      <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:${COR_TEXTO};">Olá, ${nome}.</p>
      <p style="margin:0;font-size:16px;line-height:24px;color:${COR_TEXTO};">
        Confirme seu e-mail para concluir o cadastro. Isso também é o que permite
        entrar com o Google usando esta mesma conta, sem criar outra.
      </p>
      ${botao(url, 'Confirmar meu e-mail')}
      <p style="margin:16px 0 0;font-size:13px;color:${COR_APAGADA};">O link vale por 1 hora.</p>
    `),
    texto: `Olá, ${nome}.

Confirme seu e-mail para concluir o cadastro no Provisão. Isso também é o que
permite entrar com o Google usando esta mesma conta, sem criar outra.

${url}

O link vale por 1 hora.

Se você não criou esta conta, pode ignorar este e-mail.`,
  }
}

export function emailDeRecuperacao(nome: string, url: string) {
  return {
    assunto: 'Redefinir sua senha do Provisão',
    html: layout(`
      <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:${COR_TEXTO};">Olá, ${nome}.</p>
      <p style="margin:0;font-size:16px;line-height:24px;color:${COR_TEXTO};">
        Recebemos um pedido para redefinir a senha da sua conta. Se foi você,
        use o botão abaixo. Sua senha atual continua valendo até você escolher
        uma nova.
      </p>
      ${botao(url, 'Escolher nova senha')}
      <p style="margin:16px 0 0;font-size:13px;color:${COR_APAGADA};">O link vale por 1 hora e só pode ser usado uma vez.</p>
    `),
    texto: `Olá, ${nome}.

Recebemos um pedido para redefinir a senha da sua conta no Provisão. Se foi
você, abra o endereço abaixo. Sua senha atual continua valendo até você
escolher uma nova.

${url}

O link vale por 1 hora e só pode ser usado uma vez.

Se você não pediu isso, ignore este e-mail: sem abrir o link, nada muda.`,
  }
}

type ContextoSuporte = {
  usuario: { id: string; nome: string; email: string }
  mensagem: string
  tela?: string
  navegador?: string
}

/**
 * E-mail de suporte. Vai para a equipe, nao para o usuario - por isso e o unico
 * template que carrega dado tecnico.
 *
 * O contexto vem junto porque sem ele metade dos relatos chega como "deu erro" e
 * vira uma ida e volta so para descobrir onde a pessoa estava.
 */
export function emailDeSuporte({ usuario, mensagem, tela, navegador }: ContextoSuporte) {
  const linhas = [
    `De: ${usuario.nome} <${usuario.email}>`,
    `Usuario: ${usuario.id}`,
    tela ? `Tela: ${tela}` : null,
    navegador ? `Navegador: ${navegador}` : null,
  ].filter(Boolean) as string[]

  return {
    assunto: `[Suporte] ${usuario.email}`,
    html: layout(`
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${COR_TEXTO};white-space:pre-wrap;">${escapaHtml(mensagem)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;">
      <p style="margin:0;font-size:12px;line-height:20px;color:${COR_APAGADA};">
        ${linhas.map(escapaHtml).join('<br>')}
      </p>
    `),
    texto: `${mensagem}\n\n---\n${linhas.join('\n')}`,
  }
}

/**
 * A mensagem vem do usuario e entra num HTML. Sem escapar, quem escrevesse
 * `<img src=x onerror=...>` teria o codigo executado no cliente de e-mail de
 * quem le o chamado - e quem le e sempre a equipe.
 */
function escapaHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type AcessoNovo = {
  nome: string
  quando: Date
  dispositivo: string
  ip?: string | null
  urlSeguranca: string
}

/**
 * Aviso de acesso a partir de um dispositivo desconhecido.
 *
 * O tom evita alarme: na maioria das vezes e a propria pessoa num aparelho
 * novo, e um e-mail assustador para um evento comum treina a ignorar o alerta
 * - justamente o que nao pode acontecer com este.
 *
 * O que importa e ser acionavel: se nao foi ela, precisa saber o que fazer sem
 * ter de descobrir sozinha.
 */
export function emailDeAcessoNovo({ nome, quando, dispositivo, ip, urlSeguranca }: AcessoNovo) {
  const data = quando.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  const detalhes = [`Quando: ${data}`, `Dispositivo: ${dispositivo}`, ip ? `IP: ${ip}` : null].filter(
    Boolean,
  ) as string[]

  return {
    assunto: 'Novo acesso à sua conta do Provisão',
    html: layout(`
      <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:${COR_TEXTO};">Olá, ${nome}.</p>
      <p style="margin:0;font-size:16px;line-height:24px;color:${COR_TEXTO};">
        Sua conta foi acessada de um dispositivo que ainda não tínhamos visto.
        Se foi você, não precisa fazer nada.
      </p>
      <div style="margin:20px 0;padding:14px 16px;background:#f7e7d8;border-radius:8px;font-size:13px;line-height:22px;color:${COR_TEXTO};">
        ${detalhes.join('<br>')}
      </div>
      <p style="margin:0;font-size:16px;line-height:24px;color:${COR_TEXTO};">
        <strong>Se não foi você</strong>, troque sua senha agora. Isso encerra
        todas as outras sessões, inclusive a de quem entrou.
      </p>
      ${botao(urlSeguranca, 'Trocar minha senha')}
    `),
    texto: `Olá, ${nome}.

Sua conta do Provisão foi acessada de um dispositivo que ainda não tínhamos
visto. Se foi você, não precisa fazer nada.

${detalhes.join('\n')}

Se não foi você, troque sua senha agora. Isso encerra todas as outras sessões,
inclusive a de quem entrou:

${urlSeguranca}`,
  }
}

/**
 * Resume o user-agent em algo legivel. Nao e deteccao precisa de navegador, e
 * nao precisa ser: a pessoa so precisa reconhecer "fui eu no meu celular" ou
 * estranhar "isso nao e meu".
 */
export function descreveDispositivo(userAgent?: string | null): string {
  if (!userAgent) return 'dispositivo desconhecido'

  const navegador =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'navegador desconhecido'

  const sistema =
    /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iOS/.test(userAgent) ? 'iPhone ou iPad'
    : /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS X|Macintosh/.test(userAgent) ? 'Mac'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'sistema desconhecido'

  return `${navegador} em ${sistema}`
}
