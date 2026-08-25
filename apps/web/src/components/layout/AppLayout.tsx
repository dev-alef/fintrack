import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Menu } from "lucide-react"
import Sidebar from "./Sidebar"
import { Logo } from "../logo"
import { useIsMobile } from "../../hooks/useIsMobile"
import { cn } from "@/lib/utils"

export default function AppLayout() {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar - drawer no mobile */}
      <Sidebar isMobile={isMobile} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Overlay escuro quando menu aberto no mobile */}
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[90] bg-black/60"
          aria-hidden="true"
        />
      )}

      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isMobile ? "ml-0" : "ml-[220px]"
        )}
      >
        {/* Header mobile com botão de menu */}
        {isMobile && (
          <div className="fixed left-0 right-0 top-0 z-[80] flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <h1 className="m-0 text-lg font-semibold text-primary">Provisão</h1>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex-1 bg-bg text-text",
            isMobile ? "p-4 pt-[70px]" : "p-8"
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
