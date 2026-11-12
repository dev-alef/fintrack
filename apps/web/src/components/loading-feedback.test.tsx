// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import { LoadingState } from './loading-state'
import { LoadingActivity } from './loading-activity'
import Login from '@/pages/Login'

const auth = vi.hoisted(() => ({ email: vi.fn(), social: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ signIn: { email: auth.email, social: auth.social }, signUp: { email: vi.fn() } }))
let container: HTMLDivElement, root: Root, client: QueryClient
beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  container.remove()
  localStorage.clear()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
async function mount(content: ReactNode) {
  await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ThemeProvider><QueryClientProvider client={client}>{content}</QueryClientProvider></ThemeProvider></MemoryRouter>))
}
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
async function fill(selector: string, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(selector)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const text = () => container.textContent ?? ''

it('explica a demora depois de oito segundos e mantém o status acessível', async () => {
  await mount(<LoadingState title="Preparando acesso…" description="Conectando…" slowMessage="O servidor pode estar iniciando." />)
  expect(container.querySelector('[role="status"]')?.textContent).toContain('Conectando')
  await tick(7999)
  expect(text()).not.toContain('O servidor pode estar iniciando')
  await tick(1)
  expect(text()).toContain('O servidor pode estar iniciando')
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite')
})

it('não pisca em requisições rápidas e mantém o indicador até a última consulta terminar', async () => {
  await mount(<><input aria-label="Continua editável" /><LoadingActivity /></>)
  let done!: () => void, fail!: (error: Error) => void
  let first!: Promise<unknown>, second!: Promise<unknown>
  await act(async () => {
    first = client.fetchQuery({ queryKey: ['first'], queryFn: () => new Promise((_resolve, reject) => { fail = reject }) }).catch(() => {})
    second = client.fetchQuery({ queryKey: ['second'], queryFn: () => new Promise<void>(resolve => { done = resolve }) }).catch(() => {})
  })
  await tick(0)
  await tick(200)
  expect(container.querySelector('[role="status"]')).toBeNull()
  await tick(200)
  expect(text()).toContain('Carregando dados')
  expect(container.querySelector('input')?.disabled).toBe(false)
  await act(async () => { fail(new Error('offline')); await first })
  await tick(0)
  expect(text()).toContain('Carregando dados')
  await act(async () => { done(); await second })
  await tick(0)
  expect(container.querySelector('[role="status"]')).toBeNull()
})

it('encerra o indicador quando uma alteração falha', async () => {
  await mount(<LoadingActivity />)
  let fail!: (error: Error) => void, operation!: Promise<unknown>
  await act(async () => {
    const mutation = client.getMutationCache().build(client, { mutationFn: () => new Promise((_resolve, reject) => { fail = reject }) })
    operation = mutation.execute(undefined).catch(() => {})
  })
  await tick(0)
  await tick(400)
  expect(text()).toContain('Processando sua solicitação')
  await act(async () => { fail(new Error('offline')); await operation })
  await tick(0)
  expect(container.querySelector('[role="status"]')).toBeNull()
})

it('mostra espera no login e sai do carregamento sem confundir senha incorreta com demora', async () => {
  let finish!: (value: unknown) => void
  auth.email.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await mount(<Login />)
  await fill('input[type="email"]', 'fixture@example.test')
  await fill('input[type="password"]', 'fixture-password')
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(text()).toContain('Entrando na sua Provisão')
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
  await tick(8000)
  expect(text()).toContain('O servidor pode estar iniciando')
  await act(async () => { finish({ error: { status: 401 } }) })
  expect(container.querySelector('.pv-loading')).toBeNull()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('E-mail ou senha incorretos')
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false)
})

it('libera o login por e-mail ao voltar da página do Google pelo histórico', async () => {
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com' } })
  await mount(<Login />)
  const google = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Continuar com Google'))!
  await act(async () => google.click())
  expect(text()).toContain('Conectando com o Google')
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
  await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  expect(container.querySelector('.pv-loading')).toBeNull()
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false)
  expect(google.disabled).toBe(false)
})
