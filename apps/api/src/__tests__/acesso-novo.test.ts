import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import * as email from '../email'
import { descreveDispositivo } from '../emails/templates'

const ORIGEM = 'http://localhost:5173'
const CELULAR =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const NOTEBOOK =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

let enviados: { para: string; assunto: string; texto: string }[] = []

beforeEach(() => {
  enviados = []
  vi.spyOn(email, 'enviarEmail').mockImplementation(async (msg) => {
    enviados.push({ para: msg.para, assunto: msg.assunto, texto: msg.texto })
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const avisos = () => enviados.filter((e) => e.assunto.includes('Novo acesso'))

/** O aviso e disparado sem await no gancho; sem esta pausa o teste corre antes. */
const respira = () => new Promise((r) => setTimeout(r, 300))

async function criaConta(userAgent: string) {
  const usuario = {
    name: 'Alef Ferreira',
    email: `acesso_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@teste.com`,
    password: 'senhaDeTeste123',
  }
  await request(app).post('/api/auth/sign-up/email').set('User-Agent', userAgent).send(usuario)
  await respira()
  enviados = []
  return usuario
}

async function entra(usuario: { email: string; password: string }, userAgent: string) {
  const res = await request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGEM)
    .set('User-Agent', userAgent)
    .send({ email: usuario.email, password: usuario.password })
  await respira()
  return res
}

describe('Aviso de acesso novo', () => {
  it('nao avisa quando o dispositivo ja e conhecido', async () => {
    const usuario = await criaConta(NOTEBOOK)

    await entra(usuario, NOTEBOOK)

    // Este e o teste que decide se a funcionalidade e util ou vira ruido. Um
    // aviso a cada login treina a pessoa a arquivar sem ler - e ai o alerta que
    // importa chega no meio do ruido que nos mesmos criamos.
    expect(avisos()).toHaveLength(0)
  })

  it('avisa quando o acesso vem de um dispositivo desconhecido', async () => {
    const usuario = await criaConta(NOTEBOOK)

    await entra(usuario, CELULAR)

    expect(avisos()).toHaveLength(1)
    expect(avisos()[0].para).toBe(usuario.email)
    // Sem saber QUAL dispositivo, a pessoa nao consegue decidir se foi ela.
    expect(avisos()[0].texto).toContain('iPhone')
    // E precisa do caminho de saida, nao so do susto.
    expect(avisos()[0].texto).toContain('/esqueci-senha')
  })

  it('avisa uma vez so por dispositivo novo', async () => {
    const usuario = await criaConta(NOTEBOOK)

    await entra(usuario, CELULAR)
    enviados = []
    await entra(usuario, CELULAR)

    // Depois do primeiro acesso o celular passou a ser conhecido. Sem isso, um
    // aparelho usado todo dia geraria um e-mail por dia.
    expect(avisos()).toHaveLength(0)
  })

  it('atualizar o navegador nao conta como dispositivo novo', async () => {
    const usuario = await criaConta(NOTEBOOK)

    // Mesmo aparelho, Chrome atualizado de 120 para 121.
    await entra(usuario, NOTEBOOK.replace('Chrome/120.0', 'Chrome/121.0'))

    // Sem ignorar os numeros do user-agent, cada atualizacao do navegador ou
    // do sistema viraria alerta de invasao. Um falso positivo a cada poucas
    // semanas e o caminho mais curto para a pessoa parar de ler o aviso.
    expect(avisos()).toHaveLength(0)
  })

  it('descreve o dispositivo de forma reconhecivel', () => {
    expect(descreveDispositivo(CELULAR)).toBe('Safari em iPhone ou iPad')
    expect(descreveDispositivo(NOTEBOOK)).toBe('Chrome em Windows')
    // Sem user-agent nao da para inventar: dizer "Chrome no Windows" para quem
    // usa outra coisa faria a pessoa achar que foi invadida.
    expect(descreveDispositivo(null)).toBe('dispositivo desconhecido')
  })
})
