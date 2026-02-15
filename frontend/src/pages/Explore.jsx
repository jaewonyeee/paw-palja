import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate, MOOD_MAP } from '../utils/date'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function publicFeed(limit = 20, offset = 0) {
  const res = await fetch(`${BASE}/social/feed?limit=${limit}&offset=${offset}&include_mine=false`)
  if (!res.ok) throw new Error('Feed fetch failed')
  return res.json()
}

function safeText(obj, field, lang) {
  if (!obj) return ''
  const candidates = [obj[`${field}_${lang}`], obj[field], obj[`${field}_ko`], obj[`${field}_en`]]
  for (const v of candidates) {
    if (v && typeof v === 'string' && v !== 'None' && v.trim()) return v
  }
  return ''
}

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export default function Explore() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 20

  const fetchFeed = useCallback(async (offset = 0, append = false) => {
    try {
      const data = await publicFeed(LIMIT, offset)
      const items = data.items || []
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
    fetchFeed()
  }, [fetchFeed])

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchFeed(entries.length, true)
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/mascot/burti/burti-mini.png" alt="Burti" style={styles.logoImg} />
          <h1 style={styles.headerTitle}>{t('common.appName', '버티')}</h1>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.langPill}>
            <LanguageToggle />
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            style={styles.loginBtn}
          >
            {t('auth.login', '로그인')}
          </motion.button>
        </div>
      </div>

      {/* Hero Banner */}
      <div style={styles.heroBanner}>
        <div style={styles.heroRow}>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={styles.heroContent}
          >
            <h2 style={styles.heroTitle}>{t('explore.heroTitle', '댕댕이들의 하루를 만나보세요')}</h2>
            <p style={styles.heroSubtitle}>{t('explore.heroSubtitle', 'AI가 분석한 운세, 건강, 그리고 귀여운 댓글까지')}</p>
          </motion.div>
          <motion.img
            src="/mascot/burti/burti-happy.png"
            alt="Burti"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            style={styles.heroMascot}
          />
        </div>
        <div style={styles.heroChips}>
          {[
            { icon: '🔮', label: t('diary.horoscope', '운세') },
            { icon: '🩺', label: t('diary.health', '건강') },
            { icon: '💬', label: t('diary.comments', '댓글') },
          ].map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              style={styles.heroChip}
            >
              {c.icon} {c.label}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="page-content" style={styles.content}>
        {loading ? (
          <div style={styles.loadingWrap}><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.emptyState}
          >
            <img src="/mascot/burti/burti-sad.png" alt="Burti" style={{ width: 80, height: 80, objectFit: 'contain', opacity: 0.7 }} />
            <p style={styles.emptyText}>{t('social.emptyFeed', '아직 공개된 일기가 없어요')}</p>
          </motion.div>
        ) : (
          <div style={styles.feedList}>
            {entries.map((item, i) => {
              // Insert CTA card after every 4th item
              const cards = []
              cards.push(
                <motion.div
                  key={item.entry_id || i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i < 8 ? i * 0.06 : 0 }}
                >
                  <ExploreFeedCard item={item} lang={i18n.language} t={t} navigate={navigate} />
                </motion.div>
              )
              if ((i + 1) % 5 === 0 && i < entries.length - 1) {
                cards.push(
                  <motion.div
                    key={`cta-${i}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    style={styles.ctaBanner}
                  >
                    <div style={styles.ctaBannerInner}>
                      <img src="/mascot/burti/burti-celebrate.png" alt="Burti" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                      <div>
                        <p style={styles.ctaBannerTitle}>{t('explore.ctaTitle', '내 반려견의 운세도 궁금하다면?')}</p>
                        <p style={styles.ctaBannerDesc}>{t('explore.ctaDesc', 'AI가 매일 분석해주는 맞춤 일기를 만나보세요')}</p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('/signup')}
                      style={styles.ctaBannerBtn}
                    >
                      {t('explore.ctaButton', '무료로 시작하기')}
                    </motion.button>
                  </motion.div>
                )
              }
              return cards
            })}
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

      {/* Bottom CTA bar */}
      <div style={styles.bottomBar}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/signup')}
          style={styles.bottomCta}
        >
          {t('explore.joinButton', '3초 만에 시작하기')}
        </motion.button>
        <button onClick={() => navigate('/login')} style={styles.bottomLogin}>
          {t('auth.loginExisting', '이미 계정이 있어요')}
        </button>
      </div>
    </motion.div>
  )
}

function ExploreFeedCard({ item, lang, t, navigate }) {
  const diary = item.diary || {}
  const user = item.user || {}
  const horoscope = item.horoscope || {}
  const date = formatDate(item.date || new Date().toISOString())
  const moodIcon = MOOD_MAP[diary.mood_icon] || '✨'
  const title = safeText(diary, 'title', lang) || t('diary.todayDiary', '오늘의 일기')
  const content = safeText(diary, 'content', lang)
  const summary = safeText(horoscope, 'summary', lang)
  const isAnonymous = user.is_anonymous
  const nickname = isAnonymous ? t('social.anonymousUser', '익명 사용자') : (user.nickname || '')
  const dogName = isAnonymous ? t('social.anonymousDog', '익명멍') : (user.dog_name || '')
  const dogImage = user.dog_image

  const handleClick = () => {
    if (item.share_token) navigate(`/share/${item.share_token}`)
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      style={styles.feedCard}
    >
      {/* User row */}
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
            {content.slice(0, 120)}{content.length > 120 ? '...' : ''}
          </p>
        )}
      </div>

      {/* Fortune preview */}
      {summary && (
        <div style={styles.fortunePreview}>
          <span>🔮</span>
          <span style={styles.fortuneText}>{summary.slice(0, 60)}{summary.length > 60 ? '...' : ''}</span>
        </div>
      )}

      {/* Stats + AI comment hint */}
      <div style={styles.feedFooter}>
        <div style={styles.feedStats}>
          {item.like_count > 0 && <span style={styles.feedStat}>❤️ {item.like_count}</span>}
          {item.comments_count > 0 && (
            <span style={styles.feedStat}>🤖 AI 댓글 {item.comments_count}개</span>
          )}
          {item.user_comments_count > 0 && (
            <span style={styles.feedStat}>💬 {item.user_comments_count}</span>
          )}
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

  /* Header */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(255,248,240,0.92)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-light)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoImg: {
    width: 32,
    height: 32,
    objectFit: 'contain',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    transform: 'scale(0.85)',
    transformOrigin: 'right center',
  },
  loginBtn: {
    padding: '7px 16px',
    background: 'var(--bg-purple)',
    color: 'white',
    border: 'none',
    borderRadius: 100,
    fontSize: '0.78rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
  },

  /* Hero */
  heroBanner: {
    background: 'linear-gradient(135deg, var(--bg-purple) 0%, var(--bg-purple-light) 100%)',
    padding: '16px 20px 16px',
  },
  heroRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  heroContent: {
    flex: 1,
    marginBottom: 12,
  },
  heroMascot: {
    width: 72,
    height: 72,
    objectFit: 'contain',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'white',
    lineHeight: 1.35,
    letterSpacing: '-0.03em',
  },
  heroSubtitle: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  heroChips: {
    display: 'flex',
    gap: 6,
  },
  heroChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.18)',
    borderRadius: 100,
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
  },

  /* Content */
  content: { flex: 1 },
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
    height: '50%',
    gap: 8,
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
  },

  /* Feed list */
  feedList: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  feedCard: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
    cursor: 'pointer',
    border: '1.5px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.3s ease',
  },
  feedUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
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
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  feedBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  feedTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  feedTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  feedContent: {
    fontSize: '0.8rem',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },

  /* Fortune preview */
  fortunePreview: {
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

  /* Footer stats */
  feedFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--border-light)',
  },
  feedStats: {
    display: 'flex',
    gap: 12,
  },
  feedStat: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },

  /* CTA Banner */
  ctaBanner: {
    background: 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 50%, #DDD6FE 100%)',
    borderRadius: 'var(--radius-md)',
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  ctaBannerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  ctaBannerTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'white',
  },
  ctaBannerDesc: {
    fontSize: '0.72rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  ctaBannerBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255,255,255,0.92)',
    color: '#6C5CE7',
    border: 'none',
    borderRadius: 12,
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  /* Bottom CTA bar */
  bottomBar: {
    padding: '10px 16px',
    paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
  },
  bottomCta: {
    width: '100%',
    padding: '14px',
    background: 'var(--bg-purple)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.92rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(108,92,231,0.35)',
  },
  bottomLogin: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: '4px 8px',
  },

  /* Load more */
  loadMoreWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '8px 0 16px',
  },
}
