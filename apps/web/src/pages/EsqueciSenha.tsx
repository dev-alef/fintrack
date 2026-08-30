import { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, MailCheck } from "lucide-react"
import { authClient } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function EsqueciSenha() {
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro("")
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/nova-senha`,
      })

      // Erro de limite precisa aparecer: sem isso a pessoa acha que enviou e
      // fica esperando um e-mail que nao saiu. Sao 3 por minuto nesta rota.
      if (error?.status === 429) {
        setErro("Muitas tentativas. Espere um minuto e tente de novo.")
        return
      }

      // Qualquer outro resultado vira a mesma tela de sucesso, inclusive
      // e-mail inexistente. Diferenciar transformaria esta tela num detector
      // de quem tem conta aqui - e conta em app de financas e informacao que
      // nao deveria vazar para quem so tem o endereco.
      setEnviado(true)
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
          {enviado ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <MailCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">Verifique seu e-mail</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Se existir uma conta com <span className="font-medium text-text">{email}</span>,
                  enviamos um link para escolher uma nova senha. Ele vale por 1 hora.
                </p>
                <p className="mt-3 text-sm text-muted">
                  Sua senha atual continua funcionando até você escolher outra.
                </p>
              </div>
              <Link
                to="/login"
                className="block text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">Esqueceu a senha?</h1>
                <p className="mt-2 text-sm text-muted">
                  Informe seu e-mail e enviamos um link para escolher uma nova.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
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
                  {carregando ? "Enviando..." : "Enviar link"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted">
                Lembrou?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                >
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
