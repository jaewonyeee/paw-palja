import { Component, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'
import './i18n'

const Onboarding = lazy(() => import('./pages/Onboarding'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Home = lazy(() => import('./pages/Home'))
const NewDiary = lazy(() => import('./pages/NewDiary'))
const DiaryDetail = lazy(() => import('./pages/DiaryDetail'))
const Social = lazy(() => import('./pages/Social'))
const Profile = lazy(() => import('./pages/Profile'))
const Admin = lazy(() => import('./pages/Admin'))
const SharedDiary = lazy(() => import('./pages/SharedDiary'))
const PublicProfile = lazy(() => import('./pages/PublicProfile'))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>오류가 발생했습니다</h2>
          <p>페이지를 새로고침 해주세요.</p>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.75rem', textAlign: 'left', overflow: 'auto', maxHeight: 200 }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#FF9F43', color: '#fff', cursor: 'pointer', marginTop: 16 }}>
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )
}

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? '/home' : '/onboarding'} replace />
}

function AppRoutes() {
  return (
    <div className="app-frame">
      <Suspense fallback={<PageLoader />}>
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
            <Route path="/social" element={<Social />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
