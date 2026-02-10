import { motion } from 'motion/react'
import { formatDate, MOOD_MAP } from '../utils/date'

export default function DiaryCard({ entry, onClick, isToday }) {
  const diary = entry.diary || {}
  const horoscope = entry.horoscope || {}
  const comments = entry.comments || []
  const date = formatDate(entry.date || new Date().toISOString())
  const moodIcon = MOOD_MAP[diary.mood_icon] || '✨'

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
          <span style={styles.cardDateMonth}>{date.month}월</span>
        </div>
        <span style={styles.cardDayBadge}>{date.dayName}요일</span>
        {isToday && <span style={styles.todayBadge}>TODAY</span>}
      </div>

      {/* Content */}
      <div style={styles.cardBody}>
        <div style={styles.cardTitleRow}>
          <span style={{ fontSize: '1.2rem' }}>{moodIcon}</span>
          <h4 style={styles.cardTitle}>{diary.title || '오늘의 일기'}</h4>
        </div>
        <p style={styles.cardContent}>
          {(diary.content || '').slice(0, 100)}{(diary.content || '').length > 100 ? '...' : ''}
        </p>

        {/* Fortune tag */}
        {horoscope.summary && (
          <div style={styles.fortuneTag}>
            <span>🔮</span>
            <span style={styles.fortuneText}>{horoscope.summary}</span>
          </div>
        )}

        {/* Comments preview */}
        {comments.length > 0 && (
          <div style={styles.commentPreview}>
            {comments.slice(0, 3).map((c, i) => (
              <span key={i} style={styles.commentAvatar}>{c.emoji}</span>
            ))}
            <span style={styles.commentCount}>{comments.length}개의 댓글</span>
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
