import { useState, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { User, Mail, Lock, Eye, EyeOff, Gift, Download, KeyRound } from "lucide-react"
import { signUp } from "../lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { GoogleButton } from "@/components/google-button"

function getPasswordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  if (pw.length < 6) return { score: 1, label: "Fraca" }
  if (pw.length < 8) return { score: 2, label: "Média" }
  if (hasUpper && hasNumber && hasSpecial) return { score: 4, label: "Forte" }
  if (hasUpper && hasNumber) return { score: 3, label: "Boa" }
  return { score: 2, label: "Média" }
}

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const { error: authError } = await signUp.email({
        email: form.email,
        password: form.password,
        name: form.name,
      })
      if (authError) throw new Error(authError.message || "Erro ao criar conta")
      navigate("/login")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || "Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  const strengthColor =
    strength.score === 1
      ? "bg-danger"
      : strength.score === 2
        ? "bg-warning"
        : strength.score >= 3
          ? "bg-success"
          : "bg-border"

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
            Comece grátis. Sem cartão de crédito.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary-fg/80">
            Leva menos de um minuto. Você já sai com o dashboard do mês pronto.
          </p>

          <ul className="mt-10 space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <Gift className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Plano gratuito para sempre</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <Download className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Exporte ou apague seus dados quando quiser</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fg/10 border border-primary-fg/15">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-medium leading-none">Autenticação em dois fatores disponível</p>
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
              <h2 className="text-2xl font-semibold tracking-tight text-text">Criar sua conta</h2>
              <p className="mt-2 text-sm text-muted">Comece a organizar suas finanças hoje.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="pl-10"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
              </div>

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
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
                    autoComplete="new-password"
                    className="pl-10 pr-10"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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

                {/* Strength indicator */}
                {form.password.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={
                            i < strength.score
                              ? `h-1.5 flex-1 rounded-full ${strengthColor}`
                              : "h-1.5 flex-1 rounded-full bg-border"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted">
                      Força da senha: <span className="font-medium text-text">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Criando..." : "Criar conta"}
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
              Já tem conta?{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
