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

export default function SharedDiary() {
  const { t, i18n } = useTranslation()
  const { shareToken } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getSharedDiary(shareToken)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [shareToken])

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

  if (error || !data) {
    return (
      <motion.div {...pageTransition} style={styles.container}>
        <div style={styles.center}>
          <span style={{ fontSize: '3rem' }}>404</span>
          <p style={styles.errorText}>{t('social.sharedNotFound')}</p>
          <button onClick={() => navigate('/onboarding')} className="btn btn-primary" style={{ marginTop: 16 }}>
            {t('social.goHome')}
          </button>
        </div>
      </motion.div>
    )
  }

  const diary = data.diary || {}
  const horoscope = data.horoscope || {}
  const health = data.health || {}
  const comments = data.comments || []
  const author = data.author || {}

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.brand}>{t('common.appName')}</span>
        <span style={styles.viewCount}>{t('social.views', { count: data.view_count || 0 })}</span>
      </div>

      <div className="page-content" style={styles.content}>
        {/* Author info */}
        <div style={styles.authorCard}>
          <div style={styles.authorAvatar}>
            {author.dog?.image ? (
              <img src={author.dog.image} alt="dog" style={styles.authorAvatarImg} />
            ) : '🐾'}
          </div>
          <div>
            <p style={styles.authorName}>{author.nickname}</p>
            {author.dog?.name && (
              <p style={styles.authorDog}>{author.dog.name} ({author.dog.breed})</p>
            )}
          </div>
        </div>

        {/* Diary content */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={{ fontSize: '1.5rem' }}>
              {diary.mood_icon === 'heart' ? '❤️' : '✨'}
            </span>
            <h3 style={styles.cardTitle}>{getLangText(diary, 'title') || t('diary.todayDiary')}</h3>
          </div>

          {data.photo && (
            <div style={styles.photo}>
              <img src={data.photo} alt="diary" style={styles.photoImg} />
            </div>
          )}

          <p style={styles.cardText}>{getLangText(diary, 'content')}</p>
          <span style={styles.date}>{data.date}</span>
        </div>

        {/* Horoscope */}
        {horoscope.summary_ko || horoscope.summary_en || horoscope.summary ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{ fontSize: '1.5rem' }}>🔮</span>
              <h3 style={styles.cardTitle}>{t('diary.horoscope')}</h3>
            </div>
            <p style={{ ...styles.cardText, fontWeight: 600, color: 'var(--bg-purple)', marginBottom: 8 }}>
              {getLangText(horoscope, 'summary')}
            </p>
            <p style={styles.cardText}>{getLangText(horoscope, 'content')}</p>
          </div>
        ) : null}

        {/* Health */}
        {health.symptom_analysis_ko || health.symptom_analysis_en || health.symptom_analysis ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{ fontSize: '1.5rem' }}>🩺</span>
              <h3 style={styles.cardTitle}>{t('diary.health')}</h3>
            </div>
            <p style={styles.cardText}>{getLangText(health, 'conclusion')}</p>
            {getLangText(health, 'advice') && (
              <div style={styles.adviceBox}>
                <span>💊</span>
                <p style={styles.adviceText}>{getLangText(health, 'advice')}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Comments */}
        {comments.length > 0 && (
          <div style={styles.commentsSection}>
            <h4 style={styles.commentsTitle}>
              💬 {t('diary.comments')} <span style={styles.commentBadge}>{comments.length}</span>
            </h4>
            {comments.map((c, i) => (
              <div key={i} style={styles.commentItem}>
                <span style={{ fontSize: '1.2rem' }}>{c.emoji}</span>
                <div>
                  <span style={styles.commentAuthor}>{c.author}</span>
                  <p style={styles.commentText}>{getLangText(c, 'text')}</p>
                </div>
              </div>
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
    justifyContent: 'space-between',
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
  viewCount: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  content: {
    padding: '16px 20px 40px',
  },
  authorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    border: '1.5px solid var(--border-card)',
    marginBottom: 16,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--bg-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.3rem',
    overflow: 'hidden',
    flexShrink: 0,
  },
  authorAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  authorName: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  authorDog: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  card: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 16,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  cardText: {
    fontSize: '0.85rem',
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
  },
  photo: {
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid var(--border-light)',
  },
  photoImg: {
    width: '100%',
    maxHeight: 280,
    objectFit: 'cover',
    display: 'block',
  },
  date: {
    display: 'block',
    marginTop: 12,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  adviceBox: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    padding: '12px 14px',
    background: 'rgba(108,92,231,0.06)',
    borderRadius: 14,
  },
  adviceText: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  commentsSection: {
    marginBottom: 16,
  },
  commentsTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  commentBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'white',
    background: 'var(--bg-purple)',
    padding: '1px 7px',
    borderRadius: 10,
  },
  commentItem: {
    display: 'flex',
    gap: 10,
    padding: '10px 14px',
    background: 'white',
    borderRadius: 14,
    border: '1px solid var(--border-light)',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  commentText: {
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
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
