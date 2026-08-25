import { Sun, Moon, Flower2 } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "pink", label: "Tema rosa", icon: Flower2 },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Selecionar tema"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1",
        className
      )}
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
  )
}
