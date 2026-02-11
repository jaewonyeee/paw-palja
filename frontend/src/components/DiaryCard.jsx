import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { formatDate, MOOD_MAP } from '../utils/date'

// Safely get text: checks i18n fields, filters out Python "None" string and null
function safeText(obj, field, lang) {
  if (!obj) return ''
  const candidates = [
    obj[`${field}_${lang}`],
    obj[field],
    obj[`${field}_ko`],
    obj[`${field}_en`],
  ]
  for (const v of candidates) {
    if (v && typeof v === 'string' && v !== 'None' && v.trim()) return v
  }
  return ''
}

export default function DiaryCard({ entry, onClick, isToday }) {
  const { t, i18n } = useTranslation()
  const diary = entry.diary || {}
  const horoscope = entry.horoscope || {}
  const comments = entry.comments || []
  const date = formatDate(entry.date || new Date().toISOString())
  const moodIcon = MOOD_MAP[diary.mood_icon] || '✨'
  const lang = i18n.language

  const title = safeText(diary, 'title', lang) || t('diary.todayDiary', '오늘의 일기')
  const content = safeText(diary, 'content', lang)
  const summary = safeText(horoscope, 'summary', lang)

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ ...styles.diaryCard, ...(isToday ? styles.diaryCardToday : {}) }}
    >
      {/* Date badge */}
      <div style={styles.cardDateWrap}>
        <div style={styles.cardDate}>
          <span style={styles.cardDateNum}>{date.day}</span>
          <span style={styles.cardDateMonth}>{t('home.monthSuffix', '{{month}}월', { month: date.month })}</span>
        </div>
        <span style={styles.cardDayBadge}>{date.dayName}</span>
        {isToday && <span style={styles.todayBadge}>TODAY</span>}
      </div>

      {/* Content */}
      <div style={styles.cardBody}>
        <div style={styles.cardTitleRow}>
          <span style={{ fontSize: '1.2rem' }}>{moodIcon}</span>
          <h4 style={styles.cardTitle}>{title}</h4>
        </div>
        {content ? (
          <p style={styles.cardContent}>
            {content.slice(0, 100)}{content.length > 100 ? '...' : ''}
          </p>
        ) : (
          <p style={{ ...styles.cardContent, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {t('diary.noContent', '일기 내용이 아직 없어요')}
          </p>
        )}

        {/* Fortune tag */}
        {summary && (
          <div style={styles.fortuneTag}>
            <span>🔮</span>
            <span style={styles.fortuneText}>{summary}</span>
          </div>
        )}

        {/* Comments preview */}
        {comments.length > 0 && (
          <div style={styles.commentPreview}>
            {comments.slice(0, 3).map((c, i) => (
              <span key={i} style={styles.commentAvatar}>{c.emoji}</span>
            ))}
            <span style={styles.commentCount}>{t('diary.commentCount', '{{count}}개의 댓글', { count: comments.length })}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const styles = {
  diaryCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '16px 18px',
    marginBottom: 12,
    cursor: 'pointer',
    border: '1.5px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.3s ease',
  },
  diaryCardToday: {
    border: '2px solid var(--accent-amber)',
    boxShadow: 'var(--shadow-card)',
  },
  cardDateWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardDate: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
  },
  cardDateNum: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--accent-amber)',
    lineHeight: 1,
  },
  cardDateMonth: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  cardDayBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'var(--bg-card)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  todayBadge: {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: 'white',
    background: 'var(--bg-purple)',
    padding: '2px 8px',
    borderRadius: 6,
    marginLeft: 'auto',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  cardContent: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
  fortuneTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    background: 'rgba(108,92,231,0.06)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  fortuneText: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
  },
  commentPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  commentAvatar: {
    fontSize: '0.9rem',
    marginLeft: -2,
  },
  commentCount: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginLeft: 4,
  },
}
