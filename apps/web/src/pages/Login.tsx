import { useState, useEffect } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, Download, Bell, ShieldCheck } from "lucide-react"
import { signIn } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { GoogleButton } from "@/components/google-button"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // O Better Auth manda o navegador de volta para ca quando o fluxo do Google
  // falha do lado do servidor. Sem esta leitura a pessoa voltaria para a tela de
  // login sem explicacao nenhuma, achando que o clique nao funcionou.
  useEffect(() => {
    if (searchParams.get("erro") === "google") {
      setError("Não foi possível entrar com o Google. Tente novamente ou use e-mail e senha.")
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { error: authError } = await signIn.email({ email, password })
      if (authError) throw new Error(authError.message || "Erro ao fazer login")
      navigate("/dashboard")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || "Erro ao fazer login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 min-[780px]:grid-cols-2">
      {/* Brand panel */}
      <div
        style={{ background: "var(--brand-grad)" }}
        className="relative flex flex-col justify-between p-8 lg:p-12 text-primary-fg overflow-hidden min-h-[320px] min-[780px]:min-h-screen"
      >
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Logo size={36} className="bg-primary-fg text-primary" />
            <span className="text-lg font-semibold tracking-tight">Provisão</span>
          </div>

          <h1 className="text-3xl lg:text-[32px] font-bold leading-tight text-primary-fg">
            Suas finanças, finalmente sob controle.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary-fg/80">
            Cartões, contas fixas, metas e investimentos num lugar só — com análise inteligente do seu mês.
          </p>

          <ul className="mt-10 space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <Download className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Importe o extrato do banco em segundos</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Alertas antes da fatura vencer</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Seus dados criptografados e só seus</p>
              </div>
            </li>
          </ul>
        </div>

        <p className="hidden min-[780px]:block text-xs text-primary-fg/60">
          © {new Date().getFullYear()} Provisão — suas finanças sob controle.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col bg-bg">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
          <div className="w-full max-w-[400px] space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-text">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm text-muted">Entre para continuar de onde parou.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="relative flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleButton
                label="Continuar com Google"
                disabled={loading}
                onError={setError}
              />
            </form>

            <p className="text-center text-sm text-muted">
              Não tem conta?{" "}
              <Link to="/register" className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
                Criar agora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
