import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ShieldCheck, KeyRound } from "lucide-react"
import { twoFactor } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Segundo passo do login de quem tem 2FA ativo.
 *
 * A senha correta ja foi aceita, mas ainda nao existe sessao: o servidor
 * respondeu com um desvio e guardou um cookie temporario identificando o
 * desafio. So o codigo certo cria a sessao de verdade.
 */
export default function DoisFatores() {
  const navigate = useNavigate()
  const [modo, setModo] = useState<"app" | "recuperacao">("app")
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  const usandoApp = modo === "app"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const { error } = usandoApp
        ? await twoFactor.verifyTotp({ code: codigo.trim() })
        : await twoFactor.verifyBackupCode({ code: codigo.trim() })

      if (error) {
        setErro(mensagemDeErro(error.status, usandoApp))
        return
      }
      navigate("/dashboard")
    } catch {
      setErro("Não foi possível falar com o servidor. Tente novamente.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="text-lg font-semibold tracking-tight text-text">Provisão</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              {usandoApp ? (
                <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
              ) : (
                <KeyRound className="h-7 w-7 text-primary" aria-hidden="true" />
              )}
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              {usandoApp ? "Confirme que é você" : "Use um código de recuperação"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {usandoApp
                ? "Abra seu aplicativo autenticador e digite o código de 6 dígitos."
                : "Digite um dos códigos que você guardou ao ativar a verificação. Cada um serve uma vez só."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">{usandoApp ? "Código de 6 dígitos" : "Código de recuperação"}</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
                // O teclado numerico so ajuda no codigo do aplicativo; o de
                // recuperacao tem letras e hifen.
                inputMode={usandoApp ? "numeric" : "text"}
                placeholder={usandoApp ? "000000" : "xxxxx-xxxxx"}
                className={usandoApp ? "text-center text-lg tracking-[0.4em]" : "text-center"}
              />
            </div>

            {erro && (
              <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {erro}
              </div>
            )}

            <Button type="submit" disabled={carregando} className="w-full">
              {carregando ? "Verificando..." : "Confirmar"}
            </Button>
          </form>

          <div className="space-y-3 text-center">
            <button
              type="button"
              onClick={() => {
                setModo(usandoApp ? "recuperacao" : "app")
                setCodigo("")
                setErro("")
              }}
              className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              {usandoApp ? "Perdi o acesso ao aplicativo" : "Voltar para o código do aplicativo"}
            </button>

            <Link to="/login" className="block text-sm text-muted hover:text-text">
              Entrar com outra conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function mensagemDeErro(status: number | undefined, usandoApp: boolean): string {
  if (status === 401 || status === 400) {
    return usandoApp
      ? "Código incorreto ou expirado. Cada código vale cerca de 30 segundos — confira o mais recente."
      : "Código de recuperação inválido ou já utilizado."
  }
  if (status === 429) {
    // O limite desta rota e 3 por 10 segundos. Sem dizer isso, quem errou
    // porque o codigo virou fica repetindo e renovando o bloqueio.
    return "Muitas tentativas seguidas. Espere alguns segundos e tente de novo."
  }
  if (status === 403) {
    return "Esta conta está temporariamente bloqueada por tentativas repetidas. Tente mais tarde."
  }
  return "Não foi possível verificar agora. Tente novamente em instantes."
}
