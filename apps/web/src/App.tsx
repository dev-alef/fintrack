import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ConfirmeSeuEmail from './pages/ConfirmeSeuEmail'
import EmailConfirmado from './pages/EmailConfirmado'
import EsqueciSenha from './pages/EsqueciSenha'
import NovaSenha from './pages/NovaSenha'
import DoisFatores from './pages/DoisFatores'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Goals from './pages/Goals'
import Insights from './pages/Insights'
import Investments from './pages/Investments'
import AppLayout from './components/layout/AppLayout'
import PrivateRoute from './components/PrivateRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Mesma tela: o desenho juntou entrar e criar conta em abas. A rota
          antiga continua valendo para quem tem link ou memoria dela. */}
      <Route path="/register" element={<Login />} />
      {/* Publicas de proposito: quem acabou de se cadastrar ainda nao tem sessao,
          e o link do e-mail costuma ser aberto em outro navegador. */}
      <Route path="/confirme-seu-email" element={<ConfirmeSeuEmail />} />
      <Route path="/email-confirmado" element={<EmailConfirmado />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/nova-senha" element={<NovaSenha />} />
      {/* Publica: quem chega aqui passou pela senha mas ainda NAO tem sessao -
          ela so nasce depois do segundo fator. */}
      <Route path="/dois-fatores" element={<DoisFatores />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="goals" element={<Goals />} />
        <Route path="investments" element={<Investments />} />
        <Route path="insights" element={<Insights />} />
        <Route path="configuracoes" element={<Settings />} />
      </Route>
    </Routes>
  )
}
