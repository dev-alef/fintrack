import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Layout compartilhado dos documentos legais (Termos de Uso, Política de
 * Privacidade). Pública de propósito, sem exigir sessão: quem está decidindo
 * se cria conta precisa conseguir ler antes de se cadastrar, e o link do
 * rodapé do cadastro roda antes de haver sessão nenhuma.
 *
 * `<article>` com `prose` proprio (nao a extensao @tailwindcss/typography,
 * que o projeto nao instala) - poucas regras, o suficiente para paragrafo,
 * titulo de secao e lista lerem bem em texto corrido.
 */
export function DocumentoLegal({
  titulo,
  vigencia,
  children,
}: {
  titulo: string
  vigencia: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="flex items-center justify-between p-4">
        <Link to="/login" className="flex items-center gap-3">
          <Logo size={32} />
          <span className="text-lg font-semibold tracking-tight text-text">Provisão</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-[720px] px-6 pb-24">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">{titulo}</h1>
        <p className="mt-2 text-sm text-muted">Vigente desde {vigencia}.</p>

        <div
          className="
            mt-10 space-y-5 text-[15px] leading-relaxed text-text
            [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text
            [&_h2:first-child]:mt-0
            [&_p]:text-text
            [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
            [&_strong]:font-semibold
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
          "
        >
          {children}
        </div>
      </div>
    </div>
  )
}
