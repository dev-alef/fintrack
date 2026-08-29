import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { MailCheck } from "lucide-react"
import { authClient } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Tela mostrada logo apos o cadastro. Existe para a pessoa nao ficar sem saber
 * que ha um e-mail esperando: sem ela, o cadastro levaria direto ao login, a
 * pessoa entraria normalmente e so descobriria a pendencia ao tentar o Google
 * e ser recusada sem explicacao.
 */
export default function ConfirmeSeuEmail() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado")
  const [erro, setErro] = useState("")

  async function reenviar() {
    setEstado("enviando")
    setErro("")
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/email-confirmado`,
      })
      if (error) {
        // O limite desta rota e 3 por minuto. Sem dizer isso, a pessoa clica de
        // novo achando que nao funcionou e so piora a espera.
        setErro(
          error.status === 429
            ? "Muitas tentativas. Espere um minuto antes de pedir outro e-mail."
            : "Não foi possível reenviar agora. Tente daqui a pouco.",
        )
        setEstado("erro")
        return
      }
      setEstado("enviado")
    } catch {
      setErro("Não foi possível falar com o servidor.")
      setEstado("erro")
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
        <div className="w-full max-w-[440px] space-y-6 text-center">
          <div className="flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" aria-hidden="true" />
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">Conta criada. Falta confirmar.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Enviamos um link de confirmação
              {email ? (
                <>
                  {" "}para <span className="font-medium text-text">{email}</span>
                </>
              ) : null}
              . Ele vale por 1 hora.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-left">
            <p className="text-sm leading-relaxed text-muted">
              Você já pode entrar normalmente com e-mail e senha. Confirmar libera o
              login com o Google nesta mesma conta — sem isso, entrar pelo Google
              criaria uma conta separada, e seus lançamentos ficariam na outra.
            </p>
          </div>

          {estado === "enviado" && (
            <div role="status" className="rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
              E-mail reenviado. Confira também a caixa de spam.
            </div>
          )}

          {estado === "erro" && (
            <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
              {erro}
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={reenviar}
              disabled={!email || estado === "enviando"}
            >
              {estado === "enviando" ? "Reenviando..." : "Reenviar e-mail"}
            </Button>

            <Link
              to="/login"
              className="block text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Ir para o login
            </Link>
          </div>

          <p className="text-xs text-muted">Não chegou? Verifique a caixa de spam antes de reenviar.</p>
        </div>
      </div>
    </div>
  )
}
