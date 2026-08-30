import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Lock, Eye, EyeOff } from "lucide-react"
import { authClient } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

const TAMANHO_MINIMO = 8

export default function NovaSenha() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")
  // O Better Auth redireciona para ca com ?error=INVALID_TOKEN quando o link ja
  // foi usado ou expirou, em vez de deixar a pessoa preencher o formulario para
  // so entao descobrir.
  const erroNoLink = searchParams.get("error")

  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  const linkInvalido = !token || Boolean(erroNoLink)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro("")

    if (senha.length < TAMANHO_MINIMO) {
      setErro(`A senha precisa de pelo menos ${TAMANHO_MINIMO} caracteres.`)
      return
    }
    // Conferido aqui porque um erro de digitacao so apareceria no proximo
    // login, depois de o token ja ter sido consumido - e a pessoa ficaria
    // trancada para fora com uma senha que ela nao sabe qual e.
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.")
      return
    }

    setCarregando(true)
    try {
      const { error } = await authClient.resetPassword({ newPassword: senha, token: token! })
      if (error) {
        setErro(
          error.status === 429
            ? "Muitas tentativas. Espere um minuto e tente de novo."
            : "Não foi possível redefinir. O link pode ter expirado — peça outro.",
        )
        return
      }
      navigate("/login?senha=redefinida")
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
          {linkInvalido ? (
            <div className="space-y-4 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-text">Link inválido ou expirado</h1>
              <p className="text-sm leading-relaxed text-muted">
                Links de redefinição valem por 1 hora e só podem ser usados uma vez.
                Peça um novo para continuar.
              </p>
              <Link
                to="/esqueci-senha"
                className="block text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Pedir um novo link
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">Escolha uma nova senha</h1>
                <p className="mt-2 text-sm text-muted">
                  Ao salvar, você sai das outras sessões conectadas.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      id="senha"
                      type={mostrar ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrar((v) => !v)}
                      aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmacao">Repita a nova senha</Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      id="confirmacao"
                      type={mostrar ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {erro && (
                  <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {erro}
                  </div>
                )}

                <Button type="submit" disabled={carregando} className="w-full">
                  {carregando ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
