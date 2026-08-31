/**
 * Tela de entrada — direcao "3a" do pacote de design Organic.
 *
 * Formulario centralizado sobre um fundo vivo: blobs a deriva, onda no rodape e
 * chips de gasto sendo cortados, com o orbe da IA e frases rotativas acima do
 * cartao. O movimento e lento e ciclico de proposito - o ambiente vive, mas nao
 * compete com a tarefa.
 *
 * As cores saem de variaveis CSS, nunca de hex literal. A implementacao de
 * referencia fixava as cores num objeto e so o tema claro funcionava; usando os
 * tokens, os tres temas acompanham sozinhos.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { signIn, signUp } from "../lib/auth-client"
import { GoogleButton } from "@/components/google-button"
import { ThemeToggle } from "@/components/theme-toggle"

const CHIPS = [
  { label: "Streaming", value: "R$ 39,90", delay: 0 },
  { label: "Assinatura dupla", value: "R$ 31,90", delay: 1.7 },
  { label: "Taxa do banco", value: "R$ 24,00", delay: 3.3 },
  { label: "Juros do cartão", value: "R$ 88,20", delay: 5 },
  { label: "App esquecido", value: "R$ 54,10", delay: 6.6 },
  { label: "Entrega tarde", value: "R$ 46,70", delay: 8.3 },
]

const FRASES = [
  "Cortei R$ 118 em assinaturas que você não usava.",
  "Nesse ritmo, sua reserva fecha em abril.",
  "Você gastou 12% menos com transporte neste mês.",
]

// Toda animacao com delay positivo leva `both`. Sem isso os elementos aparecem
// empilhados antes da vez - bug registrado no handoff como ja ocorrido.
const KEYFRAMES = `
@keyframes pv-drift {0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-24px)}}
@keyframes pv-drift2 {0%,100%{transform:translate(0,0)}50%{transform:translate(-34px,20px)}}
@keyframes pv-breathe {0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.08);opacity:.75}}
@keyframes pv-wave {from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pv-ring {0%{transform:scale(.86);opacity:.45}100%{transform:scale(1.6);opacity:0}}
@keyframes pv-spin {to{transform:rotate(360deg)}}
@keyframes pv-sheen {0%,100%{opacity:.35}50%{opacity:.8}}
@keyframes pv-chip {
  0%{transform:translateY(-46px) scale(.96);opacity:0}
  9%{transform:none;opacity:1}
  68%{transform:none;opacity:1}
  80%,100%{transform:translateY(-10px) scale(.9);opacity:0}
}
@keyframes pv-strike {0%,52%{width:0;opacity:0}56%{opacity:1}64%,100%{width:100%;opacity:1}}
@keyframes pv-savings {0%,62%{opacity:0;transform:translateY(4px)}70%{opacity:1;transform:translateY(-8px)}88%,100%{opacity:0;transform:translateY(-22px)}}
@keyframes pv-say {0%{opacity:0;transform:translateY(8px)}7%,26%{opacity:1;transform:none}33%,100%{opacity:0;transform:translateY(-6px)}}
.pv-field:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--surface-2)}
.pv-primary:hover{background:var(--primary-hover)}
.pv-primary:active{background:var(--primary-active)}
.pv :focus-visible{outline:2px solid var(--primary);outline-offset:2px}
`

// Codigos que o Better Auth devolve em ?error= no callback do OAuth.
const ERROS_OAUTH: Record<string, string> = {
  account_not_linked:
    "Já existe uma conta com este e-mail. Entre com e-mail e senha — por segurança, a conta do Google só é vinculada depois disso.",
  oauth_provider_not_found: "Login com Google indisponível no momento. Entre com e-mail e senha.",
  email_not_verified: "O Google não confirmou este e-mail. Entre com e-mail e senha.",
  email_not_found: "O Google não informou um e-mail para esta conta.",
  invalid_code: "A autorização do Google não foi aceita. Tente novamente ou entre com e-mail e senha.",
  state_mismatch: "A autorização do Google expirou ou já foi usada. Clique em Continuar com Google novamente.",
  state_invalid: "A autorização do Google expirou ou já foi usada. Clique em Continuar com Google novamente.",
  state_not_found: "A autorização do Google expirou ou já foi usada. Clique em Continuar com Google novamente.",
}

/**
 * O 401 nao diz SE o errado foi o e-mail ou a senha. Dizer transformaria a tela
 * num detector de quem tem conta aqui, para qualquer um com uma lista de
 * enderecos - informacao demais num app de financas.
 */
