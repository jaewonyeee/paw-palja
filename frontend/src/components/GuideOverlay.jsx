import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'

const slides = [
  { emoji: '🐾', titleKey: 'guide.slide1Title', descKey: 'guide.slide1Desc' },
  { emoji: '📖', titleKey: 'guide.slide2Title', descKey: 'guide.slide2Desc' },
  { emoji: '💬', titleKey: 'guide.slide3Title', descKey: 'guide.slide3Desc' },
  { emoji: '🌐', titleKey: 'guide.slide4Title', descKey: 'guide.slide4Desc' },
  { emoji: '🚀', titleKey: 'guide.slide5Title', descKey: 'guide.slide5Desc' },
]

export default function GuideOverlay({ onClose }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const isLast = current === slides.length - 1

  const goNext = () => {
    if (isLast) {
      handleClose()
    } else {
      setDirection(1)
      setCurrent((p) => p + 1)
    }
  }

  const handleClose = () => {
    localStorage.setItem('pawpalja_guide_seen', 'true')
    onClose()
  }

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={styles.overlay}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        style={styles.modal}
      >
        {/* Skip button */}
        {!isLast && (
          <button onClick={handleClose} style={styles.skipBtn}>
            {t('guide.skip', 'Skip')}
          </button>
        )}

        {/* Slide content */}
        <div style={styles.slideArea}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              style={styles.slide}
            >
              <motion.span
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                style={styles.emoji}
              >
                {slides[current].emoji}
              </motion.span>
              <h2 style={styles.title}>{t(slides[current].titleKey)}</h2>
              <p style={styles.desc}>{t(slides[current].descKey)}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Page dots */}
        <div style={styles.dots}>
          {slides.map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.dot,
                ...(i === current ? styles.dotActive : {}),
              }}
            />
          ))}
        </div>

        {/* Next / Start button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={goNext}
          style={styles.nextBtn}
        >
          {isLast ? t('guide.start', "Let's go!") : t('guide.next', 'Next')}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 20,
  },
  modal: {
    background: 'linear-gradient(145deg, #FFFAF5, #FFF3E6)',
    borderRadius: 24,
    padding: '32px 28px 28px',
    maxWidth: 380,
    width: '100%',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,200,150,0.2)',
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted, #999)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 8px',
  },
  slideArea: {
    minHeight: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slide: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
    padding: '0 8px',
  },
  emoji: {
    fontSize: '3.5rem',
    display: 'block',
  },
  title: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: 'var(--text-primary, #2D2D2D)',
    margin: 0,
  },
  desc: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary, #666)',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 280,
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    margin: '20px 0',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--border-card, #E0E0E0)',
    transition: 'all 0.3s ease',
  },
  dotActive: {
    background: 'var(--bg-purple, #6C5CE7)',
    width: 24,
    borderRadius: 4,
  },
  nextBtn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: 'var(--radius-full, 50px)',
    background: 'linear-gradient(135deg, var(--bg-purple, #6C5CE7), #a29bfe)',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(108,92,231,0.3)',
  },
}
