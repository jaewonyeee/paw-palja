import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { todayString } from '../utils/date'
import DiaryCard from '../components/DiaryCard'
import GuideOverlay from '../components/GuideOverlay'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [diaries, setDiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('pawpalja_guide_seen')) {
      setShowGuide(true)
    }
  }, [])

  const fetchDiaries = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listDiaries()
      setDiaries(data)
    } catch (err) {
      setError(err.message || t('common.error'))
    }
    setLoading(false)
  }

  useEffect(() => { fetchDiaries() }, [])

  const todayStr = todayString()
  const hasTodayDiary = diaries.some((d) => d.date === todayStr)

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Service Guide Overlay */}
      <AnimatePresence>
        {showGuide && <GuideOverlay onClose={() => setShowGuide(false)} />}
      </AnimatePresence>

      {/* Top header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatarWrap}>
            {user.dog?.image ? (
              <img src={user.dog.image} alt="" style={styles.avatarImg} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<img src="/mascot/burti/burti-mini.png" alt="Burti" style="width:100%;height:100%;object-fit:cover" />' }} />
            ) : (
              <img src="/mascot/burti/burti-mini.png" alt="Burti" style={styles.avatarImg} />
            )}
          </div>
          <h1 style={styles.headerTitle}>{t('common.appName', '버티')}</h1>
        </div>
        <button onClick={() => navigate('/profile')} style={styles.settingsBtn}>⚙️</button>
      </div>

      {/* Content */}
      <div className="page-content" style={styles.content}>
        {error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: '#E74C3C', marginBottom: 16 }}>{error}</p>
            <button
              onClick={fetchDiaries}
              className="btn btn-primary"
              style={{ padding: '10px 24px' }}
            >
              {t('common.retry', '다시 시도')}
            </button>
          </div>
        ) : (
          <HomeTab
            user={user}
            diaries={diaries}
            loading={loading}
            hasTodayDiary={hasTodayDiary}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="tab-bar">
        <button className="tab-item active" onClick={() => navigate('/home')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          {t('home.tabHome', 'Home')}
        </button>
        <button className="tab-item tab-fab" onClick={() => navigate('/diary/new')}>
          <div className="tab-fab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </div>
        </button>
        <button className="tab-item" onClick={() => navigate('/social')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          {t('social.feed', '소셜')}
        </button>
        <button className="tab-item" onClick={() => navigate('/profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {t('profile.title')}
        </button>
      </div>
    </motion.div>
  )
}

function HomeTab({ user, diaries, loading, hasTodayDiary }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const today = new Date()
  const greeting = today.getHours() < 12
    ? t('home.greetingMorning', '좋은 아침이에요')
    : today.getHours() < 18
    ? t('home.greetingAfternoon', '좋은 오후에요')
    : t('home.greetingEvening', '좋은 저녁이에요')
  const todayDiary = diaries.find((d) => d.date === todayString())

  const visibleDiaries = showAll ? diaries : diaries.slice(0, 5)

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
          <div style={{ flex: 1 }}>
            <p style={styles.greetingSmall}>{greeting}</p>
            <h2 style={styles.greetingName}>{t('home.dailyTitle', '{{name}}의 하루', { name: user.dog?.name || t('home.defaultDogName', '멍멍이') })}</h2>
          </div>
          <img src="/mascot/burti/burti-hello.png" alt="Burti" style={styles.greetingMascot} />
        </div>
      </motion.div>

      {/* Quick mood selector */}
      {!loading && !todayDiary && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={styles.quickMoodCard}
        >
          <p style={styles.quickMoodLabel}>{t('home.howIsToday', '오늘 기분은 어때요?')}</p>
          <div style={styles.quickMoodRow}>
            {[
              { icon: '🤩', label: t('diary.moodGreat', '최고') },
              { icon: '😊', label: t('diary.moodGood', '좋음') },
              { icon: '😐', label: t('diary.moodNeutral', '평범') },
              { icon: '😢', label: t('diary.moodSad', '우울') },
              { icon: '🤒', label: t('diary.moodSick', '아픔') },
            ].map((m, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.88 }}
                onClick={() => navigate('/diary/new', { state: { presetMood: i } })}
                style={styles.quickMoodBtn}
              >
                <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                <span style={styles.quickMoodText}>{m.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Today's diary or feature cards */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <motion.img
            src="/mascot/burti/burti-thinking.png"
            alt="Loading"
            style={{ width: 60, height: 60, objectFit: 'contain' }}
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        </div>
      ) : todayDiary ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <DiaryCard entry={todayDiary} onClick={() => navigate(`/diary/${todayDiary.entry_id}`, { state: { entry: todayDiary } })} isToday />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={styles.featureGrid}
        >
          {[
            { icon: '🔮', title: t('home.featureHoroscope', 'AI 운세'), desc: t('home.featureHoroscopeDesc', '매일 달라지는 맞춤 운세') },
            { icon: '🩺', title: t('home.featureHealth', '건강 분석'), desc: t('home.featureHealthDesc', '식사·산책·배변 AI 분석') },
            { icon: '💬', title: t('home.featureComments', 'AI 댓글'), desc: t('home.featureCommentsDesc', '개성 넘치는 AI 코멘트') },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/diary/new')}
              style={styles.featureCard}
            >
              <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
              <h4 style={styles.featureTitle}>{f.title}</h4>
              <p style={styles.featureDesc}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Recent entries */}
      {diaries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 style={styles.sectionTitle}>{t('home.recentDiaries')}</h3>
          {visibleDiaries.map((entry, i) => (
            <motion.div
              key={entry.entry_id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
            >
              <DiaryCard entry={entry} onClick={() => navigate(`/diary/${entry.entry_id}`, { state: { entry } })} />
            </motion.div>
          ))}
          {!showAll && diaries.length > 5 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              style={styles.viewAllWrap}
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowAll(true)}
                className="btn btn-secondary"
                style={styles.viewAllBtn}
              >
                {t('home.viewAllDiaries', '모든 일기 보기')} ({diaries.length})
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}
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
    width: 40,
    height: 40,
    background: 'var(--bg-card)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid var(--border-card)',
    overflow: 'hidden',
  },
  avatar: { fontSize: '1.2rem' },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
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
  greetingMascot: {
    width: 56,
    height: 56,
    objectFit: 'contain',
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))',
    flexShrink: 0,
  },
  /* Quick mood selector */
  quickMoodCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 18px',
    border: '1.5px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
  },
  quickMoodLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },
  quickMoodRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 4,
  },
  quickMoodBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '10px 4px',
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border-light)',
    borderRadius: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  quickMoodText: {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  /* Feature grid (empty state) */
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  featureCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
    border: '1.5px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
  },
  featureTitle: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  featureDesc: {
    fontSize: '0.65rem',
    lineHeight: 1.4,
    color: 'var(--text-muted)',
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
  viewAllWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  viewAllBtn: {
    width: '100%',
  },
}
