import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'

// DEBUG_IP e lido quando o modulo carrega, entao cada cenario reimporta a
// aplicacao com o ambiente ja ajustado.
async function carregaApp(): Promise<Express> {
  vi.resetModules()
  const { default: app } = await import('../index')
  return app as Express
}

const ambienteOriginal = { ...process.env }

beforeEach(() => {
  // Vazio em vez de `delete`: o index.ts importa 'dotenv/config', que roda de
  // novo a cada resetModules e repovoa a partir do .env qualquer chave ausente.
  process.env.DEBUG_IP = ''
})

afterAll(() => {
  process.env = { ...ambienteOriginal }
})

describe('/health', () => {
  it('responde ok sem expor a topologia da rede', async () => {
    const app = await carregaApp()

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    // O diagnostico revela por quais proxies a requisicao passou. Util para
    // configurar TRUSTED_PROXIES, mas nao e coisa para ficar publica por
    // padrao - e o padrao e o que roda em producao no dia a dia.
    expect(res.body.diagnosticoIp).toBeUndefined()
  })

  it('com DEBUG_IP=1 mostra a cadeia de proxies', async () => {
    process.env.DEBUG_IP = '1'
    const app = await carregaApp()

    const res = await request(app)
      .get('/health')
      .set('x-forwarded-for', '203.0.113.10, 198.51.100.7')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    // E a cadeia crua que interessa: e dela que sai a decisao de quais saltos
    // entram em TRUSTED_PROXIES.
    expect(res.body.diagnosticoIp['x-forwarded-for']).toBe('203.0.113.10, 198.51.100.7')
  })
})
