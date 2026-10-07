import { Sun, Moon, Flower2, Terminal } from "lucide-react"
import { Link } from "react-router-dom"
import { useTheme, type Theme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth.store"

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "pink", label: "Tema rosa", icon: Flower2 },
  { value: "tech", label: "Tema terminal", icon: Terminal },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const user = useAuthStore(state => state.user)

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <div
        role="group"
        aria-label="Selecionar tema"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1"
      >
        {themes.map(({ value, label, icon: Icon }) => {
          const active = theme === value
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={active}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "bg-primary text-primary-fg shadow"
                  : "text-muted hover:bg-surface hover:text-text"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      {user && <Link to="/configuracoes#suporte" className="text-xs text-primary underline underline-offset-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Quer sugerir um tema? Envie sua ideia pelo suporte
      </Link>}
    </div>
  )
}
