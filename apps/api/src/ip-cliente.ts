/**
 * Descobre o IP de quem chamou, e so devolve um valor em que da para confiar.
 *
 * # O buraco que isto fecha
 *
 * O rate limiting do Better Auth conta tentativas por IP. Ate aqui o IP saia de
 * `IP_ADDRESS_HEADERS=x-vercel-forwarded-for,x-forwarded-for`: o cabecalho da
 * Vercel primeiro, porque pelo proxy ele e o unico que traz o cliente real num
 * valor unico.
 *
 * So que a API no Render tambem atende conexao direta, e o endereco dela esta
 * em `apps/web/vercel.json`, num repositorio publico. Quem batesse direto podia
 * mandar `x-vercel-forwarded-for: 1.2.3.4`, trocar o numero a cada tentativa e
 * ganhar um balde novo toda vez - forca bruta sem limite nenhum. O cabecalho e
 * confiavel *pelo proxy*, onde a Vercel o sobrescreve, e forjavel fora dele.
 * A Vercel nao assina nada, entao o cabecalho sozinho nao prova de onde veio.
 *
 * # Como isto resolve
 *
 * A prova nao esta no cabecalho, esta na cadeia. `x-forwarded-for` e montado
 * salto a salto: cada proxy acrescenta o endereco de quem falou com ele. O que
 * o cliente escreve fica sempre a ESQUERDA; o que a infraestrutura acrescenta
 * fica a direita e ele nao alcanca. Por isso a leitura e da direita para a
 * esquerda, pulando os saltos conhecidos, ate o primeiro desconhecido - esse e
 * o cliente, e nao ha como falsifica-lo.
 *
 * Se pelo caminho aparecer um IP de saida da Vercel (VERCEL_PROXY_IPS), entao a
 * requisicao passou pelo nosso proxy de verdade, e so ai o cabecalho dela vale.
 *
 *   Pelo proxy:  [cliente, saidaDaVercel, cloudflare, rede-do-render]
 *                                ^ reconhecido -> confia no cabecalho da Vercel
 *
 *   Direto:      [forjado, forjado, IP-REAL-DO-ATACANTE, cloudflare, ...]
 *                                          ^ primeiro desconhecido -> e este
 *                 \______ nunca alcancados ______/
 *
 * O resultado vai para um cabecalho proprio, que o middleware sempre reescreve.
 * O Better Auth le so esse - se alguem mandar um `x-provisao-client-ip` de
 * fora, ele e descartado antes de qualquer coisa ler.
 *
 * # Por que a lista de cabecalhos saiu do ambiente
 *
 * `IP_ADDRESS_HEADERS` nao e lido mais. Era configuracao, mas define uma
 * fronteira de confianca: um valor esquecido no painel do Render reabriria o
 * buraco em silencio, e ninguem repara numa variavel que continua funcionando.
 * As faixas de IP seguem no ambiente, porque sao dados que mudam sem deploy.
 */
import { BlockList, isIPv4, isIPv6 } from 'node:net'
import type { NextFunction, Request, Response } from 'express'

/** Onde o middleware publica o resultado, e o unico lugar de onde o auth le. */
export const CABECALHO_IP = 'x-provisao-client-ip'

const CABECALHO_VERCEL = 'x-vercel-forwarded-for'
const CABECALHO_CADEIA = 'x-forwarded-for'

export type Faixas = {
  /** Proxies entre a internet e este processo: Cloudflare, rede do Render. */
  confiaveis: BlockList
  /** IPs de saida do proxy da Vercel - o nosso front encaminhando. */
  vercel: BlockList
}

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
 * Monta a lista de faixas. Entrada invalida e ignorada com aviso, nunca tratada
 * como faixa vazia que combina com tudo: um CIDR com erro de digitacao passaria
 * a confiar no mundo inteiro.
 */
export function montaFaixas(valor: string | undefined, rotulo: string): BlockList {
  const bloco = new BlockList()

  for (const entrada of itens(valor)) {
    const [endereco, prefixo] = entrada.split('/')
    const tipo = isIPv4(endereco ?? '') ? 'ipv4' : isIPv6(endereco ?? '') ? 'ipv6' : null

    if (!endereco || !tipo) {
      console.warn(`[ip] entrada invalida em ${rotulo}, ignorada: ${entrada}`)
      continue
    }

    try {
      if (prefixo === undefined) bloco.addAddress(endereco, tipo)
      else bloco.addSubnet(endereco, Number(prefixo), tipo)
    } catch {
      console.warn(`[ip] entrada invalida em ${rotulo}, ignorada: ${entrada}`)
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
  faixas: Faixas,
): string | null {
  const cadeia = valorDe(cabecalhos, CABECALHO_CADEIA)
  if (!cadeia) return null

  const saltos = itens(cadeia).map(normaliza)
  if (saltos.length === 0) return null

  const doVercel = () => {
    const valor = valorDe(cabecalhos, CABECALHO_VERCEL)
    if (!valor) return null
    // A Vercel manda um valor unico. Uma lista aqui significa que o cabecalho
    // nao veio dela, e nao ha como escolher entre os valores com seguranca.
    const unico = itens(valor)
    if (unico.length !== 1) return null
    const ip = normaliza(unico[0]!)
    return isIPv4(ip) || isIPv6(ip) ? ip : null
  }

  let passouPelaVercel = false

  for (let i = saltos.length - 1; i >= 0; i--) {
    const salto = saltos[i]!

    // Um endereco ilegivel no meio da cadeia quebra a contagem de saltos, e a
    // partir dali nao da para saber onde o trecho confiavel termina.
    if (!isIPv4(salto) && !isIPv6(salto)) return null

    if (contem(faixas.vercel, salto)) {
      passouPelaVercel = true
      continue
    }
    if (contem(faixas.confiaveis, salto)) continue

    // Primeiro salto desconhecido: e o cliente. Pelo proxy, a Vercel ja escreveu
    // aqui o endereco real, e o cabecalho dela diz o mesmo - preferimos o
    // cabecalho porque e o valor que ela mantem explicitamente.
    return passouPelaVercel ? (doVercel() ?? salto) : salto
  }

  // Cadeia inteira conhecida: nao sobrou nenhum cliente para apontar.
  return passouPelaVercel ? doVercel() : null
}

/**
 * Middleware. Precisa vir antes do handler do Better Auth, e reescreve o
 * cabecalho sempre - inclusive apagando quando nao ha resposta confiavel.
 */
export function ipDoCliente(faixas: Faixas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Apagar primeiro, sem excecao: e isto que impede alguem de simplesmente
    // mandar o cabecalho pronto e escolher o proprio balde.
    delete req.headers[CABECALHO_IP]

    const ip = resolveIpDoCliente(req.headers as Record<string, unknown>, faixas)
    if (ip) req.headers[CABECALHO_IP] = ip

    next()
  }
}

/** Faixas lidas do ambiente, montadas uma vez no boot. */
export const faixasDoAmbiente: Faixas = {
  confiaveis: montaFaixas(process.env.TRUSTED_PROXIES, 'TRUSTED_PROXIES'),
  vercel: montaFaixas(process.env.VERCEL_PROXY_IPS, 'VERCEL_PROXY_IPS'),
}
