// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import { type SavedDraft, type Preview } from '@/lib/onboarding'
import Onboarding from './Onboarding'

const api = vi.hoisted(() => ({ get:vi.fn(), put:vi.fn(), post:vi.fn() }))
vi.mock('@/services/api', () => ({default:api}))
vi.mock('@/lib/auth-client', () => ({useSession:()=>({data:{user:{id:'onboarding-test',name:'Teste'}}})}))
let container:HTMLDivElement, root:Root, client:QueryClient, saved:SavedDraft
const button = (label:string) => [...container.querySelectorAll('button')].find(b=>b.textContent===label)
async function click(b:HTMLElement|undefined) { expect(b).toBeDefined();await act(async()=>b!.click()) }
function makePreview():Preview {
  const rows=saved.data.items.map(i=>({...i,issues:[],matches:[],selection_issues:[]}))
  return {version:saved.version,token:'a'.repeat(64),can_commit:rows.some(i=>i.action!=='pending'),pending_count:rows.filter(i=>i.action==='pending').length,current_period:'2031-01',reference_period:'2031-01',ready_ids:rows.map(i=>i.id),rows}
}
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}))
  vi.stubGlobal('scrollTo',vi.fn())
  saved={version:1,ai_available:true,question:'Vamos conferir?',existing:{config:[],bill:[],card:[],invoice:[],loan:[],client:[],subscription:[],expense:[]},data:{conversation_started:true,profile:'personal',month:1,year:2031,step:'review',skipped:[],absent:[],items:[{id:crypto.randomUUID(),kind:'loan',fields:{person:'Ana',direction:'payable',amount:300},action:'pending',duplicate_ack:false}]}}
  api.get.mockImplementation(async()=>({data:structuredClone(saved)}))
  api.put.mockImplementation(async(_url,body)=>{saved={...saved,version:saved.version+1,data:structuredClone(body.data)};return {data:structuredClone(saved)}})
  api.post.mockImplementation(async(url)=>{
    if(url==='/onboarding/preview')return {data:makePreview()}
    if(url==='/onboarding/commit')return {data:{created:1,reused:0,pending:0}}
    return {data:{ok:true}}
  })
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container)
  client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();client.clear();sessionStorage.clear();localStorage.clear();vi.unstubAllGlobals();vi.resetAllMocks()})
async function mount(){await act(async()=>root.render(<MemoryRouter initialEntries={['/assistente-inicial?conversation=1']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><ThemeProvider><QueryClientProvider client={client}><Onboarding/></QueryClientProvider></ThemeProvider></MemoryRouter>))}

it('explica a revisão sem seleção e oferece selecionar prontos ou continuar depois',async()=>{
  await mount()
  expect(container.querySelector<HTMLDetailsElement>('.oc-guided')?.open).toBe(false)
  await click(button('Atualizar revisão'))
  expect(container.textContent).toContain('Nenhum cadastro selecionado')
  expect(button('Selecionar itens prontos')).toBeDefined()
  expect(button('Continuar sem cadastrar')).toBeDefined()
})

it('atualiza a revisão ao selecionar um cadastro e permite confirmar sem atualização manual',async()=>{
  await mount()
  await click(button('Atualizar revisão'))
  const include=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('Incluir este cadastro'))!.querySelector('input')!
  await click(include)
  const confirm=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('Conferi os valores'))?.querySelector('input')
  expect(confirm).toBeDefined()
  await click(confirm!)
  expect(button('Confirmar e cadastrar')?.disabled).toBe(false)
  await click(button('Confirmar e cadastrar'))
  expect(saved.data.items[0].action).toBe('create')
  expect(api.post.mock.calls.filter(([url])=>url==='/onboarding/commit')).toHaveLength(1)
  expect(container.textContent).toContain('Seu espaço está pronto')
})

it('a seleção em lote exige uma ação explícita e não confirma cadastros sozinha',async()=>{
  await mount()
  expect(saved.data.items[0].action).toBe('pending')
  await click(button('Selecionar itens prontos'))
  expect(saved.data.items[0].action).toBe('create')
  expect(button('Confirmar e cadastrar')?.disabled).toBe(true)
  expect(api.post.mock.calls.some(([url])=>url==='/onboarding/commit')).toBe(false)
})

