import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import html2canvas from 'html2canvas'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
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
  const { addToast } = useToast()
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
  const streamingRef = useRef(false)
  const captureRef = useRef(null)
  const [capturing, setCapturing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareModal, setShareModal] = useState(false)
  const [shareToken, setShareToken] = useState(entry?.share_token || null)
  const [isPublic, setIsPublic] = useState(entry?.is_public || false)

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
      const TIMEOUT_MS = 10000
      const canvasPromise = html2canvas(captureRef.current, {
        backgroundColor: '#FFF8F0',
        scale: 2,
        useCORS: true,
        foreignObjectRendering: false,
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      )
      const canvas = await Promise.race([canvasPromise, timeoutPromise])
      const dataUrl = canvas.toDataURL('image/png')

      // Only attempt Web Share file sharing on mobile (touch) devices.
      // Desktop browsers (especially Windows 10) can hang on navigator.share({ files }).
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      if (isMobile && navigator.share && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `pawpalja-${activeSection}.png`, { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            const shareTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('share_timeout')), 8000)
            )
            await Promise.race([
              navigator.share({ files: [file], title: 'Paw-Palja' }),
              shareTimeout,
            ])
            setCapturing(false)
            return
          }
        } catch (shareErr) {
          // Share cancelled or timed out — fall through to download
          if (shareErr?.name === 'AbortError') {
            setCapturing(false)
            return
          }
        }
      }

      // Fallback: download (append to body for Firefox compatibility)
      const link = document.createElement('a')
      link.download = `pawpalja-${activeSection}-${entry.date || 'today'}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      if (err?.message === 'timeout') {
        addToast(t('diary.captureTimeout'), 'error')
      } else {
        addToast(t('diary.captureError'), 'error')
      }
    }
    setCapturing(false)
  }, [activeSection, entry?.date, capturing, addToast, t])

  const handleShare = async () => {
    setSharing(true)
    try {
      if (isPublic) {
        await api.unshareDiary(entry.entry_id)
        setIsPublic(false)
        setShareToken(null)
        setShareModal(false)
      } else {
        const res = await api.shareDiary(entry.entry_id)
        setShareToken(res.share_token)
        setIsPublic(true)
        setShareModal(true)
      }
    } catch (err) {
      addToast(err.message, 'error')
    }
    setSharing(false)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/share/${shareToken}`
    navigator.clipboard.writeText(url).then(() => {
      addToast(t('social.linkCopied'), 'success')
    }).catch(() => {
      // Fallback
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      addToast(t('social.linkCopied'), 'success')
    })
  }

  const handleNativeShare = async () => {
    const url = `${window.location.origin}/share/${shareToken}`
    if (navigator.share) {
      try {
        await navigator.share({ title: t('common.appName'), url })
      } catch { /* user cancelled */ }
    }
  }

  // Sync share state when entry updates
  useEffect(() => {
    if (entry) {
      setShareToken(entry.share_token || null)
      setIsPublic(entry.is_public || false)
    }
  }, [entry?.entry_id, entry?.share_token])

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

  const diary = entry?.diary || {}
  const horoscope = entry?.horoscope || {}
  const health = entry?.health || {}
  const comments = entry?.comments || []

  const dateStr = dateLabel(entry?.date)

  // Show existing comments, then start SSE for new ones.
  // Fallback: if SSE fails or no comments arrive within timeout, poll the API.
  useEffect(() => {
    if (!entry) return
    setVisibleComments(comments.length > 0 ? [...comments] : [])

    if (comments.length === 0 && entry.entry_id && !streamingRef.current) {
      streamingRef.current = true
      setStreaming(true)
      let receivedAny = false
      let fallbackTimer = null

      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }

      // Fallback: if no SSE comment arrives within 15s, poll the API for saved comments
      fallbackTimer = setTimeout(() => {
        if (!receivedAny && streamingRef.current) {
          console.warn('SSE comment timeout — falling back to API poll')
          if (esRef.current) { esRef.current.close(); esRef.current = null }
          const pollForComments = (attempts = 0) => {
            api.getDiary(entry.entry_id).then((fresh) => {
              if (fresh.comments && fresh.comments.length > 0) {
                setVisibleComments(fresh.comments)
                setStreaming(false)
                streamingRef.current = false
              } else if (attempts < 5) {
                setTimeout(() => pollForComments(attempts + 1), 5000)
              } else {
                setStreaming(false)
                streamingRef.current = false
              }
            }).catch(() => {
              setStreaming(false)
              streamingRef.current = false
            })
          }
          pollForComments()
        }
      }, 15000)

      esRef.current = api.streamComments(
        entry.entry_id,
        (comment) => {
          // Validate comment is not empty (check both text_ko and text_en)
          const hasText = (comment.text_ko && comment.text_ko.trim()) ||
                          (comment.text_en && comment.text_en.trim()) ||
                          (comment.text && comment.text.trim())
          if (comment && hasText) {
            receivedAny = true
            if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
            setVisibleComments((prev) => [...prev, comment])
            setNewCommentAlert(true)
            setTimeout(() => setNewCommentAlert(false), 2000)
          }
        },
        () => {
          if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
          setStreaming(false)
          streamingRef.current = false
        },
      )
    }

    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      streamingRef.current = false
    }
  }, [entry?.entry_id])

  const handleEdit = async () => {
    if (!editText.trim()) return
    setEditSaving(true)
    try {
      const result = await api.editDiary(entry.entry_id, {
        original_diary: getLangText(diary, 'content'),
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
      streamingRef.current = true
      let editReceivedAny = false
      const editFallbackTimer = setTimeout(() => {
        if (!editReceivedAny && streamingRef.current) {
          console.warn('SSE edit comment timeout — falling back to API poll')
          if (esRef.current) { esRef.current.close(); esRef.current = null }
          const poll = (attempts = 0) => {
            api.getDiary(entry.entry_id).then((fresh) => {
              if (fresh.comments && fresh.comments.length > 0) {
                setVisibleComments(fresh.comments)
                setStreaming(false)
                streamingRef.current = false
              } else if (attempts < 5) {
                setTimeout(() => poll(attempts + 1), 5000)
              } else {
                setStreaming(false)
                streamingRef.current = false
              }
            }).catch(() => { setStreaming(false); streamingRef.current = false })
          }
          poll()
        }
      }, 15000)
      esRef.current = api.streamComments(
        entry.entry_id,
        (comment) => {
          const hasText = (comment.text_ko && comment.text_ko.trim()) ||
                          (comment.text_en && comment.text_en.trim()) ||
                          (comment.text && comment.text.trim())
          if (comment && hasText) {
            editReceivedAny = true
            clearTimeout(editFallbackTimer)
            setVisibleComments((prev) => [...prev, comment])
            setNewCommentAlert(true)
            setTimeout(() => setNewCommentAlert(false), 2000)
          }
        },
        () => { clearTimeout(editFallbackTimer); setStreaming(false); streamingRef.current = false },
        'edit',
      )
    } catch (err) {
      addToast(t('diary.editError') + err.message, 'error')
    }
    setEditSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteDiary(entry.entry_id)
      navigate('/home')
    } catch (err) {
      addToast(t('diary.deleteError') + err.message, 'error')
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
        {/* Section pills — scroll to section */}
        <div style={styles.sectionTabs}>
          {[
            { id: 'diary', label: `📖 ${t('diary.title')}` },
            { id: 'fortune', label: `🔮 ${t('diary.horoscope')}` },
            { id: 'health', label: `🩺 ${t('diary.health')}` },
          ].map((s) => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveSection(s.id)
                document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
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
                    <img src={entry.photo} alt="diary" style={styles.diaryPhotoImg} onError={(e) => { e.target.style.display = 'none' }} />
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
                        {t('diary.cancelEdit')}
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className="btn btn-primary"
                        onClick={handleEdit}
                        disabled={editSaving}
                        style={{ flex: 1 }}
                      >
                        {editSaving ? <div className="spinner" style={{ width: 18, height: 18 }} /> : t('diary.saveEdit')}
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
                      {isPublic && (
                        <span style={styles.publicBadge}>{t('social.public', '공개')}</span>
                      )}
                    </div>
                    <div style={styles.postActionRight}>
                      <button
                        onClick={handleShare}
                        disabled={sharing}
                        style={styles.shareBtn}
                        title={isPublic ? t('social.unshare') : t('diary.share')}
                      >
                        {sharing ? '...' : isPublic ? '🔗' : '↗'}
                      </button>
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
                          setEditText(getLangText(diary, 'content'))
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        style={styles.dropdownItem}
                      >
                        ✏️ {t('diary.editDiaryBtn')}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm(true)
                          setShowMenu(false)
                        }}
                        style={{ ...styles.dropdownItem, color: '#E74C3C' }}
                      >
                        🗑️ {t('diary.deleteDiary')}
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
                      <p style={styles.confirmText}>{t('diary.deleteConfirmTitle')}</p>
                      <p style={styles.confirmSub}>{t('diary.deleteConfirmMsg')}</p>
                      <div style={styles.confirmBtns}>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleting}
                          style={styles.confirmCancel}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          style={styles.confirmDelete}
                        >
                          {deleting ? t('diary.deleting') : t('common.delete')}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Share modal */}
              <AnimatePresence>
                {shareModal && isPublic && shareToken && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={styles.overlay}
                    onClick={() => setShareModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      style={styles.confirmBox}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p style={styles.confirmText}>{t('social.shareReady')}</p>
                      <div style={styles.shareLinkBox}>
                        <span style={styles.shareLinkText}>
                          {`${window.location.origin}/share/${shareToken}`}
                        </span>
                      </div>
                      <div style={styles.confirmBtns}>
                        <button onClick={handleCopyLink} style={styles.confirmCancel}>
                          {t('social.copyLink')}
                        </button>
                        {navigator.share && (
                          <button onClick={handleNativeShare} style={styles.confirmDelete}>
                            {t('social.shareVia')}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleShare}
                        disabled={sharing}
                        style={{ ...styles.confirmCancel, marginTop: 8, color: '#E74C3C', borderColor: '#E74C3C', width: '100%' }}
                      >
                        {t('social.unshare')}
                      </button>
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
                      <span>{t('diary.loadingComments')}</span>
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
                {capturing ? t('common.loading') : `📸 ${t('diary.capture')} / ${t('diary.share')}`}
              </motion.button>

              {/* FORTUNE Section — inline accordion */}
              {getLangText(horoscope, 'summary') && (
                <div id="section-fortune" style={styles.accordionSection}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(activeSection === 'fortune' ? 'diary' : 'fortune')}
                    style={styles.accordionHeader}
                  >
                    <div style={styles.accordionHeaderLeft}>
                      <span style={{ fontSize: '1.3rem' }}>🔮</span>
                      <h4 style={styles.accordionTitle}>{t('diary.horoscope')}</h4>
                    </div>
                    <div style={styles.accordionRight}>
                      <span style={styles.accordionSummary}>{getLangText(horoscope, 'summary').slice(0, 30)}...</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', transform: activeSection === 'fortune' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                  </motion.button>
                  <AnimatePresence>
                    {activeSection === 'fortune' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={styles.accordionBody}>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* HEALTH Section — inline accordion */}
              {(getLangText(health, 'conclusion') || health.risk_level) && (
                <div id="section-health" style={styles.accordionSection}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(activeSection === 'health' ? 'diary' : 'health')}
                    style={styles.accordionHeader}
                  >
                    <div style={styles.accordionHeaderLeft}>
                      <span style={{ fontSize: '1.3rem' }}>🩺</span>
                      <h4 style={styles.accordionTitle}>{t('diary.health')}</h4>
                    </div>
                    <div style={styles.accordionRight}>
                      {health.risk_level && (
                        <span style={{
                          ...styles.riskBadgeMini,
                          background: (RISK_COLORS[health.risk_level] || RISK_COLORS.Low).bg,
                          color: (RISK_COLORS[health.risk_level] || RISK_COLORS.Low).color,
                        }}>
                          {t(`health.${health.risk_level.toLowerCase()}`, health.risk_level)}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', transform: activeSection === 'health' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                  </motion.button>
                  <AnimatePresence>
                    {activeSection === 'health' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={styles.accordionBody}>
                          {[
                            { label: t('health.symptomAnalysis'), field: 'symptom_analysis', color: '#6B8F5E' },
                            { label: t('health.durationContext'), field: 'duration_context', color: '#F0A04B' },
                            { label: t('health.breedContext'), field: 'breed_context', color: '#E8A690' },
                            { label: t('health.conclusion'), field: 'conclusion', color: '#A8D5BA' },
                          ].map((step, i) => {
                            const stepContent = getLangText(health, step.field)
                            return stepContent && (
                              <div key={i} style={{ ...styles.cotStep, borderLeftColor: step.color }}>
                                <span style={styles.cotLabel}>{step.label}</span>
                                <p style={styles.cotContent}>{stepContent}</p>
                              </div>
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
                                ) : hospitals.length > 0 ? t('common.close') : `🏥 ${t('diary.findHospital')}`}
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

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
  publicBadge: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'white',
    background: '#27AE60',
    padding: '2px 8px',
    borderRadius: 6,
  },
  postActionRight: {
    display: 'flex',
    alignItems: 'center',
  },
  shareBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 8,
    fontFamily: 'inherit',
  },
  shareLinkBox: {
    padding: '10px 14px',
    background: 'var(--bg-card)',
    borderRadius: 10,
    marginBottom: 16,
    wordBreak: 'break-all',
  },
  shareLinkText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
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
  riskBadgeMini: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 100,
    fontSize: '0.68rem',
    fontWeight: 700,
  },
  /* Accordion sections */
  accordionSection: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
    marginTop: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  accordionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  accordionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  accordionSummary: {
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  accordionBody: {
    padding: '0 16px 16px',
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