function erroDeLogin(status?: number): string {
  if (status === 401 || status === 400) return "E-mail ou senha incorretos. Confira e tente de novo."
  if (status === 429) return "Muitas tentativas seguidas. Espere um minuto antes de tentar de novo."
  if (status === 403) return "Não foi possível entrar com esta conta. Se você usa o Google, entre por ele."
  return "Não foi possível entrar agora. Tente novamente em instantes."
}

/**
 * No cadastro, dizer que o e-mail ja existe NAO e vazamento: quem tenta se
 * cadastrar descobre de qualquer forma, porque a duplicata precisa ser
 * recusada. Esconder so faria a pessoa repetir sem entender.
 */
function erroDeCadastro(status?: number): string {
  if (status === 422) return 'Já existe uma conta com este e-mail. Tente entrar, ou use "Esqueci minha senha".'
  if (status === 400) return "Senha muito curta. Use pelo menos 8 caracteres."
  if (status === 429) return "Muitas tentativas seguidas. Espere um minuto antes de tentar de novo."
  return "Não foi possível criar a conta agora. Tente novamente em instantes."
}

function forcaDaSenha(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" }
  const maiuscula = /[A-Z]/.test(pw)
  const numero = /[0-9]/.test(pw)
  const especial = /[^A-Za-z0-9]/.test(pw)
  if (pw.length < 6) return { score: 1, label: "Fraca" }
  if (pw.length < 8) return { score: 2, label: "Média" }
  if (maiuscula && numero && especial) return { score: 4, label: "Forte" }
  if (maiuscula && numero) return { score: 3, label: "Boa" }
  return { score: 2, label: "Média" }
}

