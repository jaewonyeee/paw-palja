import { useRef, useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../components/LanguageToggle'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 1, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)

  // Force muted (React bug) + play + fallback timer
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    v.setAttribute('muted', '')
    v.setAttribute('playsinline', '')
    const tryPlay = () => {
      v.play()
        .then(() => setVideoReady(true))
        .catch(() => {})
    }
    if (v.readyState >= 2) {
      // Already has enough data
      setVideoReady(true)
      tryPlay()
    } else {
      v.addEventListener('loadeddata', () => { setVideoReady(true); tryPlay() }, { once: true })
      tryPlay()
    }
    const timer = setTimeout(() => setVideoReady(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Video Background — always in DOM, always visible */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src="/videos/burti-bg.mp4"
        style={styles.videoBg}
      />

      {/* Fallback gradient — fades out once video is ready */}
      <div style={{
        ...styles.fallbackBg,
        opacity: videoReady ? 0 : 1,
        pointerEvents: 'none',
      }} />

      {/* Cinematic vignette overlay */}
      <div style={styles.vignette} />
      <div style={styles.bottomFade} />

      {/* Language Toggle — glass pill */}
      <div style={styles.langWrap}>
        <div style={styles.langPill}>
          <LanguageToggle />
        </div>
      </div>

      {/* Content — anchored to bottom */}
      <div style={styles.content}>
        {/* Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          style={styles.glassCard}
        >
          {/* App Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
            style={styles.iconWrap}
          >
            <span style={styles.icon}>🐾</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={styles.title}
          >
            {t('onboarding.title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            style={styles.subtitle}
          >
            {t('onboarding.subtitle')}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            style={styles.desc}
          >
            {t('onboarding.description')}
          </motion.p>

          {/* Feature chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            style={styles.features}
          >
            {[
              { icon: '🔮', label: t('diary.horoscope') },
              { icon: '📖', label: t('diary.title') },
              { icon: '🩺', label: t('diary.health') },
              { icon: '💬', label: t('diary.comments') },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.05 + i * 0.07, duration: 0.35 }}
                style={styles.chip}
              >
                <span style={{ fontSize: '0.75rem' }}>{f.icon}</span>
                <span style={styles.chipLabel}>{f.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/login')}
          style={styles.ctaBtn}
        >
          {t('onboarding.startButton')}
        </motion.button>
      </div>
    </motion.div>
  )
}

/* ─── Apple Glassmorphism Styles ─── */
const styles = {
  container: {
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
  },

  /* Video */
  videoBg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    transition: 'opacity 1.2s ease',
  },
  fallbackBg: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, #6C5CE7 0%, #A29BFE 50%, #DDD6FE 100%)',
    zIndex: 0,
    transition: 'opacity 1.2s ease',
    pointerEvents: 'none',
  },

  /* Overlays */
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(0,0,0,0.35) 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },

  /* Language toggle */
  langWrap: {
    position: 'absolute',
    top: 'max(16px, env(safe-area-inset-top, 16px))',
    right: 16,
    zIndex: 10,
  },
  langPill: {
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 100,
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '2px 4px',
  },

  /* Content container — bottom-anchored */
  content: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 20px',
    paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
  },

  /* Glass Card */
  glassCard: {
    width: '100%',
    maxWidth: 360,
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '28px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 0.5px 0 rgba(255,255,255,0.2)',
  },

  /* Icon */
  iconWrap: {
    width: 56,
    height: 56,
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    border: '0.5px solid rgba(255,255,255,0.25)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  icon: { fontSize: '1.6rem' },

  /* Typography */
  title: {
    fontSize: '1.7rem',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.04em',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    margin: '2px 0 0',
    letterSpacing: '-0.01em',
  },
  desc: {
    fontSize: '0.78rem',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    margin: '14px 0 0',
    maxWidth: 260,
  },

  /* Feature chips */
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 18,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 11px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    border: '0.5px solid rgba(255,255,255,0.12)',
  },
  chipLabel: {
    fontSize: '0.68rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '-0.01em',
  },

  /* CTA Button */
  ctaBtn: {
    width: '100%',
    maxWidth: 360,
    marginTop: 14,
    padding: '15px',
    background: 'rgba(255,255,255,0.92)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 16,
    fontSize: '0.92rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '-0.02em',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
}
