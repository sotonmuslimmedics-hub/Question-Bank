import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Banks from './pages/Banks'
import Quiz from './pages/Quiz'
import AdminContent from './pages/admin/AdminContent'
import AdminQuestions from './pages/admin/AdminQuestions'
import AdminUsers from './pages/admin/AdminUsers'

function Protected({ children, admin = false }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/banks" element={<Banks />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/admin" element={<Protected admin><AdminContent /></Protected>} />
        <Route path="/admin/questions" element={<Protected admin><AdminQuestions /></Protected>} />
        <Route path="/admin/users" element={<Protected admin><AdminUsers /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
