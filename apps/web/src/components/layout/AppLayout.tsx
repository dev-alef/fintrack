import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'

export default function AppLayout() {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f1a' }}>
      {/* Sidebar - drawer no mobile */}
      <Sidebar isMobile={isMobile} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Overlay escuro quando menu aberto no mobile */}
      {isMobile && menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90,
        }} />
      )}

      <main style={{
        marginLeft: isMobile ? 0 : 220,
        flex: 1,
        padding: isMobile ? '16px' : 32,
        paddingTop: isMobile ? 70 : 32,
        color: '#fff',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}>
        {/* Header mobile com botão de menu */}
        {isMobile && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 56,
            background: '#1a1a2e', borderBottom: '1px solid #2a2a3e',
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, zIndex: 80,
          }}>
            <button onClick={() => setMenuOpen(true)} style={{
              background: 'transparent', border: 'none', color: '#fff',
              fontSize: 24, cursor: 'pointer', padding: 4,
            }}>☰</button>
            <h1 style={{ color: '#6366f1', fontSize: 18, margin: 0 }}>💰 FinTrack</h1>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
