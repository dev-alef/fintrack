import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, Download, Bell, ShieldCheck } from "lucide-react"
import { signIn } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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

              <Button
                type="button"
                variant="outline"
                disabled
                title="Login com Google chega em breve — backend ainda não tem OAuth"
                className="w-full gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.42 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar com Google
              </Button>
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
