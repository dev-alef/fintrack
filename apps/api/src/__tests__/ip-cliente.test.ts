import { describe, it, expect } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { CABECALHO_IP, ipDoCliente, montaFaixas, resolveIpDoCliente } from '../ip-cliente'

// Recorte do que existe em producao: as faixas da Cloudflare (que fica na
// frente do Render) e a rede interna do Render.
const confiaveis = montaFaixas('104.16.0.0/13,172.64.0.0/13,10.0.0.0/8', 'TRUSTED_PROXIES')

const CLIENTE = '187.55.10.20'
const ATACANTE = '203.0.113.77'
const CLOUDFLARE = '104.16.5.9'
const RENDER = '10.201.4.3'

describe('Resolucao do IP do cliente', () => {
  it('cliente legitimo pelo caminho normal: cliente, cloudflare, render', () => {
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `${CLIENTE}, ${CLOUDFLARE}, ${RENDER}` },
      confiaveis,
    )

    expect(ip).toBe(CLIENTE)
  })

  it('batendo direto no Render, o IP real do atacante e o que sobra', () => {
    // Este e o buraco que a correcao fecha. O endereco do Render esta num
    // repositorio publico, entao qualquer um chega nele direto - sem passar
    // por proxy nenhum que a gente conheca.
    const ip = resolveIpDoCliente({ 'x-forwarded-for': `${ATACANTE}, ${RENDER}` }, confiaveis)

    expect(ip).toBe(ATACANTE)
  })

  it('cabecalho inventado nao muda o resultado', () => {
    // Este e o motivo de x-vercel-forwarded-for ter deixado de ser usado: o
    // atacante controla qualquer cabecalho que ele mesmo manda. So a cadeia do
    // x-forwarded-for, construida salto a salto pela infraestrutura de
    // verdade, decide - e por isso as duas chamadas abaixo dao o mesmo IP
    // mesmo com um "cabecalho da vercel" fantasia diferente em cada uma.
    const cadeia = `${ATACANTE}, ${CLOUDFLARE}, ${RENDER}`
    const primeira = resolveIpDoCliente(
      { 'x-forwarded-for': cadeia, 'x-vercel-forwarded-for': '1.2.3.4' },
      confiaveis,
    )
    const segunda = resolveIpDoCliente(
      { 'x-forwarded-for': cadeia, 'x-vercel-forwarded-for': '5.6.7.8' },
      confiaveis,
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
      confiaveis,
    )

    expect(ip).toBe(ATACANTE)
  })

  it('cadeia so de proxies conhecidos nao inventa um cliente', () => {
    // Preferimos o balde compartilhado, que e restritivo demais, a devolver um
    // endereco de infraestrutura como se fosse gente.
    const ip = resolveIpDoCliente({ 'x-forwarded-for': `${CLOUDFLARE}, ${RENDER}` }, confiaveis)

    expect(ip).toBeNull()
  })

  it('sem cadeia nenhuma nao ha o que resolver', () => {
    expect(resolveIpDoCliente({}, confiaveis)).toBeNull()
  })

  it('endereco ilegivel na cadeia invalida a leitura inteira', () => {
    // Sem saber quantos saltos ha, nao da para saber onde o trecho confiavel
    // termina. Adivinhar aqui seria aceitar um valor escolhido por quem chamou.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `${CLIENTE}, nao-e-um-ip, ${CLOUDFLARE}, ${RENDER}` },
      confiaveis,
    )

    expect(ip).toBeNull()
  })

  it('IPv4 embrulhado em IPv6 e o mesmo endereco', () => {
    // Sem normalizar, ::ffff:187.55.10.20 e 187.55.10.20 seriam dois baldes
    // para a mesma pessoa - e meia cota extra para quem soubesse alternar.
    const ip = resolveIpDoCliente(
      { 'x-forwarded-for': `::ffff:${CLIENTE}, ${CLOUDFLARE}, ${RENDER}` },
      confiaveis,
    )

    expect(ip).toBe(CLIENTE)
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
    ipDoCliente(confiaveis)(req, {} as Response, (() => {
      seguiu = true
    }) as NextFunction)

    expect(seguiu).toBe(true)
    expect(req.headers[CABECALHO_IP]).toBe(ATACANTE)
  })

  it('sem IP confiavel o cabecalho interno some, em vez de sobrar o de fora', () => {
    const req = {
      headers: { [CABECALHO_IP]: '1.2.3.4' },
    } as unknown as Request

    ipDoCliente(confiaveis)(req, {} as Response, (() => {}) as NextFunction)

    expect(req.headers[CABECALHO_IP]).toBeUndefined()
  })

  it('CIDR invalido e descartado, nao vira faixa que aceita todo mundo', () => {
    // Um erro de digitacao no painel do Render nao pode transformar a lista de
    // confianca em "confio em qualquer um".
    const quebrada = montaFaixas('nao/e/cidr,999.1.1.1/8,10.0.0.0/8', 'TRUSTED_PROXIES')

    expect(resolveIpDoCliente({ 'x-forwarded-for': `${ATACANTE}, ${RENDER}` }, quebrada)).toBe(
      ATACANTE,
    )
  })
})
