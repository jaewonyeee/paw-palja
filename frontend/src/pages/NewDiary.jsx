import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 30, transition: { duration: 0.3 } },
}

export default function NewDiary() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const MOODS = [
    { value: '최고', icon: '🤩', label: t('mood.best') },
    { value: '좋음', icon: '😊', label: t('mood.good') },
    { value: '평범', icon: '😐', label: t('mood.justOk') },
    { value: '우울', icon: '😢', label: t('mood.depressed') },
    { value: '아픔', icon: '🤒', label: t('mood.sick') },
  ]

  const FOODS = [
    { value: '완식', icon: '🍖', label: t('food.allEaten') },
    { value: '보통', icon: '🥩', label: t('food.average') },
    { value: '조금', icon: '🦴', label: t('food.alittle') },
    { value: '안먹음', icon: '❌', label: t('food.didntEat') },
  ]

  const POOPS = [
    { value: '정상', icon: '✅', label: t('poop.normal') },
    { value: '묽음', icon: '💧', label: t('poop.watery') },
    { value: '딱딱함', icon: '🪨', label: t('poop.firm') },
    { value: '안함', icon: '⏳', label: t('poop.didnt') },
  ]

  const WALK_PRESETS = [
    { value: 0, label: t('walk.none') },
    { value: 15, label: t('walk.min15') },
    { value: 30, label: t('walk.min30') },
    { value: 60, label: t('walk.hour1') },
    { value: 90, label: t('walk.hour15') },
    { value: 120, label: t('walk.hour2plus') },
  ]

  // Steps configuration
  const STEPS = [
    { key: 'mood', question: t('diary.moodQuestion'), icon: '😊' },
    { key: 'food', question: t('diary.foodQuestion'), icon: '🍖' },
    { key: 'walk', question: t('diary.walkQuestion'), icon: '🐾' },
    { key: 'poop', question: t('diary.poopQuestion'), icon: '💩' },
    { key: 'notes', question: t('diary.notesQuestion'), icon: '📝' },
  ]

  const [step, setStep] = useState(0)
  const [mood, setMood] = useState('')
  const [food, setFood] = useState('')
  const [walk, setWalk] = useState(null)
  const [poop, setPoop] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState(null) // base64
  const [shareToSocial, setShareToSocial] = useState(user.auto_share_social || false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const photoRef = useRef(null)

  const dogName = user.dog?.name || t('home.defaultDogName', '멍멍이')

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1
  const totalSteps = STEPS.length

  const canProceed = () => {
    if (step === 0) return !!mood
    if (step === 1) return !!food
    if (step === 2) return walk !== null
    if (step === 3) return !!poop
    return true // notes is optional
  }

  const handleNext = () => {
    if (isLastStep) {
      handleGenerate()
    } else {
      setStep(step + 1)
    }
  }

  const pollIntervalRef = useRef(null)

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  const startProgressAnimation = useCallback(() => {
    setProgress(t('diary.analyzing', { name: dogName }))
    const progressSteps = [
      { text: t('diary.fortuneTelling', { name: dogName }), delay: 2000 },
      { text: t('diary.writingDiary', { name: dogName }), delay: 5000 },
      { text: t('diary.analyzingHealth', { name: dogName }), delay: 8000 },
    ]
    progressSteps.forEach(({ text, delay }) => {
      setTimeout(() => setProgress(text), delay)
    })
  }, [t, dogName])

  const pollJobStatus = useCallback((jobId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.checkDiaryJob(jobId)
        if (res.status === 'complete') {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
          setLoading(false)
          navigate(`/diary/${res.entry.entry_id}`, { state: { entry: res.entry } })
        } else if (res.status === 'failed') {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
          setLoading(false)
          addToast(t('diary.generationError') + (res.detail || 'Unknown error'), 'error')
        }
        // queued / in_progress -> keep polling
      } catch (err) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
        setLoading(false)
        addToast(t('diary.generationError') + err.message, 'error')
      }
    }, 2000)
  }, [navigate, t])

  const handleGenerate = async () => {
    setLoading(true)
    startProgressAnimation()

    try {
      const result = await api.generateDiary({
        mood, food, walk: String(walk || 0), poop, notes,
        share_to_social: shareToSocial,
        ...(photo ? { photo } : {}),
      })

      // Async task queue mode: server returned a job_id
      if (result.job_id) {
        pollJobStatus(result.job_id)
        return
      }

      // Synchronous mode: result is the full diary entry
      navigate(`/diary/${result.entry_id}`, { state: { entry: result } })
    } catch (err) {
      addToast(t('diary.generationError') + err.message, 'error')
    } finally {
      // Only clear loading for sync path; async path clears in poll callback
      if (!pollIntervalRef.current) {
        setLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <motion.div {...pageTransition} style={styles.loadingPage}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          style={styles.loadingIcon}
        >
          🐾
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.loadingText}
        >
          {progress}
        </motion.div>
        <div style={styles.progressBar}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 15, ease: 'linear' }}
            style={styles.progressFill}
          />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/home')} className="btn btn-ghost">
          ← {step > 0 ? t('auth.backBtn') : t('common.back')}
        </button>
        <span style={styles.stepCount}>{step + 1} / {totalSteps}</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Progress bar */}
      <div style={styles.stepProgressBar}>
        <motion.div
          animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={styles.stepProgressFill}
        />
      </div>

      {/* Step content */}
      <div style={styles.content}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            style={styles.stepContent}
          >
            {/* Question bubble */}
            <div style={styles.questionBubble}>
              <div style={styles.questionAvatar}>
                <span style={{ fontSize: '1.8rem' }}>{currentStep.icon}</span>
              </div>
              <div style={styles.bubbleContent}>
                <span style={styles.bubbleName}>{dogName}</span>
                <p style={styles.bubbleText}>{currentStep.question}</p>
              </div>
            </div>

            {/* Answer area */}
            <div style={styles.answerArea}>
              {step === 0 && (
                <div style={styles.chipGrid}>
                  {MOODS.map((m) => (
                    <motion.button
                      key={m.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setMood(m.value)}
                      style={{ ...styles.chip, ...(mood === m.value ? styles.chipActive : {}) }}
                    >
                      <span style={{ fontSize: '1.6rem' }}>{m.icon}</span>
                      <span style={styles.chipLabel}>{m.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div style={styles.chipGrid}>
                  {FOODS.map((f) => (
                    <motion.button
                      key={f.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setFood(f.value)}
                      style={{ ...styles.chip, ...(food === f.value ? styles.chipActive : {}) }}
                    >
                      <span style={{ fontSize: '1.6rem' }}>{f.icon}</span>
                      <span style={styles.chipLabel}>{f.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div style={styles.chipGrid}>
                  {WALK_PRESETS.map((w) => (
                    <motion.button
                      key={w.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setWalk(w.value)}
                      style={{ ...styles.chipWide, ...(walk === w.value ? styles.chipActive : {}) }}
                    >
                      <span style={styles.chipLabel}>{w.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div style={styles.chipGrid}>
                  {POOPS.map((p) => (
                    <motion.button
                      key={p.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setPoop(p.value)}
                      style={{ ...styles.chip, ...(poop === p.value ? styles.chipActive : {}) }}
                    >
                      <span style={{ fontSize: '1.6rem' }}>{p.icon}</span>
                      <span style={styles.chipLabel}>{p.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 4 && (
                <div style={styles.notesWrap}>
                  <textarea
                    className="input-field"
                    placeholder={t('diary.notesQuestion')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    style={{ resize: 'none' }}
                  />
                  {/* Photo attachment */}
                  <div style={styles.photoSection}>
                    {photo ? (
                      <div style={styles.photoPreviewWrap}>
                        <img src={photo} alt="diary" style={styles.photoPreview} />
                        <button
                          onClick={() => setPhoto(null)}
                          style={styles.photoRemoveBtn}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => photoRef.current?.click()}
                        style={styles.photoAddBtn}
                      >
                        📷 {t('diary.addPhoto')}
                      </motion.button>
                    )}
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 3 * 1024 * 1024) {
                          addToast(t('auth.imageSizeLimit'), 'error')
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = (ev) => setPhoto(ev.target.result)
                        reader.readAsDataURL(file)
                      }}
                    />
                  </div>
                  {/* Share to social toggle */}
                  <div style={styles.socialToggleWrap}>
                    <div style={styles.socialToggleInfo}>
                      <span style={styles.socialToggleLabel}>{t('social.shareToSocial', '소셜에 공유')}</span>
                      <span style={styles.socialToggleHint}>{t('social.shareToSocialHint', '소셜 피드에 이 일기를 공유합니다')}</span>
                    </div>
                    <button
                      onClick={() => setShareToSocial(!shareToSocial)}
                      style={{
                        ...styles.socialToggle,
                        background: shareToSocial ? 'var(--bg-purple)' : 'var(--border-light)',
                      }}
                    >
                      <span style={{
                        ...styles.socialToggleKnob,
                        transform: shareToSocial ? 'translateX(20px)' : 'translateX(0)',
                      }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Summary chips (show selected values for previous steps) */}
        {step > 0 && (
          <div style={styles.summaryRow}>
            {mood && <span style={styles.summaryChip}>{MOODS.find(m => m.value === mood)?.icon} {mood}</span>}
            {food && step > 1 && <span style={styles.summaryChip}>{FOODS.find(f => f.value === food)?.icon} {food}</span>}
            {walk !== null && step > 2 && <span style={styles.summaryChip}>🐾 {walk}분</span>}
            {poop && step > 3 && <span style={styles.summaryChip}>{POOPS.find(p => p.value === poop)?.icon} {poop}</span>}
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div style={styles.bottomBar}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary"
          onClick={handleNext}
          disabled={!canProceed() && !isLastStep}
          style={{
            width: '100%',
            padding: '16px 32px',
            fontSize: '1rem',
            opacity: (canProceed() || isLastStep) ? 1 : 0.5,
          }}
        >
          {isLastStep ? `✨ ${t('home.createTodayDiary')}` : t('auth.nextBtn')}
        </motion.button>
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
    padding: '12px 16px',
  },
  stepCount: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  stepProgressBar: {
    height: 3,
    background: 'var(--border-card)',
    marginBottom: 0,
  },
  stepProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 20px',
    overflow: 'auto',
  },
  stepContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  // Question bubble (chat style)
  questionBubble: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  questionAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--bg-purple-light), var(--bg-purple))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubbleContent: {
    background: 'white',
    borderRadius: '4px 18px 18px 18px',
    padding: '14px 18px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '80%',
  },
  bubbleName: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    display: 'block',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  // Answer area
  answerArea: {
    paddingLeft: 60,
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '14px 18px',
    borderRadius: 18,
    border: '1.5px solid rgba(240, 160, 75, 0.15)',
    background: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    minWidth: 64,
    outline: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    WebkitTapHighlightColor: 'transparent',
    WebkitAppearance: 'none',
    color: 'var(--text-primary)',
  },
  chipWide: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 20px',
    borderRadius: 18,
    border: '1.5px solid rgba(240, 160, 75, 0.15)',
    background: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    minWidth: 80,
    outline: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    WebkitTapHighlightColor: 'transparent',
    WebkitAppearance: 'none',
    color: 'var(--text-primary)',
  },
  chipActive: {
    background: 'var(--bg-purple)',
    border: '1.5px solid var(--bg-purple)',
    color: 'white',
    boxShadow: '0 2px 12px rgba(108,92,231,0.3)',
  },
  chipLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'inherit',
  },
  notesWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  photoSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  photoAddBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '12px 20px',
    border: '1.5px dashed rgba(240, 160, 75, 0.25)',
    borderRadius: 14,
    background: 'white',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    outline: 'none',
    WebkitAppearance: 'none',
  },
  photoPreviewWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1.5px solid var(--border-card)',
  },
  photoPreview: {
    width: '100%',
    maxHeight: 200,
    objectFit: 'cover',
    display: 'block',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Social toggle
  socialToggleWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'white',
    borderRadius: 14,
    border: '1.5px solid var(--border-light)',
    marginTop: 4,
  },
  socialToggleInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  socialToggleLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  socialToggleHint: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
  },
  socialToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    padding: 0,
    flexShrink: 0,
  },
  socialToggleKnob: {
    display: 'block',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s',
    marginTop: 3,
    marginLeft: 3,
  },
  // Summary row
  summaryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 20,
    paddingLeft: 60,
  },
  summaryChip: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'rgba(108,92,231,0.08)',
    padding: '4px 10px',
    borderRadius: 100,
  },
  // Bottom bar
  bottomBar: {
    padding: '12px 20px 28px',
    flexShrink: 0,
  },
  // Loading
  loadingPage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    background: 'var(--bg-primary)',
    padding: '0 32px',
  },
  loadingIcon: {
    fontSize: '3rem',
    display: 'inline-block',
  },
  loadingText: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    background: 'var(--border-card)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 2,
  },
}