function saudacao() {
  const h = new Date().getHours()
  return h < 6 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite"
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // /register renderiza esta mesma tela, na aba de cadastro. Duas rotas para um
  // componente so: o desenho juntou as duas em abas, mas links antigos e a
  // memoria de quem ja usava o app continuam funcionando.
  const [modo, setModo] = useState<"entrar" | "criar">(
    location.pathname === "/register" ? "criar" : "entrar",
  )

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [focado, setFocado] = useState(false)
  const [reduzido, setReduzido] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const forca = useMemo(() => forcaDaSenha(senha), [senha])
  const criando = modo === "criar"

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const aplica = () => setReduzido(mq.matches)
    aplica()
    mq.addEventListener("change", aplica)
    return () => {
      mq.removeEventListener("change", aplica)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    const codigo = searchParams.get("error")
    if (codigo) {
      setErro(ERROS_OAUTH[codigo] ?? `Não foi possível entrar com o Google (${codigo}).`)
    }
  }, [searchParams])

  const senhaRedefinida = searchParams.get("senha") === "redefinida"

  // Enquanto a pessoa digita, tudo desacelera 2,6x - o multiplicador vale para
  // duracao E delay, senao os ciclos se desencontram e os chips se sobrepoem.
  const k = focado ? 2.6 : 1
  const s = (n: number) => `${(n * k).toFixed(2)}s`
  const play = reduzido ? "paused" : "running"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro("")

    if (!email.includes("@")) return setErro("Informe um e-mail válido.")
    if (senha.length < 6) return setErro("A senha precisa de pelo menos 6 caracteres.")

    setCarregando(true)
    try {
      if (criando) {
        const { error } = await signUp.email({ email, password: senha, name: nome })
        if (error) return setErro(erroDeCadastro(error.status))
        navigate(`/confirme-seu-email?email=${encodeURIComponent(email)}`)
        return
      }

      const { error } = await signIn.email({ email, password: senha })
      if (error) return setErro(erroDeLogin(error.status))

      // O ambiente se dissolve e o cartao sobe antes de navegar. Sem a pausa, a
      // transicao existiria no codigo e nao na tela.
      setSaindo(true)
      timer.current = window.setTimeout(() => navigate("/dashboard"), 900)
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.")
    } finally {
      setCarregando(false)
    }
  }

  const campo: React.CSSProperties = {
    fontSize: 15,
    padding: "13px 18px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--field)",
    color: "var(--text)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  }

  const rotulo: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "var(--text-2)",
  }

  const chip = (c: (typeof CHIPS)[number], lado: "left" | "right") => (
    <div
      key={c.label}
      style={{
        position: "relative",
        alignSelf: lado === "left" ? "flex-start" : "flex-end",
        animation: `pv-chip ${s(10)} ease-in-out ${s(c.delay)} infinite both`,
        animationPlayState: play,
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "10px 18px",
          borderRadius: 999,
          background: "var(--surface)",
          boxShadow: "var(--shadow)",
          fontSize: 13,
          display: "flex",
          gap: 12,
        }}
      >
        <span style={{ color: "var(--text-2)" }}>{c.label}</span>
        <span>{c.value}</span>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            height: 1.5,
            background: "var(--link)",
            borderRadius: 999,
            animation: `pv-strike ${s(10)} ease-in-out ${s(c.delay)} infinite both`,
            animationPlayState: play,
          }}
        />
      </div>
      <span
        style={
          {
            position: "absolute",
            [lado]: 18,
            top: -6,
            fontSize: 12,
            color: "var(--success)",
            whiteSpace: "nowrap",
            animation: `pv-savings ${s(10)} ease-in-out ${s(c.delay)} infinite both`,
            animationPlayState: play,
          } as React.CSSProperties
        }
      >
        + {c.value} para você
      </span>
    </div>
  )

  return (
    <div
      className="pv"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        color: "var(--text)",
        background: "linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%)",
        transition: "background 500ms ease, color 300ms ease",
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Ambiente. Sai de cena quando o login e aceito. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: saindo ? 0 : reduzido ? 0.55 : 1,
          transition: "opacity 900ms ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 460,
            borderRadius: 999,
            background: "var(--blob-1)",
            top: -150,
            left: -120,
            animation: `pv-drift ${s(22)} ease-in-out infinite`,
            animationPlayState: play,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: 999,
            background: "var(--blob-2)",
            top: 40,
            right: -80,
            animation: `pv-drift2 ${s(27)} ease-in-out infinite`,
            animationPlayState: play,
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "200%",
            height: 190,
            display: "flex",
            animation: `pv-wave ${s(34)} linear infinite`,
            animationPlayState: play,
          }}
        >
          {/* Duas copias lado a lado: a animacao desloca -50%, e a segunda
              assume no exato ponto em que a primeira sai. */}
          {[0, 1].map((i) => (
            <svg key={i} viewBox="0 0 1120 200" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}>
              <path
                d="M0 96 C 140 52, 280 140, 420 96 C 560 52, 700 140, 840 96 C 980 52, 1050 118, 1120 96 L1120 200 L0 200 Z"
                fill="var(--success)"
                opacity=".28"
              />
            </svg>
          ))}
        </div>

        {/* Escondidos em telas estreitas: no celular disputariam espaco com o
            cartao, que e o que importa. */}
        <div className="hidden lg:flex" style={{ position: "absolute", top: 200, left: 60, flexDirection: "column", gap: 14, width: 260 }}>
          {CHIPS.filter((_, i) => i % 2 === 0).map((c) => chip(c, "left"))}
        </div>
        <div
          className="hidden lg:flex"
          style={{ position: "absolute", top: 250, right: 60, flexDirection: "column", gap: 14, width: 260, alignItems: "flex-end" }}
        >
          {CHIPS.filter((_, i) => i % 2 === 1).map((c) => chip(c, "right"))}
        </div>
      </div>

      {/* Amostra do saldo previsto - um recurso que o app realmente tem.
          Fica no canto vazio, equilibrando o seletor de tema do outro lado, e
          some abaixo de lg junto com os chips: no celular competiria com o
          cartao. Acompanha o ambiente ao sair, para nao sobrar sozinho na tela
          depois que o login e aceito. */}
      <div
        className="hidden lg:block"
        style={{
          position: "absolute",
          top: 52,
          left: 60,
          opacity: saindo ? 0 : 1,
          transition: "opacity 600ms ease",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>
          Saldo previsto para dezembro
        </div>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 34,
            color: "var(--link)",
            lineHeight: 1.15,
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          R$ 16.748,00
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>exemplo</div>
      </div>

      <div style={{ position: "absolute", top: 24, right: 24, zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            opacity: saindo ? 0 : 1,
            transform: saindo ? "translateY(-40px)" : "none",
            transition: "opacity 700ms ease, transform 700ms cubic-bezier(.3,0,.2,1)",
          }}
        >
          {/* Orbe da IA */}
          <div aria-hidden="true" style={{ position: "relative", width: 108, height: 108, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: "var(--ai-ring)",
                animation: `pv-ring ${s(5)} ease-out infinite`,
                animationPlayState: play,
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: "var(--ai-ring)",
                animation: `pv-ring ${s(5)} ease-out ${s(1.6)} infinite both`,
                animationPlayState: play,
              }}
            />
            <span
              style={{
                width: 74,
                height: 74,
                borderRadius: 999,
                background: "var(--orb)",
                animation: `pv-breathe ${s(5)} ease-in-out infinite`,
                animationPlayState: play,
              }}
            />
          </div>

          <div aria-hidden="true" style={{ position: "relative", height: 44, width: "min(640px, 90vw)", textAlign: "center" }}>
            {FRASES.map((t, i) => (
              <span
                key={t}
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: 18,
                  lineHeight: 1.35,
                  color: "var(--link)",
                  animation: `pv-say ${s(21)} ease-in-out ${s(i * 7)} infinite both`,
                  animationPlayState: play,
                }}
              >
                {t}
              </span>
            ))}
          </div>

          <form
            onSubmit={onSubmit}
            noValidate
            style={{
              width: "min(432px, 92vw)",
              background: "var(--surface)",
              borderRadius: 16,
              padding: "32px 38px 28px",
              boxShadow: "var(--shadow)",
              border: "1px solid var(--border)",
              transition: "background 400ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 26 }}>Provisão</span>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--success)",
                    animation: `pv-sheen ${s(2.4)} ease-in-out infinite`,
                    animationPlayState: play,
                  }}
                />
                IA acordada
              </span>
            </div>

            <div role="tablist" aria-label="Entrar ou criar conta" style={{ display: "flex", gap: 6, padding: 5, borderRadius: 999, background: "var(--surface-2)", marginBottom: 18 }}>
              {(["entrar", "criar"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => {
                    setModo(m)
                    setErro("")
                  }}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    padding: 10,
                    borderRadius: 999,
                    // No escuro a aba ativa precisa de contorno: so a diferenca
                    // de fundo contra a trilha nao se ve.
                    border: modo === m ? "1px solid var(--primary)" : "1px solid transparent",
                    cursor: "pointer",
                    background: modo === m ? "var(--field)" : "transparent",
                    color: "var(--link)",
                    fontWeight: modo === m ? 600 : 400,
                  }}
                >
                  {m === "entrar" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>
              {saudacao()}. {criando ? "Leva menos de um minuto." : "Que bom ver você de novo."}
            </p>

            {/* Regiao de status unica: leitores de tela anunciam qualquer
                mudanca aqui sem precisar que o foco se mova. */}
            <div aria-live="polite" style={{ marginBottom: erro || senhaRedefinida ? 14 : 0 }}>
              {senhaRedefinida && !erro && (
                <div
                  role="status"
                  style={{ borderRadius: 12, padding: "10px 14px", fontSize: 13, background: "var(--surface-2)", color: "var(--success)" }}
                >
                  Senha alterada. Entre com a nova senha.
                </div>
              )}
              {erro && (
                <div
                  role="alert"
                  style={{ borderRadius: 12, padding: "10px 14px", fontSize: 13, background: "var(--surface-2)", color: "var(--danger)" }}
                >
                  {erro}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {criando && (
                <label style={rotulo}>
                  Nome
                  <input
                    className="pv-field"
                    style={campo}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    onFocus={() => setFocado(true)}
                    onBlur={() => setFocado(false)}
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label style={rotulo}>
                E-mail
                <input
                  className="pv-field"
                  style={campo}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocado(true)}
                  onBlur={() => setFocado(false)}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  required
                />
              </label>

              <label style={rotulo}>
                Senha
                <span style={{ position: "relative", display: "block" }}>
                  <input
                    className="pv-field"
                    style={{ ...campo, paddingRight: 62 }}
                    type={verSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    onFocus={() => setFocado(true)}
                    onBlur={() => setFocado(false)}
                    autoComplete={criando ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--link)",
                    }}
                  >
                    {verSenha ? "ocultar" : "ver"}
                  </button>
                </span>
              </label>

              {criando && senha && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${forca.score * 25}%`,
                        borderRadius: 999,
                        background: forca.score >= 3 ? "var(--success)" : forca.score === 2 ? "var(--warning)" : "var(--danger)",
                        transition: "width 240ms ease",
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{forca.label}</span>
                </div>
              )}

              {!criando && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Link to="/esqueci-senha" style={{ fontSize: 13, color: "var(--link)" }}>
                    Esqueci minha senha
                  </Link>
                </div>
              )}

              <button
                type="submit"
                className="pv-primary"
                disabled={carregando || saindo}
                style={{
                  marginTop: 4,
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "14px 20px",
                  borderRadius: 999,
                  border: "none",
                  cursor: carregando || saindo ? "default" : "pointer",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                {(carregando || saindo) && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 999,
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      animation: "pv-spin .7s linear infinite",
                    }}
                  />
                )}
                {saindo
                  ? "Abrindo sua Provisão…"
                  : carregando
                    ? criando
                      ? "Criando…"
                      : "Entrando…"
                    : criando
                      ? "Criar conta"
                      : "Entrar"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>ou</span>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <GoogleButton
                label="Continuar com Google"
                disabled={carregando || saindo}
                onError={setErro}
                className="w-full gap-2 rounded-full py-3"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
