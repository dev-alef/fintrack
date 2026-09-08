/**
 * Descobre o IP de quem chamou, e so devolve um valor em que da para confiar.
 *
 * # De onde vem a confianca
 *
 * O `x-forwarded-for` e montado salto a salto: cada proxy acrescenta a DIREITA
 * o endereco de quem falou com ele. O que o cliente escreve fica sempre a
 * ESQUERDA, e ele nao alcanca o resto. Por isso a leitura e da direita para a
 * esquerda, pulando os saltos conhecidos (TRUSTED_PROXIES: faixas da Cloudflare,
 * que fica na frente do Render, e a rede interna do Render), ate o primeiro
 * desconhecido. Esse e o cliente, e nao ha como falsifica-lo:
 *
 *   [forjado, forjado, IP-REAL, cloudflare, rede-do-render]
 *                         ^ primeiro desconhecido - e este
 *    \____ nunca alcancados ____/
 *
 * O resultado vai para um cabecalho proprio, que o middleware sempre reescreve.
 * O Better Auth le so esse - um `x-provisao-client-ip` mandado de fora e
 * descartado antes de qualquer coisa ler.
 *
 * # Por que o x-vercel-forwarded-for nao e usado
 *
 * Pelo proxy da Vercel esse cabecalho traz o IP real do cliente num valor
 * unico, e e tentador: sem ele, todo mundo que passa pelo proxy resolve para o
 * IP de SAIDA da Vercel e divide balde de rate limiting.
 *
 * A tentacao custou um bug. A versao anterior confiava no cabecalho quando
 * reconhecia um IP de saida da Vercel na cadeia (VERCEL_PROXY_IPS). Mas esse IP
 * prova "veio da rede da Vercel", nao "veio pelo rewrite do NOSSO projeto" - e
 * so a segunda afirmacao justifica confiar no cabecalho.
 *
 * A diferenca importa porque os IPs de saida sao compartilhados entre clientes
 * da Vercel. Qualquer um com conta gratuita sobe uma funcao que faz fetch para
 * esta API escolhendo os proprios cabecalhos: a Vercel sobrescreve o
 * x-vercel-forwarded-for na ENTRADA, em requisicao que chega no deployment, mas
 * nao no fetch de SAIDA do codigo do cliente. A requisicao sairia por um IP da
 * lista, com o cabecalho forjado, e o bypass voltaria inteiro.
 *
 * Pode ser que a Vercel separe o egress dos rewrites do egress das funcoes. Nao
 * ha documentacao publica disso, e nao da para apoiar uma fronteira de seguranca
 * em topologia de terceiro que ninguem verifica e que muda sem aviso.
 *
 * O preco de nao usar e um limite por IP mais grosseiro pelo proxy. Quem cobre
 * isso e o limite por conta (limite-por-conta.ts), que nao depende de IP nenhum.
 */
import { BlockList, isIPv4, isIPv6 } from 'node:net'
import type { NextFunction, Request, Response } from 'express'

/** Onde o middleware publica o resultado, e o unico lugar de onde o auth le. */
export const CABECALHO_IP = 'x-provisao-client-ip'

const CABECALHO_CADEIA = 'x-forwarded-for'

