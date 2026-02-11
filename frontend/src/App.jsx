import { Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import NewDiary from './pages/NewDiary'
import DiaryDetail from './pages/DiaryDetail'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import SharedDiary from './pages/SharedDiary'
import PublicProfile from './pages/PublicProfile'
import './App.css'
import './i18n'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>오류가 발생했습니다</h2>
          <p>페이지를 새로고침 해주세요.</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#FF9F43', color: '#fff', cursor: 'pointer' }}>
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? '/home' : '/onboarding'} replace />
}

function AppRoutes() {
  return (
    <div className="app-frame">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/share/:shareToken" element={<SharedDiary />} />
        <Route path="/profile/:userId" element={<PublicProfile />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<Home />} />
          <Route path="/diary/new" element={<NewDiary />} />
          <Route path="/diary/:entryId" element={<DiaryDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
