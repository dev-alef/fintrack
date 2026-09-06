import { describe, it, expect } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { CABECALHO_IP, ipDoCliente, montaFaixas, resolveIpDoCliente, type Faixas } from '../ip-cliente'

// Recorte do que existe em producao: as faixas da Cloudflare (que fica na
// frente do Render), a rede interna do Render, e o IP de saida da Vercel.
const faixas: Faixas = {
  confiaveis: montaFaixas('104.16.0.0/13,172.64.0.0/13,10.0.0.0/8', 'TRUSTED_PROXIES'),
  vercel: montaFaixas('54.20.54.113', 'VERCEL_PROXY_IPS'),
}

const CLIENTE = '187.55.10.20'
const ATACANTE = '203.0.113.77'
const CLOUDFLARE = '104.16.5.9'
const RENDER = '10.201.4.3'
const VERCEL = '54.20.54.113'

describe('Resolucao do IP do cliente', () => {
  it('pelo proxy da Vercel, usa o cabecalho dela', () => {
    const ip = resolveIpDoCliente(
      {
        'x-forwarded-for': `${CLIENTE}, ${VERCEL}, ${CLOUDFLARE}, ${RENDER}`,
        'x-vercel-forwarded-for': CLIENTE,
      },
      faixas,
    )

    expect(ip).toBe(CLIENTE)
  })

  it('batendo direto no Render, o cabecalho da Vercel forjado e ignorado', () => {
    // Este e o buraco que a correcao fecha. O endereco do Render esta num
    // repositorio publico, entao qualquer um chega nele sem passar pela Vercel;
    // mandando um x-vercel-forwarded-for diferente a cada tentativa, ganhava um
    // balde de rate limiting novo toda vez e tentava senhas sem limite.
    const ip = resolveIpDoCliente(
      {
        'x-forwarded-for': `${ATACANTE}, ${CLOUDFLARE}, ${RENDER}`,
        'x-vercel-forwarded-for': '1.2.3.4',
      },
      faixas,
    )

    expect(ip).toBe(ATACANTE)
  })

  it('trocar o cabecalho forjado nao muda o balde', () => {
    // O que torna a forca bruta possivel nao e escapar uma vez, e escapar
    // sempre: cada valor novo virava uma contagem nova. Duas tentativas com
    // cabecalhos diferentes precisam cair no mesmo IP.
    const cadeia = `${ATACANTE}, ${CLOUDFLARE}, ${RENDER}`
    const primeira = resolveIpDoCliente(
      { 'x-forwarded-for': cadeia, 'x-vercel-forwarded-for': '1.2.3.4' },
      faixas,
    )
    const segunda = resolveIpDoCliente(
      { 'x-forwarded-for': cadeia, 'x-vercel-forwarded-for': '5.6.7.8' },
      faixas,
    )

    expect(primeira).toBe(segunda)
    expect(primeira).toBe(ATACANTE)
  })

  it('saltos forjados a esquerda nunca sao alcancados', () => {
    // O cliente escreve na esquerda da cadeia; a infraestrutura acrescenta na
    // direita. Ler da direita para a esquerda e o que torna a parte inventada
    // irrelevante - a leitura para antes de chegar nela.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `9.9.9.9, 8.8.8.8, ${ATACANTE}, ${CLOUDFLARE}, ${RENDER}` },
      faixas,
    )

    expect(ip).toBe(ATACANTE)
  })

  it('nao aceita o cabecalho da Vercel sem a Vercel na cadeia', () => {
    // Sem nenhum proxy conhecido no caminho nao ha o que comprovar a origem, e
    // o cabecalho sozinho nao vale - e exatamente ele que o atacante controla.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': ATACANTE, 'x-vercel-forwarded-for': '1.2.3.4' },
      faixas,
    )

    expect(ip).toBe(ATACANTE)
  })

  it('cadeia so de proxies conhecidos nao inventa um cliente', () => {
    // Preferimos o balde compartilhado, que e restritivo demais, a devolver um
    // endereco de infraestrutura como se fosse gente.
    const ip = resolveIpDoCliente({ 'x-forwarded-for': `${CLOUDFLARE}, ${RENDER}` }, faixas)

    expect(ip).toBeNull()
  })

  it('sem cadeia nenhuma nao ha o que resolver', () => {
    expect(resolveIpDoCliente({}, faixas)).toBeNull()
    expect(resolveIpDoCliente({ 'x-vercel-forwarded-for': CLIENTE }, faixas)).toBeNull()
  })

  it('endereco ilegivel na cadeia invalida a leitura inteira', () => {
    // Sem saber quantos saltos ha, nao da para saber onde o trecho confiavel
    // termina. Adivinhar aqui seria aceitar um valor escolhido por quem chamou.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `${CLIENTE}, nao-e-um-ip, ${CLOUDFLARE}, ${RENDER}` },
      faixas,
    )

    expect(ip).toBeNull()
  })

  it('IPv4 embrulhado em IPv6 e o mesmo endereco', () => {
    // Sem normalizar, ::ffff:187.55.10.20 e 187.55.10.20 seriam dois baldes
    // para a mesma pessoa - e meia cota extra para quem soubesse alternar.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `::ffff:${CLIENTE}, ${CLOUDFLARE}, ${RENDER}` },
      faixas,
    )

    expect(ip).toBe(CLIENTE)
  })

  it('sem VERCEL_PROXY_IPS o proxy vira um balde so, mas nao um buraco', () => {
    // O IP de saida da Vercel nao e publicado e pode mudar. Quando isso
    // acontecer, todo mundo que passa pelo proxy divide um balde - incomodo,
    // e o lado certo de errar. O que nao pode e voltar a confiar no cabecalho.
    const semVercel: Faixas = { confiaveis: faixas.confiaveis, vercel: montaFaixas('', 'vazio') }

    const ip = resolveIpDoCliente(
      {
        'x-forwarded-for': `${CLIENTE}, ${VERCEL}, ${CLOUDFLARE}, ${RENDER}`,
        'x-vercel-forwarded-for': '1.2.3.4',
      },
      semVercel,
    )

    expect(ip).toBe(VERCEL)
  })

  it('o cabecalho interno mandado de fora e descartado', () => {
    // A defesa toda depende disto. Se o middleware apenas preenchesse quando
    // esta vazio, bastaria mandar x-provisao-client-ip pronto para escolher o
    // proprio balde - o mesmo buraco, com outro nome de cabecalho.
    const req = {
      headers: {
        [CABECALHO_IP]: '1.2.3.4',
        'x-forwarded-for': `${ATACANTE}, ${CLOUDFLARE}, ${RENDER}`,
      },
    } as unknown as Request

    let seguiu = false
    ipDoCliente(faixas)(req, {} as Response, (() => {
      seguiu = true
    }) as NextFunction)

    expect(seguiu).toBe(true)
    expect(req.headers[CABECALHO_IP]).toBe(ATACANTE)
  })

  it('sem IP confiavel o cabecalho interno some, em vez de sobrar o de fora', () => {
    const req = {
      headers: { [CABECALHO_IP]: '1.2.3.4' },
    } as unknown as Request

    ipDoCliente(faixas)(req, {} as Response, (() => {}) as NextFunction)

    expect(req.headers[CABECALHO_IP]).toBeUndefined()
  })

  it('CIDR invalido e descartado, nao vira faixa que aceita todo mundo', () => {
    // Um erro de digitacao no painel do Render nao pode transformar a lista de
    // confianca em "confio em qualquer um".
    const quebrada: Faixas = {
      confiaveis: montaFaixas('nao/e/cidr,999.1.1.1/8,10.0.0.0/8', 'TRUSTED_PROXIES'),
      vercel: montaFaixas('', 'vazio'),
    }

    expect(resolveIpDoCliente({ 'x-forwarded-for': `${ATACANTE}, ${RENDER}` }, quebrada)).toBe(
      ATACANTE,
    )
  })
})
