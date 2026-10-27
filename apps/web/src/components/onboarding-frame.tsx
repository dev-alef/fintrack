import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'
import { useTheme } from './theme-provider'
import '../pages/onboarding.css'
export type OnboardingPhase='transition'|'intro'|'conversation'|'done'
export function OnboardingPrivacy() {
  return <div className="oc-privacy"><LockKeyhole size={17} aria-hidden="true"/><div><strong>Seus dados são privados.</strong> Seus registros ficam vinculados à sua conta e não são exibidos para outros usuários.
    <details><summary>Como seus dados são utilizados</summary><p>Ao autorizar a IA, sua resposta e os itens do rascunho são enviados ao Google Gemini para interpretação. Você pode preencher os campos sem usar IA. A plataforma e seus prestadores processam os dados para operar o serviço; o tratamento é limitado à operação do serviço, conforme a Política de Privacidade.</p><p>O histórico da conversa não é armazenado. O rascunho guarda somente os itens estruturados e é reiniciado no próximo acesso após 30 dias sem uso.</p><Link to="/privacidade" target="_blank" rel="noopener noreferrer">Ler a Política de Privacidade</Link></details>
  </div></div>
}
export function TypedQuestion({text}:{text:string}) {
  const [shown,setShown]=useState('')
  useEffect(()=>{
    const mq=matchMedia('(prefers-reduced-motion: reduce)')
    if(mq.matches){setShown(text);return}
    setShown('');let i=0;const t=setInterval(()=>{setShown(text.slice(0,++i));if(i>=text.length)clearInterval(t)},25)
    return()=>clearInterval(t)
  },[text])
  return <><span className="oc-sr-only">{text}</span><span aria-hidden="true">{shown}{shown.length<text.length&&<span className="oc-cursor">▍</span>}</span></>
}
export function OnboardingFrame({phase,onStart,onExit,locked,error,group=1,returning=false,children}:{phase:OnboardingPhase;onStart:()=>void;onExit:()=>void;locked:boolean;error?:string;group?:number;returning?:boolean;children:ReactNode}) {
  const {theme}=useTheme()
  return <div className="oc-preview oc-frame">
    <header className="oc-header"><img src={`/brand/provisao-forte${theme==='dark'||theme==='tech'?'-claro':''}.svg`} alt="Provisão"/><div className="oc-header-actions"><button disabled={locked} onClick={onExit} className="oc-link">{returning?'Ir ao Dashboard':'Salvar rascunho e sair'}</button><ThemeToggle/></div></header>
    {error&&<div role="alert" className="oc-exit-error rounded-lg border border-border p-4 text-sm">{error}</div>}
    {phase==='transition'?<section className="oc-transition" role="status" style={returning?{animationDuration:"5s"}:undefined}><div className="oc-glow"/><div className="oc-mark"><Logo size={86}/></div><h1>{returning?'Um novo tempo começa.':'Um novo começo.'}</h1><p>{returning?'Vamos colocar o dinheiro para trabalhar para você — e não o contrário!':'Vamos abrir espaço para os seus planos.'}</p></section>:<div className="oc-layout">
      <aside><div className="oc-eyebrow">{returning?'Seu espaço':'Seu primeiro passo'}</div><ol>{['Boas-vindas','Seu momento','Seus compromissos','Conferir juntos'].map((v,i)=><li key={v} className={i===group?'active':i<group?'done':''}><span>{i<group?'✓':String(i+1).padStart(2,'0')}</span>{v}</li>)}</ol><p>Você conta a sua história.<br/>A Provisão ajuda a organizar.</p><Link className="oc-link" to="/dashboard" onClick={e=>{e.preventDefault();if(!locked)onExit()}}>Continuar depois</Link></aside>
      <main className="oc-stage"><div className="oc-orb" aria-hidden="true"/>
        {phase==='intro'?<section className="oc-arrive"><div className="oc-eyebrow">Olá. Que bom ter você aqui.</div><h1>Seu dinheiro tem uma história.<br/><em>{returning?'Vamos continuar a sua?':'Vamos entender a sua?'}</em></h1><p className="oc-description">{returning?'Seu espaço está pronto. Confira suas previsões e acompanhe seus planos no Dashboard.':'Uma conversa de cada vez. Conte como é sua rotina e prepare seu espaço na Provisão. Você confere e escolhe o que cadastrar antes de confirmar.'}</p><OnboardingPrivacy/><button className="oc-primary" onClick={onStart}>{returning?'Acessar Dashboard':'Vamos conversar'} <span>↗</span></button><button className="oc-link" style={{marginLeft:24}} disabled={locked} onClick={onExit}>Pular por enquanto</button></section>:children}
        <footer className="oc-footer"><span>A IA ajuda a enxergar. Você decide.</span><Link to="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</Link></footer>
      </main>
    </div>}
  </div>
}
