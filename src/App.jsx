import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { isSupabaseConfigured } from './lib/supabase.js'
import Layout from './components/layout/Layout.jsx'
import Logo from './components/common/Logo.jsx'
import Spinner from './components/common/Spinner.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SetupPage from './pages/SetupPage.jsx'

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <Logo />
      <Spinner size={26} />
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <SetupPage />
  if (loading) return <SplashScreen />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={session ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<DashboardPage />} />
        <Route path="lancamentos" element={<ExpensesPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
    </Routes>
  )
}
