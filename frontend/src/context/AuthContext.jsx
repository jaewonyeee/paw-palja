import { createContext, useContext, useState, useEffect } from 'react'
import { clearTokens } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('pawpalja_user')
    const hasToken = !!localStorage.getItem('pawpalja_access_token')
    if (saved && hasToken) {
      try {
        const u = JSON.parse(saved)
        if (u && u.user_id && u.nickname && u.dog) {
          setUser(u)
        } else {
          localStorage.removeItem('pawpalja_user')
          clearTokens()
        }
      } catch {
        localStorage.removeItem('pawpalja_user')
        clearTokens()
      }
    } else {
      // No token means no valid session
      localStorage.removeItem('pawpalja_user')
      clearTokens()
    }
    setLoading(false)
  }, [])

  // Listen for forced logout (e.g. token refresh failure)
  useEffect(() => {
    const onForceLogout = () => {
      setUser(null)
      localStorage.removeItem('pawpalja_user')
      clearTokens()
    }
    window.addEventListener('auth:logout', onForceLogout)
    return () => window.removeEventListener('auth:logout', onForceLogout)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('pawpalja_user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('pawpalja_user')
    clearTokens()
  }

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('pawpalja_user', JSON.stringify(updatedUser))
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, handleLogin, handleLogout, handleUserUpdate }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