function itens(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** `::ffff:1.2.3.4` e o mesmo endereco que `1.2.3.4`, escrito de outro jeito. */
function normaliza(ip: string): string {
  const semPrefixo = ip.replace(/^::ffff:/i, '')
  return isIPv4(semPrefixo) ? semPrefixo : ip.toLowerCase()
}

/**
 * Monta a lista de faixas confiaveis. Entrada invalida e ignorada com aviso,
 * nunca tratada como faixa vazia que combina com tudo: um CIDR com erro de
 * digitacao passaria a confiar no mundo inteiro.
 */
export function montaFaixas(valor: string | undefined, rotulo: string): BlockList {
  const bloco = new BlockList()
  const entradas = itens(valor)

  // O aviso diz a POSICAO da entrada, nunca o conteudo dela.
  //
  // Nao porque uma faixa de IP seja segredo - nao e, sao ranges publicos da
  // Cloudflare. E porque despejar variavel de ambiente no log e o habito que um
  // dia despeja a errada, e do lado destas moram BETTER_AUTH_SECRET e a chave
  // do Resend. Log de producao e lido por quem opera, indexado por quem coleta,
  // e nao da para despublicar. Contar virgulas ate a terceira entrada custa dez
  // segundos; tirar um segredo de todo lugar onde o log ja passou custa um dia.
  const avisa = (posicao: number) =>
    console.warn(`[ip] ${rotulo}: entrada ${posicao} ignorada, nao e IP nem CIDR valido`)

  for (let i = 0; i < entradas.length; i++) {
    const entrada = entradas[i]!
    const [endereco, prefixo] = entrada.split('/')
    const tipo = isIPv4(endereco ?? '') ? 'ipv4' : isIPv6(endereco ?? '') ? 'ipv6' : null

    if (!endereco || !tipo) {
      avisa(i + 1)
      continue
    }

    try {
      if (prefixo === undefined) bloco.addAddress(endereco, tipo)
      else bloco.addSubnet(endereco, Number(prefixo), tipo)
    } catch {
      avisa(i + 1)
    }
  }

  return bloco
}

function contem(bloco: BlockList, ip: string): boolean {
  const tipo = isIPv4(ip) ? 'ipv4' : isIPv6(ip) ? 'ipv6' : null
  if (!tipo) return false
  return bloco.check(ip, tipo)
}

function valorDe(cabecalhos: Record<string, unknown>, nome: string): string | null {
  const bruto = cabecalhos[nome]
  if (typeof bruto === 'string') return bruto
  // Cabecalho repetido chega como lista. O Node ja junta o x-forwarded-for numa
  // string so, mas nao ha garantia disso para todo cabecalho.
  if (Array.isArray(bruto) && typeof bruto[0] === 'string') return bruto.join(',')
  return null
}

/**
 * Percorre a cadeia da direita para a esquerda e devolve o primeiro endereco
 * que nao veio da nossa infraestrutura. `null` quando nao da para afirmar nada -
 * o Better Auth entao cai num balde compartilhado, que e restritivo demais mas
 * nunca permissivo demais.
 */
export function resolveIpDoCliente(
  cabecalhos: Record<string, unknown>,
  confiaveis: BlockList,
): string | null {
  const cadeia = valorDe(cabecalhos, CABECALHO_CADEIA)
  if (!cadeia) return null

  const saltos = itens(cadeia).map(normaliza)

  for (let i = saltos.length - 1; i >= 0; i--) {
    const salto = saltos[i]!

    // Um endereco ilegivel no meio da cadeia quebra a contagem de saltos, e a
    // partir dali nao da para saber onde o trecho confiavel termina.
    if (!isIPv4(salto) && !isIPv6(salto)) return null

    if (contem(confiaveis, salto)) continue

    return salto
  }

  // Cadeia inteira conhecida: nao sobrou nenhum cliente para apontar.
  return null
}

/**
 * Middleware. Precisa vir antes do handler do Better Auth, e reescreve o
 * cabecalho sempre - inclusive apagando quando nao ha resposta confiavel.
 */
export function ipDoCliente(confiaveis: BlockList) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Apagar primeiro, sem excecao: e isto que impede alguem de simplesmente
    // mandar o cabecalho pronto e escolher o proprio balde.
    delete req.headers[CABECALHO_IP]

    const ip = resolveIpDoCliente(req.headers as Record<string, unknown>, confiaveis)
    if (ip) req.headers[CABECALHO_IP] = ip

    next()
  }
}

/** Faixas lidas do ambiente, montadas uma vez no boot. */
export const proxiesConfiaveis = montaFaixas(process.env.TRUSTED_PROXIES, 'TRUSTED_PROXIES')
