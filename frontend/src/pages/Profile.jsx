import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: 30, transition: { duration: 0.2 } },
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, handleLogout, handleUserUpdate } = useAuth()
  const dog = user.dog || {}
  const [editingTime, setEditingTime] = useState(false)
  const [hour, setHour] = useState(user.diary_time?.split(':')[0] || '09')
  const [minute, setMinute] = useState(user.diary_time?.split(':')[1] || '00')
  const [saving, setSaving] = useState(false)

  const handleSaveTime = async () => {
    setSaving(true)
    try {
      const updated = await api.updateUser(null, `${hour}:${minute}`)
      handleUserUpdate(updated)
      setEditingTime(false)
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/home')} className="btn btn-ghost">← {t('common.back')}</button>
        <h3 style={styles.headerTitle}>{t('profile.title')}</h3>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content" style={styles.content}>
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={styles.profileCard}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            style={styles.avatarBig}
          >
            {dog.image ? (
              <img src={dog.image} alt="dog" style={styles.avatarImg} />
            ) : (
              '🐾'
            )}
          </motion.div>
          <h2 style={styles.nickname}>{user.nickname}</h2>
          <p style={styles.userId}>@{user.user_id}</p>
        </motion.div>

        {/* Dog info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.dogInfo')}</h4>
            <button
              onClick={() => setEditingTime(!editingTime)}
              style={styles.editBtn}
            >
              {editingTime ? t('common.cancel') : t('profile.editTime')}
            </button>
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.name')}</span>
              <span style={styles.infoValue}>{dog.name || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.breed')}</span>
              <span style={styles.infoValue}>{dog.breed || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.mbti')}</span>
              <span style={styles.infoValue}>{dog.mbti || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('profile.diaryNotification')}</span>
              {editingTime ? (
                <div style={styles.timeEditRow}>
                  <select
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                    style={styles.timeSelect}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    style={styles.timeSelect}
                  >
                    {['00', '15', '30', '45'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveTime}
                    disabled={saving}
                    style={styles.saveBtn}
                  >
                    {saving ? '...' : '✓'}
                  </button>
                </div>
              ) : (
                <span style={styles.infoValue}>{user.diary_time || '09:00'}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Language Settings */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.languageSettings')}</h4>
          </div>
          <div style={styles.languageSelector}>
            <button
              onClick={() => i18n.changeLanguage('ko')}
              style={{
                ...styles.languageBtn,
                ...(i18n.language === 'ko' ? styles.languageBtnActive : {})
              }}
            >
              🇰🇷 {t('language.korean')}
            </button>
            <button
              onClick={() => i18n.changeLanguage('en')}
              style={{
                ...styles.languageBtn,
                ...(i18n.language === 'en' ? styles.languageBtnActive : {})
              }}
            >
              🇺🇸 {t('language.english')}
            </button>
          </div>
        </motion.div>

        {/* Menu items - admin only */}
        {user.user_id === 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={styles.menuSection}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin')}
              style={styles.menuItem}
            >
              <span style={styles.menuIcon}>🛠</span>
              <span style={styles.menuLabel}>{t('profile.adminDashboard')}</span>
              <span style={styles.menuArrow}>→</span>
            </motion.button>
          </motion.div>
        )}

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={styles.logoutWrap}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => { await api.logout(); handleLogout(); navigate('/onboarding'); }}
            style={styles.logoutBtn}
          >
            {t('auth.logout')}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  headerTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  content: {
    padding: '20px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  profileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '28px 20px',
    background: 'linear-gradient(135deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 'var(--radius-lg)',
  },
  avatarBig: {
    width: 72,
    height: 72,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nickname: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'white',
  },
  userId: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
  },
  card: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '18px 20px',
    border: '1.5px solid var(--border-light)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  editBtn: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    fontFamily: 'inherit',
  },
  timeEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  timeSelect: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--bg-purple)',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  infoLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  infoValue: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  // Menu
  menuSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
  },
  menuIcon: {
    fontSize: '1.2rem',
  },
  menuLabel: {
    flex: 1,
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  menuArrow: {
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
  },
  logoutWrap: {
    marginTop: 8,
  },
  logoutBtn: {
    width: '100%',
    padding: '14px',
    border: '1.5px solid #E74C3C',
    borderRadius: 'var(--radius-full)',
    background: 'transparent',
    color: '#E74C3C',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  // Language Settings
  languageSelector: {
    display: 'flex',
    gap: 8,
  },
  languageBtn: {
    flex: 1,
    padding: '12px',
    border: '1.5px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    background: 'white',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  languageBtnActive: {
    background: 'var(--bg-purple)',
    color: 'white',
    borderColor: 'var(--bg-purple)',
  },
}
