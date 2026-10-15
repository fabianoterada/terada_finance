import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="lancamentos" element={<ExpensesPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
