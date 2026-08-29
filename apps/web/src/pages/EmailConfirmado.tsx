import { useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { CheckCircle2, XCircle } from "lucide-react"
import { useSession } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

// Codigos que o Better Auth devolve em ?error= quando a verificacao falha.
const ERROS: Record<string, string> = {
  invalid_token: "Este link não é válido. Peça um novo e-mail de confirmação.",
  token_expired: "Este link expirou. Peça um novo e-mail de confirmação.",
  user_not_found: "A conta deste link não existe mais.",
}

/**
 * Destino do link de confirmacao. O Better Auth valida o token do lado do
 * servidor antes de chegar aqui, entao esta tela nao verifica nada - ela so
 * conta o resultado.
 *
 * Como autoSignInAfterVerification esta ligado, quem chega aqui com sucesso ja
 * tem sessao. Por isso a tela leva ao painel em vez de pedir a senha de novo:
 * a pessoa acabou de provar que controla o endereco.
 */
export default function EmailConfirmado() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()

  const codigoErro = searchParams.get("error")
  const deuCerto = !codigoErro

  useEffect(() => {
    if (!deuCerto || isPending || !session?.user) return
    // Um respiro para a confirmacao ser lida antes de sair da tela. Redirecionar
    // na hora faria parecer que nada aconteceu.
    const t = setTimeout(() => navigate("/dashboard"), 2500)
    return () => clearTimeout(t)
  }, [deuCerto, isPending, session, navigate])

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
        <div className="w-full max-w-[400px] space-y-6 text-center">
          <div className="flex justify-center">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                deuCerto ? "bg-success/10" : "bg-danger/10"
              }`}
            >
              {deuCerto ? (
                <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
              ) : (
                <XCircle className="h-7 w-7 text-danger" aria-hidden="true" />
              )}
            </span>
          </div>

          {deuCerto ? (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">E-mail confirmado</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Sua conta está completa. Entrar com o Google agora cai nesta mesma
                  conta, com os mesmos lançamentos.
                </p>
              </div>

              {session?.user ? (
                <p className="text-sm text-muted">Levando você ao painel...</p>
              ) : (
                <Button type="button" className="w-full" onClick={() => navigate("/login")}>
                  Entrar
                </Button>
              )}
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">Não deu para confirmar</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {ERROS[codigoErro] ?? `Algo deu errado na confirmação (${codigoErro}).`}
                </p>
              </div>

              <Link
                to="/confirme-seu-email"
                className="block text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Pedir um novo link
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
