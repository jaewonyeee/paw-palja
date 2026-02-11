import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 30, transition: { duration: 0.3 } },
}

export default function PublicProfile() {
  const { t, i18n } = useTranslation()
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getPublicProfile(userId)
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId])

  const getLangText = (obj, field) => {
    if (!obj) return ''
    const lang = i18n.language
    return obj[`${field}_${lang}`] || obj[field] || obj[`${field}_ko`] || obj[`${field}_en`] || ''
  }

  if (loading) {
    return (
      <motion.div {...pageTransition} style={styles.container}>
        <div style={styles.center}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </motion.div>
    )
  }

  if (error || !profile) {
    return (
      <motion.div {...pageTransition} style={styles.container}>
        <div style={styles.center}>
          <span style={{ fontSize: '3rem' }}>404</span>
          <p style={styles.errorText}>{t('social.profileNotFound')}</p>
          <button onClick={() => navigate('/onboarding')} className="btn btn-primary" style={{ marginTop: 16 }}>
            {t('social.goHome')}
          </button>
        </div>
      </motion.div>
    )
  }

  const dog = profile.dog || {}
  const diaries = profile.public_diaries || []

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.brand}>{t('common.appName')}</span>
      </div>

      <div className="page-content" style={styles.content}>
        {/* Profile card */}
        <div style={styles.profileCard}>
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            style={styles.avatar}
          >
            {dog.image ? (
              <img src={dog.image} alt="dog" style={styles.avatarImg} />
            ) : '🐾'}
          </motion.div>
          <h2 style={styles.nickname}>{profile.nickname}</h2>
          <p style={styles.userId}>@{profile.user_id}</p>
          {profile.bio && <p style={styles.bio}>{profile.bio}</p>}
          {dog.name && (
            <div style={styles.dogInfo}>
              <span>{dog.name}</span>
              <span style={styles.dogBreed}>{dog.breed}</span>
              {dog.mbti && <span style={styles.dogMbti}>{dog.mbti}</span>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{profile.public_diary_count}</span>
            <span style={styles.statLabel}>{t('social.publicDiaries')}</span>
          </div>
        </div>

        {/* Public diary list */}
        {diaries.length > 0 && (
          <div style={styles.diaryList}>
            <h4 style={styles.sectionTitle}>{t('social.recentDiaries')}</h4>
            {diaries.map((d) => (
              <motion.div
                key={d.entry_id}
                whileTap={{ scale: 0.98 }}
                onClick={() => d.share_token && navigate(`/share/${d.share_token}`)}
                style={styles.diaryItem}
              >
                <span style={styles.diaryDate}>{d.date}</span>
                <span style={styles.diaryTitle}>
                  {getLangText(d.diary, 'title') || t('diary.todayDiary')}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={styles.ctaCard}>
          <p style={styles.ctaText}>{t('social.ctaText')}</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {t('social.ctaButton')}
          </button>
        </div>
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
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    textAlign: 'center',
  },
  errorText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginTop: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
    background: 'rgba(255,248,240,0.95)',
    backdropFilter: 'blur(20px)',
  },
  brand: {
    fontSize: '0.95rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  content: {
    padding: '16px 20px 40px',
  },
  profileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '28px 20px',
    background: 'linear-gradient(135deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 16,
  },
  avatar: {
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
  bio: {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  dogInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.7)',
  },
  dogBreed: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  dogMbti: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '12px 24px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
  },
  statNum: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: 'var(--bg-purple)',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  diaryList: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 10,
  },
  diaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
    marginBottom: 8,
    cursor: 'pointer',
  },
  diaryDate: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  diaryTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  ctaCard: {
    padding: '24px 20px',
    background: 'linear-gradient(135deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'white',
    marginBottom: 14,
  },
}
