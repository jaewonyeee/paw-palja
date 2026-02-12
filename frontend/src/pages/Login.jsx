import { useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.3 } },
}

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { handleLogin } = useAuth()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api.login({ user_id: userId.trim(), password })
      handleLogin(data)
      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>🐾</span>
        <h2 style={styles.title}>{t('auth.welcomeBack')}</h2>
        <p style={styles.subtitle}>{t('auth.loginSubtitle', '로그인하고 오늘의 일기를 확인하세요')}</p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>{t('auth.userId')}</label>
          <input
            className="input-field"
            type="text"
            placeholder={t('auth.userIdPlaceholder', '회원가입 시 발급된 아이디를 입력하세요')}
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setError('') }}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>{t('auth.password')}</label>
          <input
            className="input-field"
            type="password"
            placeholder={t('auth.passwordPlaceholder', '비밀번호를 입력하세요')}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.error}
          >
            {error}
          </motion.p>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', marginTop: 8 }}
        >
          {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : t('auth.login')}
        </motion.button>
      </form>

      <div style={styles.footer}>
        <span style={styles.footerText}>{t('auth.dontHaveAccount')}</span>
        <button onClick={() => navigate('/signup')} className="btn btn-ghost" style={{ color: '#6C5CE7', fontWeight: 700 }}>
          {t('auth.signup')}
        </button>
      </div>
    </motion.div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '60px 28px 28px',
    background: 'var(--bg-primary)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 36,
  },
  logo: { fontSize: '2.5rem' },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginTop: 12,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: 6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    paddingLeft: 4,
  },
  error: {
    fontSize: '0.82rem',
    color: '#E74C3C',
    textAlign: 'center',
    padding: '8px 12px',
    background: '#FDF2F2',
    borderRadius: 12,
  },
  footer: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
}
