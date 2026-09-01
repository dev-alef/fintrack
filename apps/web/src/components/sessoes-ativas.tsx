import { useCallback, useEffect, useState } from "react"
import { Monitor, Smartphone, LogOut, Loader2 } from "lucide-react"
import { authClient, useSession } from "../lib/auth-client"
import { Button } from "@/components/ui/button"

type Sessao = {
  id: string
  token: string
  createdAt: string | Date
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Resume o user-agent em algo reconhecível.
 *
 * Duplica a lógica que existe no servidor (emails/templates.ts), e isso é
 * deliberado: a lista vem do endpoint do Better Auth, cuja resposta não temos
 * como alterar para incluir uma descrição pronta. Extrair para um pacote
 * compartilhado por quinze linhas custaria mais do que resolve.
 */
function descreveDispositivo(userAgent?: string | null): string {
  if (!userAgent) return "dispositivo desconhecido"

  const navegador = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "navegador desconhecido"

  const sistema = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iOS/.test(userAgent)
      ? "iPhone ou iPad"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "Mac"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "sistema desconhecido"

  return `${navegador} em ${sistema}`
}

function ehCelular(userAgent?: string | null) {
  return /Android|iPhone|iPad|Mobile/.test(userAgent ?? "")
}

function formataData(valor: string | Date) {
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

/**
 * Sessões ativas, com a opção de encerrar cada uma.
 *
 * É a contrapartida do aviso de acesso novo: o e-mail avisa que alguém entrou,
 * e esta tela é o que a pessoa usa para expulsar quem entrou. Um sem o outro
 * deixa metade do problema — saber do invasor sem poder tirá-lo.
 */
export function SessoesAtivas() {
  const { data: sessaoAtual } = useSession()
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null)
  const [encerrando, setEncerrando] = useState<string | null>(null)
  const [erro, setErro] = useState("")

  const tokenAtual = sessaoAtual?.session?.token

  const carrega = useCallback(async () => {
    try {
      const { data, error } = await authClient.listSessions()
      if (error) {
        setErro("Não foi possível carregar suas sessões.")
        return
      }
      setSessoes((data ?? []) as Sessao[])
    } catch {
      setErro("Não foi possível falar com o servidor.")
    }
  }, [])

  useEffect(() => {
    void carrega()
  }, [carrega])

  async function encerra(token: string) {
    setErro("")
    setEncerrando(token)
    try {
      const { error } = await authClient.revokeSession({ token })
      if (error) {
        setErro("Não foi possível encerrar essa sessão.")
        return
      }
      await carrega()
    } catch {
      setErro("Não foi possível falar com o servidor.")
    } finally {
      setEncerrando(null)
    }
  }

  async function encerraOutras() {
    setErro("")
    setEncerrando("outras")
    try {
      const { error } = await authClient.revokeOtherSessions()
      if (error) {
        setErro("Não foi possível encerrar as outras sessões.")
        return
      }
      await carrega()
    } catch {
      setErro("Não foi possível falar com o servidor.")
    } finally {
      setEncerrando(null)
    }
  }

  if (sessoes === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando sessões...
      </p>
    )
  }

  // A sessão atual vai primeiro: é a âncora para ler a lista — a pessoa
  // reconhece "este é meu computador" e julga o resto a partir dela.
  const ordenadas = [...sessoes].sort((a, b) => {
    if (a.token === tokenAtual) return -1
    if (b.token === tokenAtual) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const outras = ordenadas.filter((s) => s.token !== tokenAtual)

  return (
    <div className="space-y-4">
      {erro && (
        <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {erro}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {ordenadas.map((s) => {
          const atual = s.token === tokenAtual
          const Icone = ehCelular(s.userAgent) ? Smartphone : Monitor

          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3"
            >
              <Icone className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm text-text">
                  {descreveDispositivo(s.userAgent)}
                  {atual && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--success)" }}
                    >
                      este dispositivo
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  desde {formataData(s.createdAt)}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                </p>
              </div>

              {/* A sessão atual não oferece "encerrar": clicar ali derrubaria a
                  própria pessoa da tela em que ela está. Para sair daqui existe
                  o botão de sair no menu, que é onde se procura por isso. */}
              {!atual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => encerra(s.token)}
                  disabled={encerrando !== null}
                >
                  {encerrando === s.token ? "Encerrando..." : "Encerrar"}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {outras.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="gap-2" onClick={encerraOutras} disabled={encerrando !== null}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {encerrando === "outras" ? "Encerrando..." : `Encerrar as outras ${outras.length}`}
          </Button>
          <span className="text-xs text-muted">Você continua conectado neste dispositivo.</span>
        </div>
      )}
    </div>
  )
}
