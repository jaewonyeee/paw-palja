import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { api } from '../api'
import { todayString } from '../utils/date'
import DiaryCard from '../components/DiaryCard'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export default function Home({ user, navigate, onLogout }) {
  const [tab, setTab] = useState('home')
  const [diaries, setDiaries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDiaries = async () => {
    try {
      const data = await api.listDiaries(user.user_id)
      setDiaries(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchDiaries() }, [])

  const todayStr = todayString()
  const hasTodayDiary = diaries.some((d) => d.date === todayStr)

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Top header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatarWrap}>
            <span style={styles.avatar}>🐾</span>
          </div>
          <div>
            <div style={styles.tabs}>
              <button onClick={() => setTab('home')} style={{ ...styles.tabBtn, ...(tab === 'home' ? styles.tabActive : {}) }}>Home</button>
              <button onClick={() => setTab('entries')} style={{ ...styles.tabBtn, ...(tab === 'entries' ? styles.tabActive : {}) }}>Entries</button>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('profile')} style={styles.settingsBtn}>⚙️</button>
      </div>

      {/* Content */}
      <div className="page-content" style={styles.content}>
        {tab === 'home' ? (
          <HomeTab
            user={user}
            diaries={diaries}
            loading={loading}
            hasTodayDiary={hasTodayDiary}
            navigate={navigate}
          />
        ) : (
          <EntriesTab diaries={diaries} navigate={navigate} />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="tab-bar">
        <button className={`tab-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          Home
        </button>
        <button className="tab-item" onClick={() => navigate('new-diary')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
          New
        </button>
        <button className={`tab-item ${tab === 'entries' ? 'active' : ''}`} onClick={() => setTab('entries')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>
          Entries
        </button>
        <button className="tab-item" onClick={() => navigate('profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Profile
        </button>
      </div>
    </motion.div>
  )
}

function HomeTab({ user, diaries, loading, hasTodayDiary, navigate }) {
  const today = new Date()
  const greeting = today.getHours() < 12 ? '좋은 아침이에요' : today.getHours() < 18 ? '좋은 오후에요' : '좋은 저녁이에요'
  const todayDiary = diaries.find((d) => d.date === todayString())

  return (
    <div style={styles.homeTab}>
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={styles.greetingCard}
      >
        <div style={styles.greetingTop}>
          <div>
            <p style={styles.greetingSmall}>{greeting} 🌤️</p>
            <h2 style={styles.greetingName}>{user.dog?.name || '멍멍이'}의 하루</h2>
          </div>
          <div style={styles.dateBadge}>
            <span style={styles.dateBadgeDay}>{today.getDate()}</span>
            <span style={styles.dateBadgeMonth}>{today.getMonth() + 1}월</span>
          </div>
        </div>
      </motion.div>

      {/* Today's diary or CTA */}
      {loading ? (
        <div style={styles.loadingWrap}><div className="spinner" /></div>
      ) : todayDiary ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <DiaryCard entry={todayDiary} onClick={() => navigate('diary-detail', todayDiary)} isToday />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={styles.ctaCard}
        >
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{ fontSize: '3rem' }}
          >
            📝
          </motion.span>
          <h3 style={styles.ctaTitle}>오늘의 일기가 아직 없어요</h3>
          <p style={styles.ctaDesc}>{user.dog?.name || '멍멍이'}의 오늘 하루를 기록해볼까요?</p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
            onClick={() => navigate('new-diary')}
          >
            오늘의 일기 만들기
          </motion.button>
        </motion.div>
      )}

      {/* Recent entries */}
      {diaries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 style={styles.sectionTitle}>최근 일기</h3>
          {diaries.slice(0, 5).map((entry, i) => (
            <motion.div
              key={entry.entry_id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
            >
              <DiaryCard entry={entry} onClick={() => navigate('diary-detail', entry)} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function EntriesTab({ diaries, navigate }) {
  if (!diaries.length) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: '3rem', opacity: 0.3 }}>📖</span>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>아직 일기가 없어요</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <h3 style={styles.sectionTitle}>모든 일기 ({diaries.length})</h3>
      {diaries.map((entry, i) => (
        <motion.div
          key={entry.entry_id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <DiaryCard entry={entry} onClick={() => navigate('diary-detail', entry)} />
        </motion.div>
      ))}
    </div>
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
    padding: '12px 20px',
    background: 'rgba(255,248,240,0.92)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-light)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    background: 'var(--bg-card)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid var(--border-card)',
  },
  avatar: { fontSize: '1.1rem' },
  tabs: {
    display: 'flex',
    gap: 2,
    background: 'rgba(240,160,75,0.08)',
    borderRadius: 10,
    padding: 2,
  },
  tabBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'white',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    border: 'none',
    background: 'var(--bg-card)',
    borderRadius: 10,
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  homeTab: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  greetingCard: {
    background: 'linear-gradient(135deg, var(--bg-purple) 0%, var(--bg-purple-light) 100%)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 22px',
  },
  greetingTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingSmall: {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 500,
  },
  greetingName: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: 'white',
    marginTop: 2,
  },
  dateBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    padding: '8px 14px',
  },
  dateBadgeDay: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'white',
    lineHeight: 1,
  },
  dateBadgeMonth: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
  },
  ctaCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    boxShadow: 'var(--shadow-card)',
    border: '1.5px solid var(--border-card)',
  },
  ctaTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  ctaDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  sectionTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
    marginTop: 4,
  },
  loadingWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: 40,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60%',
    gap: 8,
  },
}
