import { Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<div>Login — em breve</div>} />
      <Route path="/dashboard" element={<div>Dashboard — em breve</div>} />
      <Route path="/transactions" element={<div>Transacoes — em breve</div>} />
      <Route path="/goals" element={<div>Metas — em breve</div>} />
    </Routes>
  )
}

export default App
