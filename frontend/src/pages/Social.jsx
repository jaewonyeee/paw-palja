import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { formatDate, MOOD_MAP } from '../utils/date'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

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

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function Social() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 400)
  const LIMIT = 20

  const fetchFeed = useCallback(async (offset = 0, append = false, query = '') => {
    try {
      const data = await api.socialFeed(LIMIT, offset, query)
      const items = data.items || data || []
      if (append) {
        setEntries((prev) => [...prev, ...items])
      } else {
        setEntries(items)
      }
      setHasMore(items.length >= LIMIT)
    } catch {
      if (!append) setEntries([])
    }
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    setHasMore(true)
    fetchFeed(0, false, debouncedQuery)
  }, [debouncedQuery, fetchFeed])

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchFeed(entries.length, true, debouncedQuery)
  }

  const handleRefresh = () => {
    setLoading(true)
    setHasMore(true)
    fetchFeed(0, false, debouncedQuery)
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatarWrap}>
            <span style={styles.avatar}>🌍</span>
          </div>
          <h1 style={styles.headerTitle}>{t('social.feedTitle', '다른 댕댕이들의 하루')}</h1>
        </div>
        <button onClick={handleRefresh} style={styles.refreshBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('social.searchPlaceholder', '닉네임 또는 내용으로 검색...')}
          style={styles.searchInput}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={styles.searchClear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="page-content" style={styles.content}>
        {loading ? (
          <div style={styles.loadingWrap}><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.emptyState}
          >
            <span style={{ fontSize: '3rem', opacity: 0.3 }}>🐾</span>
            <p style={styles.emptyText}>{t('social.emptyFeed', '아직 공개된 일기가 없어요')}</p>
          </motion.div>
        ) : (
          <div style={styles.feedList}>
            {entries.map((item, i) => (
              <motion.div
                key={item.entry_id || i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i < 10 ? i * 0.06 : 0 }}
              >
                <FeedCard item={item} lang={i18n.language} t={t} navigate={navigate} />
              </motion.div>
            ))}
            {hasMore && (
              <div style={styles.loadMoreWrap}>
                {loadingMore ? (
                  <div className="spinner" />
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={loadMore}
                    className="btn btn-secondary"
                  >
                    {t('common.loading', '더 보기')}
                  </motion.button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="tab-bar">
        <button className="tab-item" onClick={() => navigate('/home')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          {t('home.tabHome', 'Home')}
        </button>
        <button className="tab-item tab-fab" onClick={() => navigate('/diary/new')}>
          <div className="tab-fab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </div>
        </button>
        <button className="tab-item active" onClick={() => navigate('/social')}>
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

function FeedCard({ item, lang, t, navigate }) {
  const diary = item.diary || {}
  const user = item.user || {}
  const horoscope = item.horoscope || {}
  const date = formatDate(item.date || new Date().toISOString())
  const moodIcon = MOOD_MAP[diary.mood_icon] || '✨'
  const title = safeText(diary, 'title', lang) || t('diary.todayDiary', '오늘의 일기')
  const content = safeText(diary, 'content', lang)
  const isAnonymous = user.is_anonymous
  const nickname = isAnonymous ? t('social.anonymousUser', '익명 사용자') : (user.nickname || '')
  const dogName = isAnonymous ? t('social.anonymousDog', '익명멍') : (user.dog_name || '')
  const dogImage = user.dog_image

  const handleClick = () => {
    if (item.share_token) {
      navigate(`/share/${item.share_token}`)
    } else if (user.user_id) {
      navigate(`/profile/${user.user_id}`)
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      style={styles.feedCard}
    >
      {/* User info row */}
      <div style={styles.feedUserRow}>
        <div style={styles.feedAvatar}>
          {dogImage && !isAnonymous ? (
            <img src={dogImage} alt="" style={styles.feedAvatarImg} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="font-size:1rem">🐶</span>' }} />
          ) : (
            <span style={{ fontSize: '1rem' }}>{isAnonymous ? '🎭' : '🐶'}</span>
          )}
        </div>
        <div style={styles.feedUserInfo}>
          <span style={styles.feedNickname}>{nickname}</span>
          {dogName && <span style={styles.feedDogName}>{dogName}</span>}
        </div>
        <span style={styles.feedDate}>
          {t('home.monthSuffix', '{{month}}월', { month: date.month })} {date.day}
        </span>
      </div>

      {/* Content */}
      <div style={styles.feedBody}>
        <div style={styles.feedTitleRow}>
          <span style={{ fontSize: '1.1rem' }}>{moodIcon}</span>
          <h4 style={styles.feedTitle}>{title}</h4>
        </div>
        {content && (
          <p style={styles.feedContent}>
            {content.slice(0, 100)}{content.length > 100 ? '...' : ''}
          </p>
        )}
      </div>

      {/* Fortune preview */}
      {horoscope && safeText(horoscope, 'summary', lang) && (
        <div style={styles.fortuneTag}>
          <span>🔮</span>
          <span style={styles.fortuneText}>{safeText(horoscope, 'summary', lang).slice(0, 50)}{safeText(horoscope, 'summary', lang).length > 50 ? '...' : ''}</span>
        </div>
      )}

      {/* Stats */}
      <div style={styles.feedStats}>
        {item.like_count > 0 && (
          <span style={styles.feedStat}>❤️ {item.like_count}</span>
        )}
        {item.comments_count > 0 && (
          <span style={styles.feedStat}>🤖 {item.comments_count}</span>
        )}
        {item.user_comments_count > 0 && (
          <span style={styles.feedStat}>💬 {item.user_comments_count}</span>
        )}
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
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    border: 'none',
    background: 'var(--bg-card)',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  content: {
    flex: 1,
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
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
  },
  feedList: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  feedCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '16px 18px',
    cursor: 'pointer',
    border: '1.5px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.3s ease',
  },
  feedUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  feedAvatar: {
    width: 34,
    height: 34,
    background: 'var(--bg-card)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: '1.5px solid var(--border-light)',
  },
  feedAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  feedUserInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  feedNickname: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  feedDogName: {
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  feedDate: {
    fontSize: '0.72rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  feedBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  feedTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  feedTitle: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  feedContent: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
  fortuneTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    background: 'rgba(108,92,231,0.06)',
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  fortuneText: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
  },
  feedStats: {
    display: 'flex',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--border-light)',
  },
  feedStat: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  loadMoreWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '12px 0',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 20px',
    padding: '8px 14px',
    background: 'var(--bg-card)',
    borderRadius: 12,
    border: '1.5px solid var(--border-light)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  searchClear: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
}
