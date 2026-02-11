import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import html2canvas from 'html2canvas'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { dateLabel } from '../utils/date'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 30, transition: { duration: 0.3 } },
}

const RISK_COLORS = {
  Low: { bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50' },
  Medium: { bg: '#FFF8E1', color: '#F57F17', dot: '#FFC107' },
  High: { bg: '#FFEBEE', color: '#C62828', dot: '#F44336' },
  Critical: { bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
}

export default function DiaryDetail() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { entryId } = useParams()
  const { user } = useAuth()
  const initialEntry = location.state?.entry || null
  const [entry, setEntry] = useState(initialEntry)
  const [loadingEntry, setLoadingEntry] = useState(!initialEntry)
  const [activeSection, setActiveSection] = useState('diary')
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [visibleComments, setVisibleComments] = useState([])
  const [editSaving, setEditSaving] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [newCommentAlert, setNewCommentAlert] = useState(false)
  const [hospitals, setHospitals] = useState([])
  const [hospitalLoading, setHospitalLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const esRef = useRef(null)
  const captureRef = useRef(null)
  const [capturing, setCapturing] = useState(false)

  // Fetch entry from API (for deep links or to refresh stale data)
  useEffect(() => {
    if (entryId) {
      api.getDiary(entryId)
        .then((fresh) => {
          setEntry(fresh)
          setLoadingEntry(false)
        })
        .catch(() => {
          if (!initialEntry) navigate('/home', { replace: true })
          setLoadingEntry(false)
        })
    }
  }, [entryId])

  const handleCapture = useCallback(async () => {
    if (!captureRef.current || capturing) return
    setCapturing(true)
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#FFF8F0',
        scale: 2,
        useCORS: true,
      })
      const dataUrl = canvas.toDataURL('image/png')

      // Try Web Share API first (mobile)
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], `pawpalja-${activeSection}.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Paw-Palja' })
          setCapturing(false)
          return
        }
      }

      // Fallback: download
      const link = document.createElement('a')
      link.download = `pawpalja-${activeSection}-${entry.date || 'today'}.png`
      link.href = dataUrl
      link.click()
    } catch {
      /* ignore */
    }
    setCapturing(false)
  }, [activeSection, entry.date, capturing])

  const diary = entry.diary || {}
  const horoscope = entry.horoscope || {}
  const health = entry.health || {}
  const comments = entry.comments || []

  const dateStr = dateLabel(entry.date)

  // 🌐 Helper function: Get language-specific content
  const getLangText = (obj, field) => {
    if (!obj) return ''
    const currentLang = i18n.language
    // Try language-specific field first (_ko or _en)
    const langField = `${field}_${currentLang}`
    if (obj[langField]) return obj[langField]
    // Fallback to legacy field (for backward compatibility)
    if (obj[field]) return obj[field]
    // Final fallback to Korean version if exists
    if (obj[`${field}_ko`]) return obj[`${field}_ko`]
    // Last fallback to English version if exists
    if (obj[`${field}_en`]) return obj[`${field}_en`]
    return ''
  }

  // Show existing comments, then start SSE for new ones
  useEffect(() => {
    setVisibleComments(comments.length > 0 ? [...comments] : [])

    if (comments.length === 0 && entry.entry_id) {
      setStreaming(true)
      esRef.current = api.streamComments(
        entry.entry_id,
        (comment) => {
          // Validate comment is not empty (check both text_ko and text_en)
          const hasText = (comment.text_ko && comment.text_ko.trim()) ||
                          (comment.text_en && comment.text_en.trim()) ||
                          (comment.text && comment.text.trim())
          if (comment && hasText) {
            setVisibleComments((prev) => [...prev, comment])
            setNewCommentAlert(true)
            setTimeout(() => setNewCommentAlert(false), 2000)
          }
        },
        () => setStreaming(false),
      )
    }

    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [entry.entry_id])

  const handleEdit = async () => {
    if (!editText.trim()) return
    setEditSaving(true)
    try {
      const result = await api.editDiary(entry.entry_id, {
        original_diary: diary.content,
        edited_diary: editText,
        dog_name: user.dog?.name || '멍멍이',
        dog_breed: user.dog?.breed || '믹스견',
      })
      setEntry(result)
      setIsEditing(false)

      // 기존 댓글 모두 클리어하고 수정 반응 SSE 시작
      setVisibleComments([])
      setStreaming(true)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      esRef.current = api.streamComments(
        entry.entry_id,
        (comment) => {
          // Validate comment is not empty (check both text_ko and text_en)
          const hasText = (comment.text_ko && comment.text_ko.trim()) ||
                          (comment.text_en && comment.text_en.trim()) ||
                          (comment.text && comment.text.trim())
          if (comment && hasText) {
            setVisibleComments((prev) => [...prev, comment])
            setNewCommentAlert(true)
            setTimeout(() => setNewCommentAlert(false), 2000)
          }
        },
        () => setStreaming(false),
        'edit',
      )
    } catch (err) {
      alert(t('diary.editError') + err.message)
    }
    setEditSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteDiary(entry.entry_id)
      navigate('/home')
    } catch (err) {
      alert(t('diary.deleteError') + err.message)
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  if (loadingEntry || !entry) {
    return (
      <motion.div {...pageTransition} style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/home')} className="btn btn-ghost">← {t('common.back')}</button>
        <span style={styles.headerDate}>{dateStr}</span>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content" style={styles.content}>
        {/* Section tabs */}
        <div style={styles.sectionTabs}>
          {[
            { id: 'diary', label: `📖 ${t('diary.title')}`, icon: '📖' },
            { id: 'fortune', label: `🔮 ${t('diary.horoscope')}`, icon: '🔮' },
            { id: 'health', label: `🩺 ${t('diary.health')}`, icon: '🩺' },
          ].map((s) => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSection(s.id)}
              style={{ ...styles.sectionTab, ...(activeSection === s.id ? styles.sectionTabActive : {}) }}
            >
              {s.label}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* DIARY Section */}
          {activeSection === 'diary' && (
            <motion.div
              key="diary"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.3 }}
            >
              <div ref={captureRef}>
              {/* Diary card */}
              <div style={styles.diaryCard}>
                <div style={styles.diaryHeader}>
                  <span style={styles.diaryMoodIcon}>{diary.mood_icon === 'sparkles' ? '✨' : diary.mood_icon === 'heart' ? '❤️' : '✨'}</span>
                  <h3 style={styles.diaryTitle}>{getLangText(diary, 'title') || t('diary.todayDiary')}</h3>
                </div>

                {/* Photo */}
                {entry.photo && !isEditing && (
                  <div style={styles.diaryPhoto}>
                    <img src={entry.photo} alt="diary" style={styles.diaryPhotoImg} />
                  </div>
                )}

                {isEditing ? (
                  <div style={styles.editWrap}>
                    <textarea
                      className="input-field"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={6}
                    />
                    <div style={styles.editBtns}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setIsEditing(false)}
                        style={styles.editCancelBtn}
                      >
                        취소
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className="btn btn-primary"
                        onClick={handleEdit}
                        disabled={editSaving}
                        style={{ flex: 1 }}
                      >
                        {editSaving ? <div className="spinner" style={{ width: 18, height: 18 }} /> : '수정 완료'}
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <p style={styles.diaryContent}>{getLangText(diary, 'content')}</p>
                )}

                {getLangText(diary, 'meme_reference') && (
                  <div style={styles.memeRef}>
                    <span>💬</span> <span>{getLangText(diary, 'meme_reference')}</span>
                  </div>
                )}

                {/* Post action bar (inside card, like SNS) */}
                {!isEditing && (
                  <div style={styles.postActions}>
                    <div style={styles.postActionLeft}>
                      <span style={styles.postDate}>{dateStr}</span>
                    </div>
                    <div style={styles.postActionRight}>
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        style={styles.moreBtn}
                      >
                        ···
                      </button>
                    </div>
                  </div>
                )}

                {/* Dropdown menu */}
                <AnimatePresence>
                  {showMenu && !isEditing && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={styles.dropdownMenu}
                    >
                      <button
                        onClick={() => {
                          setEditText(diary.content || '')
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        style={styles.dropdownItem}
                      >
                        ✏️ 수정하기
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm(true)
                          setShowMenu(false)
                        }}
                        style={{ ...styles.dropdownItem, color: '#E74C3C' }}
                      >
                        🗑️ 삭제하기
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Delete confirmation */}
              <AnimatePresence>
                {deleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.overlay}
                    onClick={() => !deleting && setDeleteConfirm(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      style={styles.confirmBox}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p style={styles.confirmText}>이 일기를 삭제할까요?</p>
                      <p style={styles.confirmSub}>삭제하면 되돌릴 수 없어요.</p>
                      <div style={styles.confirmBtns}>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleting}
                          style={styles.confirmCancel}
                        >
                          취소
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          style={styles.confirmDelete}
                        >
                          {deleting ? '삭제 중...' : '삭제'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Comments Section */}
              <div style={styles.commentsSection}>
                <h4 style={styles.commentsTitle}>
                  💬 {t('diary.comments')} <span style={styles.commentCountBadge}>{visibleComments.length}</span>
                  {newCommentAlert && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      style={styles.newBadge}
                    >
                      {t('diary.newCommentAlert')}
                    </motion.span>
                  )}
                </h4>
                <div style={styles.commentsList}>
                  <AnimatePresence>
                    {visibleComments.map((c, i) => (
                      <motion.div
                        key={`${c.author}-${i}`}
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        style={styles.commentItem}
                      >
                        <div style={styles.commentAvatar}>{c.emoji}</div>
                        <div style={styles.commentBody}>
                          <span style={styles.commentAuthor}>{c.author}</span>
                          <p style={styles.commentText}>{getLangText(c, 'text')}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {streaming && (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={styles.typingIndicator}
                    >
                      <span>누군가 댓글을 쓰고 있어요</span>
                      <span style={styles.dots}>...</span>
                    </motion.div>
                  )}
                </div>
              </div>
              </div>{/* end captureRef */}

              {/* Capture/Share button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCapture}
                disabled={capturing}
                style={styles.captureBtn}
              >
                {capturing ? '저장 중...' : '📸 캡처 / 공유'}
              </motion.button>
            </motion.div>
          )}

          {/* FORTUNE Section */}
          {activeSection === 'fortune' && (
            <motion.div
              key="fortune"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.3 }}
            >
              <div ref={captureRef}>
              <div style={styles.fortuneCard}>
                <div style={styles.fortuneHeader}>
                  <span style={{ fontSize: '2rem' }}>🔮</span>
                  <h3 style={styles.fortuneTitle}>{t('diary.horoscope')}</h3>
                </div>
                <p style={styles.fortuneSummary}>{getLangText(horoscope, 'summary')}</p>
                <p style={styles.fortuneContent}>{getLangText(horoscope, 'content')}</p>

                <div style={styles.fortuneTags}>
                  {getLangText(horoscope, 'lucky_item') && (
                    <div style={styles.fTag}>
                      <span>🍀</span>
                      <span style={styles.fTagLabel}>{t('diary.luckyItem')}</span>
                      <span style={styles.fTagValue}>{getLangText(horoscope, 'lucky_item')}</span>
                    </div>
                  )}
                  {getLangText(horoscope, 'weather_context') && (
                    <div style={styles.fTag}>
                      <span>🌤️</span>
                      <span style={styles.fTagLabel}>{t('diary.weatherContext')}</span>
                      <span style={styles.fTagValue}>{getLangText(horoscope, 'weather_context')}</span>
                    </div>
                  )}
                  {getLangText(horoscope, 'trend_reference') && (
                    <div style={styles.fTag}>
                      <span>📈</span>
                      <span style={styles.fTagLabel}>{t('diary.trendReference')}</span>
                      <span style={styles.fTagValue}>{getLangText(horoscope, 'trend_reference')}</span>
                    </div>
                  )}
                  {getLangText(horoscope, 'interaction_hint') && (
                    <div style={styles.fTag}>
                      <span>💡</span>
                      <span style={styles.fTagLabel}>{t('diary.interactionHint')}</span>
                      <span style={styles.fTagValue}>{getLangText(horoscope, 'interaction_hint')}</span>
                    </div>
                  )}
                </div>
              </div>
              </div>{/* end captureRef */}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCapture}
                disabled={capturing}
                style={styles.captureBtn}
              >
                {capturing ? '저장 중...' : '📸 캡처 / 공유'}
              </motion.button>
            </motion.div>
          )}

          {/* HEALTH Section */}
          {activeSection === 'health' && (
            <motion.div
              key="health"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.3 }}
            >
              <div ref={captureRef}>
              <div style={styles.healthCard}>
                <div style={styles.healthHeader}>
                  <span style={{ fontSize: '2rem' }}>🩺</span>
                  <h3 style={styles.healthTitle}>{t('diary.health')}</h3>
                  {health.risk_level && (
                    <span style={{
                      ...styles.riskBadge,
                      background: (RISK_COLORS[health.risk_level] || RISK_COLORS.Low).bg,
                      color: (RISK_COLORS[health.risk_level] || RISK_COLORS.Low).color,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: (RISK_COLORS[health.risk_level] || RISK_COLORS.Low).dot,
                        display: 'inline-block',
                      }} />
                      {t(`health.${health.risk_level.toLowerCase()}`, health.risk_level)}
                    </span>
                  )}
                </div>

                {[
                  { label: t('health.symptomAnalysis'), field: 'symptom_analysis', color: '#6B8F5E' },
                  { label: t('health.durationContext'), field: 'duration_context', color: '#F0A04B' },
                  { label: t('health.breedContext'), field: 'breed_context', color: '#E8A690' },
                  { label: t('health.conclusion'), field: 'conclusion', color: '#A8D5BA' },
                ].map((step, i) => {
                  const content = getLangText(health, step.field)
                  return content && (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      style={{ ...styles.cotStep, borderLeftColor: step.color }}
                    >
                      <span style={styles.cotLabel}>{step.label}</span>
                      <p style={styles.cotContent}>{content}</p>
                    </motion.div>
                  )
                })}

                {getLangText(health, 'advice') && (
                  <div style={styles.adviceBox}>
                    <span>💊</span>
                    <p style={styles.adviceText}>{getLangText(health, 'advice')}</p>
                  </div>
                )}

                {health.risk_level && health.risk_level !== 'Low' && (
                  <div style={styles.hospitalSection}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-primary"
                      onClick={() => {
                        if (hospitals.length > 0) { setHospitals([]); return; }
                        setHospitalLoading(true)
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            try {
                              const res = await api.nearbyHospitals(pos.coords.latitude, pos.coords.longitude)
                              setHospitals(res.hospitals || [])
                            } catch { setHospitals([]) }
                            setHospitalLoading(false)
                          },
                          () => {
                            setHospitalLoading(false)
                            setHospitals([{ name: '위치 권한이 필요합니다', address: '브라우저 설정에서 위치 권한을 허용해주세요', phone: '', distance: '', url: '' }])
                          },
                        )
                      }}
                      style={{ width: '100%', marginTop: 12 }}
                      disabled={hospitalLoading}
                    >
                      {hospitalLoading ? (
                        <div className="spinner" style={{ width: 18, height: 18 }} />
                      ) : hospitals.length > 0 ? '닫기' : '🏥 근처 동물병원 찾기'}
                    </motion.button>

                    <AnimatePresence>
                      {hospitals.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={styles.hospitalList}
                        >
                          {hospitals.map((h, i) => (
                            <div key={i} style={styles.hospitalItem}>
                              <div style={styles.hospitalInfo}>
                                <span style={styles.hospitalName}>{h.name}</span>
                                <span style={styles.hospitalAddr}>{h.address}</span>
                                {h.phone && <span style={styles.hospitalPhone}>📞 {h.phone}</span>}
                                {h.distance && <span style={styles.hospitalDist}>📍 {h.distance}m</span>}
                              </div>
                              {h.url && (
                                <a href={h.url} target="_blank" rel="noopener noreferrer" style={styles.hospitalLink}>
                                  지도
                                </a>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              </div>{/* end captureRef */}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCapture}
                disabled={capturing}
                style={styles.captureBtn}
              >
                {capturing ? '저장 중...' : '📸 캡처 / 공유'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div style={styles.menuBackdrop} onClick={() => setShowMenu(false)} />
      )}
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
    background: 'rgba(255,248,240,0.95)',
    backdropFilter: 'blur(20px)',
  },
  headerDate: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  content: {
    padding: '16px 20px 40px',
  },
  sectionTabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 16,
    background: 'rgba(240,160,75,0.06)',
    borderRadius: 14,
    padding: 4,
  },
  sectionTab: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sectionTabActive: {
    background: 'white',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  // Diary
  diaryCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 20,
    position: 'relative',
  },
  diaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  diaryMoodIcon: { fontSize: '1.5rem' },
  diaryTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  diaryContent: {
    fontSize: '0.88rem',
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
  },
  diaryPhoto: {
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid var(--border-light)',
  },
  diaryPhotoImg: {
    width: '100%',
    maxHeight: 280,
    objectFit: 'cover',
    display: 'block',
  },
  memeRef: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    padding: '8px 12px',
    background: 'var(--bg-card)',
    borderRadius: 12,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  editedBadge: {
    display: 'inline-block',
    marginTop: 8,
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
    background: 'rgba(108,92,231,0.08)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  editWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  editBtns: {
    display: 'flex',
    gap: 8,
  },
  editCancelBtn: {
    color: 'var(--text-muted)',
  },
  // Post action bar (SNS style)
  postActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid var(--border-light)',
  },
  postActionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  postDate: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  postActionRight: {
    display: 'flex',
    alignItems: 'center',
  },
  moreBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: '1.2rem',
    fontWeight: 900,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 8,
    fontFamily: 'inherit',
    letterSpacing: 2,
  },
  // Dropdown
  dropdownMenu: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    background: 'white',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    border: '1px solid var(--border-light)',
    overflow: 'hidden',
    zIndex: 50,
    minWidth: 140,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 18px',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  // Delete confirmation
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  confirmBox: {
    background: 'white',
    borderRadius: 20,
    padding: '28px 24px 20px',
    maxWidth: 320,
    width: '100%',
    textAlign: 'center',
  },
  confirmText: {
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: 6,
  },
  confirmSub: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    marginBottom: 20,
  },
  confirmBtns: {
    display: 'flex',
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    padding: '12px',
    border: '1.5px solid var(--border-light)',
    borderRadius: 'var(--radius-full)',
    background: 'white',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  confirmDelete: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    background: '#E74C3C',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'white',
    cursor: 'pointer',
  },
  // Comments
  commentsSection: {
    marginBottom: 20,
  },
  commentsTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  commentCountBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'white',
    background: 'var(--bg-purple)',
    padding: '1px 7px',
    borderRadius: 10,
  },
  newBadge: {
    fontSize: '0.6rem',
    fontWeight: 800,
    color: 'white',
    background: '#FF6B6B',
    padding: '2px 6px',
    borderRadius: 6,
    marginLeft: 4,
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  commentItem: {
    display: 'flex',
    gap: 10,
    padding: '12px 14px',
    background: 'white',
    borderRadius: 16,
    border: '1px solid var(--border-light)',
  },
  commentAvatar: {
    fontSize: '1.4rem',
    flexShrink: 0,
  },
  commentBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  commentAuthor: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  commentText: {
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  editReactionBadge: {
    display: 'inline-block',
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--accent-amber)',
    background: 'rgba(240,160,75,0.1)',
    padding: '1px 6px',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '10px 14px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  dots: { fontWeight: 700, letterSpacing: 2 },
  // Capture button
  captureBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '12px',
    marginTop: 16,
    border: '1.5px solid var(--border-card)',
    borderRadius: 'var(--radius-full)',
    background: 'white',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  // Fortune
  fortuneCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-card)',
  },
  fortuneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  fortuneTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  fortuneSummary: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    marginBottom: 10,
  },
  fortuneContent: {
    fontSize: '0.88rem',
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    marginBottom: 16,
  },
  fortuneTags: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fTag: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 14px',
    background: 'var(--bg-card)',
    borderRadius: 14,
  },
  fTagLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minWidth: 40,
    flexShrink: 0,
  },
  fTagValue: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  // Health
  healthCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 20,
  },
  healthHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  healthTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    flex: 1,
  },
  riskBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 100,
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  cotStep: {
    padding: '10px 14px',
    marginBottom: 8,
    borderRadius: 12,
    background: 'var(--bg-card)',
    borderLeft: '3px solid',
  },
  cotLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'block',
    marginBottom: 3,
  },
  cotContent: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
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
  // Hospitals
  hospitalSection: {
    marginTop: 16,
  },
  hospitalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
    overflow: 'hidden',
  },
  hospitalItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: 'var(--bg-card)',
    borderRadius: 14,
  },
  hospitalInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  hospitalName: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  hospitalAddr: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
  },
  hospitalPhone: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  hospitalDist: {
    fontSize: '0.68rem',
    color: 'var(--bg-purple)',
    fontWeight: 600,
  },
  hospitalLink: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'white',
    background: 'var(--bg-purple)',
    padding: '6px 12px',
    borderRadius: 8,
    textDecoration: 'none',
    flexShrink: 0,
  },
}
