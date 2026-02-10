import { useState, useEffect, Component } from 'react'
import { AnimatePresence } from 'motion/react'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import NewDiary from './pages/NewDiary'
import DiaryDetail from './pages/DiaryDetail'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import './App.css'

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

function App() {
  const [page, setPage] = useState('onboarding')
  const [user, setUser] = useState(null)
  const [selectedDiary, setSelectedDiary] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('pawpalja_user')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        if (u && u.user_id && u.nickname && u.dog) {
          setUser(u)
          setPage('home')
        } else {
          localStorage.removeItem('pawpalja_user')
        }
      } catch {
        localStorage.removeItem('pawpalja_user')
      }
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('pawpalja_user', JSON.stringify(userData))
    setPage('home')
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('pawpalja_user')
    setPage('onboarding')
  }

  const navigate = (p, data) => {
    if (data) setSelectedDiary(data)
    setPage(p)
  }

  return (
    <ErrorBoundary>
      <div className="app-frame">
        <AnimatePresence mode="wait">
          {page === 'onboarding' && (
            <Onboarding key="onboarding" onStart={() => setPage('login')} />
          )}
          {page === 'login' && (
            <Login key="login" onLogin={handleLogin} onGoSignup={() => setPage('signup')} />
          )}
          {page === 'signup' && (
            <Signup key="signup" onSignup={handleLogin} onGoLogin={() => setPage('login')} />
          )}
          {page === 'home' && user && (
            <Home key="home" user={user} navigate={navigate} onLogout={handleLogout} />
          )}
          {page === 'new-diary' && user && (
            <NewDiary key="new-diary" user={user} navigate={navigate} />
          )}
          {page === 'diary-detail' && user && selectedDiary && (
            <DiaryDetail key="diary-detail" user={user} entry={selectedDiary} navigate={navigate} />
          )}
          {page === 'profile' && user && (
            <Profile key="profile" user={user} onLogout={handleLogout} navigate={navigate} />
          )}
          {page === 'admin' && user?.user_id === 'admin' && (
            <Admin key="admin" navigate={navigate} />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}

export default App
