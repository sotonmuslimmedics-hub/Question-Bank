import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Quiz from './pages/Quiz'
import Announcements from './pages/Announcements'
import Teach from './pages/Teach'
import Portfolio from './pages/Portfolio'
import Tracker from './pages/Tracker'
import ManageQuestions from './pages/admin/ManageQuestions'
import Structure from './pages/admin/Structure'
import People from './pages/admin/People'
import Tools from './pages/admin/Tools'

function Gate({ min, children }) {
  const { session, loading, recovering, isTeacher, isLead, isAdmin } = useAuth()
  if (loading) return <p className="p-8 text-center text-sm text-stone-400">Loading…</p>
  if (recovering) return <Navigate to="/reset-password" replace />
  if (!session) return <Navigate to="/login" replace />
  const ok = { teacher: isTeacher, lead: isLead, admin: isAdmin }[min] ?? true
  return ok ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Gate><Layout /></Gate>}>
        <Route index element={<Home />} />
        <Route path="practice" element={<Practice />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="teach" element={<Gate min="teacher"><Teach /></Gate>} />
        <Route path="portfolio" element={<Gate min="teacher"><Portfolio /></Gate>} />
        <Route path="tracker" element={<Gate min="teacher"><Tracker /></Gate>} />
        <Route path="manage/questions" element={<Gate min="lead"><ManageQuestions /></Gate>} />
        <Route path="manage/structure" element={<Gate min="admin"><Structure /></Gate>} />
        <Route path="manage/people" element={<Gate min="admin"><People /></Gate>} />
        <Route path="manage/tools" element={<Gate min="admin"><Tools /></Gate>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
