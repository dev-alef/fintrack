import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f1a' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: 32, color: '#fff' }}>
        <Outlet />
      </main>
    </div>
  )
}
