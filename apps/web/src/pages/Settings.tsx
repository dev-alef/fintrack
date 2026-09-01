import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { ShieldCheck, ShieldOff, Copy, Check, AlertTriangle, LifeBuoy } from "lucide-react"
import { FormularioSuporte } from "@/components/formulario-suporte"
import { twoFactor, useSession } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Etapa =
  | { nome: "parado" }
  | { nome: "pedindoSenha" }
  | { nome: "escaneando"; totpURI: string; backupCodes: string[] }
  | { nome: "guardandoCodigos"; backupCodes: string[] }
  | { nome: "desativando" }

export default function Settings() {
  const { data: session, refetch } = useSession()
  const [etapa, setEtapa] = useState<Etapa>({ nome: "parado" })
  const [senha, setSenha] = useState("")
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const ativo = Boolean(session?.user?.twoFactorEnabled)

  function limpa() {
    setSenha("")
    setCodigo("")
    setErro("")
  }

  async function iniciarAtivacao(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const { data, error } = await twoFactor.enable({ password: senha })
      if (error) {
        setErro(error.status === 400 ? "Senha incorreta." : "Não foi possível iniciar agora.")
        return
      }
      // O servidor pode responder com method 'otp' em vez de 'totp', e ai nao
      // vem segredo nem codigos de recuperacao. Nao acontece com a configuracao
      // atual, mas seguir em frente montaria um QR Code vazio e a pessoa
      // ativaria a verificacao sem nada para escanear - trancada para fora.
      if (data?.method !== "totp") {
        setErro("A verificação por aplicativo não está disponível no momento.")
        return
      }

      setEtapa({
        nome: "escaneando",
        totpURI: data.totpURI,
        backupCodes: data.backupCodes,
      })
      setSenha("")
    } catch {
      setErro("Não foi possível falar com o servidor.")
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (etapa.nome !== "escaneando") return
    setErro("")
    setCarregando(true)
    try {
      const { error } = await twoFactor.verifyTotp({ code: codigo.trim() })
      if (error) {
        setErro(
          error.status === 429
            ? "Muitas tentativas. Espere alguns segundos."
            : "Código incorreto. Cada código vale cerca de 30 segundos.",
        )
        return
      }
      // So agora a verificacao passa a valer. Ate aqui o segredo existia mas
      // ficava inerte - e de proposito: se ativasse antes, fechar a tela sem
      // escanear o QR trancaria a pessoa para fora da propria conta.
      setEtapa({ nome: "guardandoCodigos", backupCodes: etapa.backupCodes })
      setCodigo("")
      // Confirmar rotaciona a sessao no servidor. Sem recarregar, a tela
      // continuaria mostrando twoFactorEnabled: false.
      await refetch()
    } catch {
      setErro("Não foi possível falar com o servidor.")
    } finally {
      setCarregando(false)
    }
  }

  async function desativar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const { error } = await twoFactor.disable({ password: senha })
      if (error) {
        setErro(error.status === 400 ? "Senha incorreta." : "Não foi possível desativar agora.")
        return
      }
      setEtapa({ nome: "parado" })
      limpa()
      await refetch()
    } catch {
      setErro("Não foi possível falar com o servidor.")
    } finally {
      setCarregando(false)
    }
  }

  function copiarCodigos(codigos: string[]) {
    navigator.clipboard.writeText(codigos.join("\n")).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Configurações</h1>
        <p className="mt-2 text-sm text-muted">Segurança e acesso à sua conta.</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              ativo ? "bg-success/10" : "bg-surface-2"
            }`}
          >
            {ativo ? (
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted" aria-hidden="true" />
            )}
          </span>

          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">Verificação em duas etapas</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {ativo
                ? "Ativa. Além da senha, entrar exige um código do seu aplicativo autenticador."
                : "Um código do celular além da senha. Se sua senha vazar, ela sozinha não abre sua conta."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          {etapa.nome === "parado" && !ativo && (
            <Button type="button" onClick={() => { limpa(); setEtapa({ nome: "pedindoSenha" }) }}>
              Ativar verificação
            </Button>
          )}

          {etapa.nome === "parado" && ativo && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { limpa(); setEtapa({ nome: "desativando" }) }}
            >
              Desativar
            </Button>
          )}

          {etapa.nome === "pedindoSenha" && (
            <form onSubmit={iniciarAtivacao} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha-ativar">Confirme sua senha</Label>
                <Input
                  id="senha-ativar"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted">
                  Pedimos a senha para que ninguém com acesso ao seu computador destravado
                  ative a verificação com um aplicativo que não é o seu.
                </p>
              </div>

              {erro && <Aviso tipo="erro">{erro}</Aviso>}

              <div className="flex gap-2">
                <Button type="submit" disabled={carregando}>
                  {carregando ? "Verificando..." : "Continuar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setEtapa({ nome: "parado" }); limpa() }}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {etapa.nome === "escaneando" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-text">1. Escaneie o código</p>
                <p className="mt-1 text-sm text-muted">
                  Use Google Authenticator, Authy, 1Password ou outro aplicativo de códigos.
                </p>
              </div>

              {/* Gerado no proprio navegador. Uma API externa de QR receberia o
                  segredo TOTP, o que entregaria a chave da conta a um terceiro. */}
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={etapa.totpURI} size={180} />
              </div>

              <form onSubmit={confirmarCodigo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo-confirma">2. Digite o código que aparecer</Label>
                  <Input
                    id="codigo-confirma"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="000000"
                    className="text-center text-lg tracking-[0.4em]"
                  />
                  <p className="text-xs text-muted">
                    A verificação só passa a valer depois disso — assim você confirma que o
                    aplicativo está funcionando antes de precisar dele para entrar.
                  </p>
                </div>

                {erro && <Aviso tipo="erro">{erro}</Aviso>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={carregando}>
                    {carregando ? "Confirmando..." : "Confirmar e ativar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setEtapa({ nome: "parado" }); limpa() }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {etapa.nome === "guardandoCodigos" && (
            <div className="space-y-4">
              <Aviso tipo="atencao">
                <strong>Guarde estes códigos agora.</strong> Eles não serão mostrados de novo.
                Sem eles, perder o celular significa perder o acesso à sua conta e aos seus
                lançamentos. Cada código serve uma vez.
              </Aviso>

              <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-4 font-mono text-sm text-text">
                {etapa.backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => copiarCodigos(etapa.backupCodes)}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiado ? "Copiado" : "Copiar códigos"}
                </Button>
                <Button type="button" onClick={() => setEtapa({ nome: "parado" })}>
                  Guardei em lugar seguro
                </Button>
              </div>
            </div>
          )}

          {etapa.nome === "desativando" && (
            <form onSubmit={desativar} className="space-y-4">
              <Aviso tipo="atencao">
                Desativando, sua senha volta a ser suficiente para entrar. Os códigos de
                recuperação atuais deixam de valer.
              </Aviso>

              <div className="space-y-2">
                <Label htmlFor="senha-desativar">Confirme sua senha</Label>
                <Input
                  id="senha-desativar"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {erro && <Aviso tipo="erro">{erro}</Aviso>}

              <div className="flex gap-2">
                <Button type="submit" disabled={carregando}>
                  {carregando ? "Desativando..." : "Desativar verificação"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setEtapa({ nome: "parado" }); limpa() }}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Ancora propria: o link do menu aponta para ca, e a secao do 2FA fica
          acima sem obrigar a rolar procurando. */}
      <section id="suporte" className="scroll-mt-6 rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <LifeBuoy className="h-5 w-5 text-muted" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">Falar com o suporte</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Encontrou algo errado ou tem uma dúvida? Escreva abaixo — respondemos no e-mail da sua conta.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <FormularioSuporte />
        </div>
      </section>
    </div>
  )
}

function Aviso({ tipo, children }: { tipo: "erro" | "atencao"; children: React.ReactNode }) {
  const erro = tipo === "erro"
  return (
    <div
      role={erro ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        erro ? "border-danger/20 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-text"
      }`}
    >
      {!erro && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}
