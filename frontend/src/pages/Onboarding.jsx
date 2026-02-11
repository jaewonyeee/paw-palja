import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../components/LanguageToggle'

const pageTransition = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
}

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <motion.div {...pageTransition} style={styles.container}>
      {/* Language Toggle - Top Right */}
      <div style={styles.languageToggleWrap}>
        <LanguageToggle />
      </div>

      {/* Gradient background */}
      <div style={styles.bgGradient} />

      <div style={styles.content}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
          style={styles.iconWrap}
        >
          <span style={styles.icon}>🐾</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={styles.title}
        >
          {t('onboarding.title')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={styles.subtitle}
        >
          {t('onboarding.subtitle')}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          style={styles.desc}
        >
          {t('onboarding.description')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          style={styles.features}
        >
          {[
            { icon: '🔮', label: 'AI 운세' },
            { icon: '📖', label: '1인칭 일기' },
            { icon: '🩺', label: '건강 분석' },
            { icon: '💬', label: '댓글 반응' },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1, duration: 0.4 }}
              style={styles.featureChip}
            >
              <span>{f.icon}</span>
              <span style={styles.featureLabel}>{f.label}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          style={styles.bottomSection}
        >
          {/* Decorative illustration area */}
          <div style={styles.illustWrap}>
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              style={styles.illustDog}
            >
              🐕
            </motion.span>
            <motion.span
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.5 }}
              style={styles.illustCat}
            >
              🐈
            </motion.span>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            style={styles.startBtn}
          >
            {t('onboarding.startButton')}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}

const styles = {
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  languageToggleWrap: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, #6C5CE7 0%, #A29BFE 50%, #DDD6FE 100%)',
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 28px',
    gap: '6px',
  },
  iconWrap: {
    width: 80,
    height: 80,
    background: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: '2.5rem' },
  title: {
    fontSize: '2.2rem',
    fontWeight: 800,
    color: 'white',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
  desc: {
    fontSize: '0.85rem',
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 300,
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
  },
  featureChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(8px)',
    borderRadius: 100,
    border: '1px solid rgba(255,255,255,0.25)',
  },
  featureLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'white',
  },
  bottomSection: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    paddingTop: 20,
  },
  illustWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
  },
  illustDog: { fontSize: '3.5rem' },
  illustCat: { fontSize: '2.8rem' },
  startBtn: {
    width: '100%',
    maxWidth: 320,
    padding: '16px 32px',
    background: 'white',
    color: '#6C5CE7',
    border: 'none',
    borderRadius: 100,
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
}
