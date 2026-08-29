import { useState } from "react"
import { MailWarning, X } from "lucide-react"
import { authClient, useSession } from "../lib/auth-client"

/**
 * Aviso para quem esta usando o app sem ter confirmado o e-mail.
 *
 * Confirmar nao e obrigatorio para entrar - de proposito. Bloquear o login
 * criaria um jeito novo de ficar trancado para fora: e-mail que nao chega
 * viraria conta perdida. O aviso existe porque a pendencia tem consequencia
 * concreta e invisivel: entrar pelo Google com o mesmo endereco criaria uma
 * conta separada, e os lancamentos ficariam na outra.
 *
 * Da para fechar. Voltar em toda navegacao seria ruido, e a barra reaparece na
 * proxima sessao enquanto a pendencia existir.
 */
export function AvisoEmailNaoConfirmado() {
  const { data: session } = useSession()
  const [fechado, setFechado] = useState(false)
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado")

  const usuario = session?.user
  if (!usuario || usuario.emailVerified || fechado) return null

  async function reenviar() {
    if (!usuario) return
    setEstado("enviando")
    const { error } = await authClient.sendVerificationEmail({
      email: usuario.email,
      callbackURL: `${window.location.origin}/email-confirmado`,
    })
    setEstado(error ? "erro" : "enviado")
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
    >
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />

      <div className="flex-1 text-sm leading-relaxed text-text">
        <p>
          Confirme seu e-mail para poder entrar com o Google nesta mesma conta.
          Sem isso, o login pelo Google criaria uma conta separada.
        </p>

        {estado === "enviado" ? (
          <p className="mt-1 text-muted">E-mail reenviado. Confira também o spam.</p>
        ) : estado === "erro" ? (
          <p className="mt-1 text-danger">Não foi possível reenviar. Tente daqui a pouco.</p>
        ) : (
          <button
            type="button"
            onClick={reenviar}
            disabled={estado === "enviando"}
            className="mt-1 font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm disabled:opacity-60"
          >
            {estado === "enviando" ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setFechado(true)}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
