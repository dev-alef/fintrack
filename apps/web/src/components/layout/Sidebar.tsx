import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, ArrowLeftRight, TrendingUp, Target, Sparkles, LogOut, X, Settings } from "lucide-react"
import { useAuthStore } from "../../store/auth.store"
import { signOut } from "../../lib/auth-client"
import { Logo } from "../logo"
import { ThemeToggle } from "../theme-toggle"
import { cn } from "@/lib/utils"

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { to: "/investments", label: "Investimentos", icon: TrendingUp },
  { to: "/goals", label: "Metas", icon: Target },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
]

interface SidebarProps {
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const { clear, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-[100] flex h-screen w-[220px] flex-col overflow-y-auto border-r border-border bg-surface p-6 transition-transform duration-300 ease-in-out",
        isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"
      )}
    >
      <div className="mb-8 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <h1 className="text-[22px] font-semibold tracking-tight text-primary">Provisão</h1>
          </div>
          <p className="text-xs text-muted">{user?.name || "Usuário"}</p>
        </div>
        {isMobile && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={isMobile ? onClose : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary font-semibold text-primary-fg"
                    : "font-normal text-muted hover:bg-surface-2 hover:text-text"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {link.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4 pt-6">
        <div className="flex justify-start">
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={async () => {
            // signOut apaga a sessao no servidor, e nao apenas no navegador:
            // depois disto o cookie deixa de valer para qualquer requisicao,
            // que era o que faltava no logout anterior.
            await signOut()
            clear()
            navigate("/login")
          }}
          className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-left text-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  )
}