it('permite sair sem cadastrar e preserva os itens pendentes',async()=>{
  await mount()
  await click(button('Continuar sem cadastrar'))
  expect(saved.data.items[0].action).toBe('pending')
  expect(api.post.mock.calls.some(([url])=>url==='/onboarding/dismiss')).toBe(true)
  expect(api.post.mock.calls.some(([url])=>url==='/onboarding/commit')).toBe(false)
})

it('mostra a confirmação concluída mesmo com atualização de cache ainda pendente',async()=>{
  saved.data.items[0].action='create'
  await mount()
  vi.spyOn(client,'invalidateQueries').mockImplementation(()=>new Promise(()=>{}))
  await click([...container.querySelectorAll('label')].find(l=>l.textContent?.includes('Conferi os valores'))!.querySelector('input')!)
  await click(button('Confirmar e cadastrar'))
  expect(container.textContent).toContain('Seu espaço está pronto')
  expect(container.textContent).not.toContain('Confirmando seus cadastros')
  const saves=api.put.mock.calls.length
  await click(button('Ir ao Dashboard'))
  expect(api.put).toHaveBeenCalledTimes(saves)
})

it('reutiliza o mesmo pedido quando a resposta da confirmação se perde',async()=>{
  saved.data.items[0].action='create'
  await mount()
  await click([...container.querySelectorAll('label')].find(l=>l.textContent?.includes('Conferi os valores'))!.querySelector('input')!)
  api.post.mockRejectedValueOnce(new Error('connection lost'))
  await click(button('Confirmar e cadastrar'))
  const stored=JSON.parse(sessionStorage.getItem('onboarding-commit:onboarding-test')!)
  await click(button('Conferir confirmação'))
  const requests=api.post.mock.calls.filter(([url])=>url==='/onboarding/commit').map(([,body])=>body)
  expect(requests).toEqual([stored,stored])
  expect(sessionStorage.getItem('onboarding-commit:onboarding-test')).toBeNull()
  expect(container.textContent).toContain('Seu espaço está pronto')
})

it('atualiza a pergunta antes de aceitar uma resposta após editar campos guiados',async()=>{
  saved.data.step='bill'
  saved.data.items=[{id:crypto.randomUUID(),kind:'bill',fields:{name:'A',amount:100,recurring:true},action:'pending',duplicate_ack:false},{id:crypto.randomUUID(),kind:'bill',fields:{name:'B',amount:50,recurring:true},action:'pending',duplicate_ack:false}]
  saved.question='Em que dia do mês vence A?'
  api.put.mockImplementation(async(_url,body)=>{saved={...saved,version:saved.version+1,data:structuredClone(body.data),question:'Em que dia do mês vence B?'};return {data:structuredClone(saved)}})
  await mount()
  await click(button('Prefiro preencher os campos'))
  const due=container.querySelector<HTMLInputElement>(`[id="${saved.data.items[0].id}-due_day"]`)!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(due,'5');due.dispatchEvent(new Event('input',{bubbles:true}))})
  const answer=container.querySelector<HTMLTextAreaElement>('textarea')!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(answer,'10');answer.dispatchEvent(new Event('input',{bubbles:true}))})
  await click(container.querySelector<HTMLInputElement>('.oc-consent input')!)
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Enviar resposta"]')?.disabled).toBe(true)
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(api.post.mock.calls.some(([url])=>url==='/onboarding/answer')).toBe(false)
  await click(button('Salvar campos e atualizar pergunta'))
  expect(container.querySelector('h1')?.textContent).toContain('vence B')
  expect(saved.data.items[1].fields.due_day).toBeUndefined()
  expect(answer.value).toBe('10')
  expect(container.textContent).toContain('Confira a pergunta atualizada')
})

it('mantém a resposta e oferece campos guiados quando a interpretação não muda o rascunho',async()=>{
  saved.data.step='loan';saved.question='Qual é o nome da pessoa?'
  await mount()
  api.post.mockResolvedValueOnce({data:{...saved,answer_applied:false,answer_notice:'Não consegui identificar uma informação nova.'}})
  const answer=container.querySelector<HTMLTextAreaElement>('textarea')!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(answer,'talvez aquele');answer.dispatchEvent(new Event('input',{bubbles:true}))})
  await click(container.querySelector<HTMLInputElement>('.oc-consent input')!)
  await click(container.querySelector<HTMLButtonElement>('[aria-label="Enviar resposta"]')!)
  expect(answer.value).toBe('talvez aquele')
  expect(container.textContent).toContain('Não consegui identificar')
  expect(container.querySelector<HTMLDetailsElement>('.oc-guided')?.open).toBe(true)
})
