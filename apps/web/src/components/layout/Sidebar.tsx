import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'

const links = [
  { to: '/dashboard', label: '📊 Dashboard' },
  { to: '/transactions', label: '💸 Transações' },
  { to: '/investments', label: '💎 Investimentos' },
  { to: '/goals', label: '🎯 Metas' },
  { to: '/insights', label: '🤖 Insights IA' },
]

interface SidebarProps {
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  // No mobile, esconde a sidebar quando fechada
  const translateX = isMobile && !isOpen ? '-100%' : '0'

  return (
    <aside style={{
      width: 220, background: '#1a1a2e', height: '100vh',
      display: 'flex', flexDirection: 'column', padding: '24px 16px',
      position: 'fixed', left: 0, top: 0, overflowY: 'auto',
      transform: `translateX(${translateX})`,
      transition: 'transform 0.3s ease',
      zIndex: 100,
      boxSizing: 'border-box',
    }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: '#6366f1', fontSize: 22, margin: 0 }}>💰 FinTrack</h1>
          <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>{user?.name || 'Usuário'}</p>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#888',
            fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>✕</button>
        )}
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {links.map(link => (
          <NavLink key={link.to} to={link.to} onClick={isMobile ? onClose : undefined} style={({ isActive }) => ({
            padding: '12px 14px', borderRadius: 8, textDecoration: 'none',
            color: isActive ? '#fff' : '#aaa',
            background: isActive ? '#6366f1' : 'transparent',
            fontSize: 14, fontWeight: isActive ? 600 : 400,
          })}>{link.label}</NavLink>
        ))}
      </nav>
      <button onClick={() => { logout(); navigate('/login') }} style={{
        padding: '12px 14px', borderRadius: 8, border: 'none',
        background: 'transparent', color: '#888', cursor: 'pointer',
        textAlign: 'left', fontSize: 14,
      }}>
        🚪 Sair
      </button>
    </aside>
  )
}
