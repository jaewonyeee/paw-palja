import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * PremiumUpsellCard - contextual premium upgrade prompt
 *
 * @param {string} variant - 'full' | 'compact' | 'illustration'
 *   full: large card with features + CTA (for Home, after diary list)
 *   compact: single-line inline banner (for headers, small spaces)
 *   illustration: focused on DALL-E illustration upsell (for DiaryDetail)
 * @param {function} onDismiss - optional dismiss handler
 * @param {number} delay - animation delay in seconds
 */
export default function PremiumUpsellCard({ variant = 'full', onDismiss, delay = 0 }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('/pricing')}
        style={styles.compact}
      >
        <span style={styles.compactIcon}>✨</span>
        <span style={styles.compactText}>{t('premium.upsellTitle', '일기를 더 특별하게')}</span>
        <span style={styles.compactArrow}>→</span>
      </motion.div>
    )
  }

  if (variant === 'illustration') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        style={styles.illustrationCard}
      >
        {onDismiss && (
          <button onClick={(e) => { e.stopPropagation(); onDismiss() }} style={styles.dismissBtn}>✕</button>
        )}
        <div style={styles.illustrationContent}>
          <div style={styles.illustrationLeft}>
            <div style={styles.illustrationIconWrap}>
              <span style={{ fontSize: '1.5rem' }}>🎨</span>
            </div>
          </div>
          <div style={styles.illustrationRight}>
            <h4 style={styles.illustrationTitle}>{t('premium.illustrationUpsell', '이 일기에 AI 일러스트를 추가해보세요')}</h4>
            <p style={styles.illustrationDesc}>{t('premium.illustrationDesc', 'DALL-E 3가 일기 내용을 바탕으로 예쁜 그림을 그려줘요')}</p>
            <div style={styles.illustrationTags}>
              <span style={styles.miniTag}>DALL-E 3</span>
              <span style={styles.miniTag}>TTS</span>
              <span style={styles.miniTag}>Whisper</span>
            </div>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/pricing')}
          style={styles.illustrationCta}
        >
          {t('premium.learnMore', '프리미엄 알아보기')} →
        </motion.button>
      </motion.div>
    )
  }

  // variant === 'full'
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={styles.fullCard}
    >
      {onDismiss && (
        <button onClick={(e) => { e.stopPropagation(); onDismiss() }} style={styles.dismissBtn}>✕</button>
      )}
      <div style={styles.fullTop}>
        <div style={styles.fullIconWrap}>
          <span style={{ fontSize: '1.3rem' }}>✨</span>
        </div>
        <div style={styles.fullTextWrap}>
          <h4 style={styles.fullTitle}>{t('premium.upsellTitle', '일기를 더 특별하게')}</h4>
          <p style={styles.fullDesc}>{t('premium.upsellDesc', 'AI 일러스트, 음성 입력, TTS로 일기 경험을 업그레이드하세요')}</p>
        </div>
      </div>
      <div style={styles.fullFeatures}>
        {[
          { icon: '🎨', label: 'DALL-E 3', desc: 'AI Illustration' },
          { icon: '🔊', label: 'TTS', desc: 'Read Aloud' },
          { icon: '🎙️', label: 'Whisper', desc: 'Voice Input' },
          { icon: '👁️', label: 'Vision', desc: 'Photo Analysis' },
        ].map((f) => (
          <div key={f.label} style={styles.fullFeatureItem}>
            <span style={{ fontSize: '1rem' }}>{f.icon}</span>
            <span style={styles.fullFeatureLabel}>{f.label}</span>
          </div>
        ))}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('/pricing')}
        style={styles.fullCta}
      >
        {t('premium.learnMore', '프리미엄 알아보기')} →
      </motion.button>
    </motion.div>
  )
}

const styles = {
  // Compact variant
  compact: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'linear-gradient(135deg, rgba(108,92,231,0.06), rgba(240,160,75,0.06))',
    borderRadius: 12,
    border: '1px solid rgba(108,92,231,0.12)',
    cursor: 'pointer',
  },
  compactIcon: { fontSize: '0.9rem' },
  compactText: {
    flex: 1,
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
  },
  compactArrow: {
    fontSize: '0.82rem',
    color: 'rgba(108,92,231,0.5)',
  },

  // Illustration variant
  illustrationCard: {
    background: 'linear-gradient(135deg, rgba(108,92,231,0.06) 0%, rgba(240,160,75,0.04) 100%)',
    borderRadius: 16,
    padding: '18px 16px 14px',
    border: '1.5px solid rgba(108,92,231,0.12)',
    position: 'relative',
  },
  illustrationContent: {
    display: 'flex',
    gap: 14,
    marginBottom: 14,
  },
  illustrationLeft: {
    flexShrink: 0,
  },
  illustrationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(240,160,75,0.15))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  illustrationTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.4,
  },
  illustrationDesc: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  illustrationTags: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  miniTag: {
    fontSize: '0.55rem',
    fontWeight: 700,
    color: 'white',
    background: 'rgba(108,92,231,0.7)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  illustrationCta: {
    width: '100%',
    padding: '10px',
    border: '1.5px solid rgba(108,92,231,0.25)',
    borderRadius: 12,
    background: 'white',
    color: 'var(--bg-purple)',
    fontSize: '0.8rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  // Full variant
  fullCard: {
    background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(240,160,75,0.06) 50%, rgba(108,92,231,0.04) 100%)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 18px 16px',
    border: '1.5px solid rgba(108,92,231,0.12)',
    position: 'relative',
  },
  fullTop: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  fullIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, var(--bg-purple), rgba(240,160,75,0.8))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fullTextWrap: {
    flex: 1,
  },
  fullTitle: {
    fontSize: '0.92rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: 4,
  },
  fullDesc: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  fullFeatures: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
    padding: '12px 8px',
    background: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
  },
  fullFeatureItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  fullFeatureLabel: {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
  },
  fullCta: {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg-purple)',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  // Shared
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.06)',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
