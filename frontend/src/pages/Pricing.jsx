import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
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

export default function Pricing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMySubscription()
      .then(setSubscription)
      .catch(() => setSubscription({ tier: 'free', is_premium: false }))
      .finally(() => setLoading(false))
  }, [])

  const features = [
    {
      icon: '📖',
      name: t('pricing.diaryGeneration', '일기 생성'),
      free: t('pricing.threePerDay', '3회/일'),
      premium: t('pricing.unlimited', '무제한'),
    },
    {
      icon: '💬',
      name: t('pricing.aiComments', 'AI 코멘트'),
      free: '3',
      premium: '5 + Streaming',
    },
    {
      icon: '📷',
      name: t('pricing.photoAnalysis', 'AI 사진 분석'),
      free: '—',
      premium: 'GPT-4o Vision',
    },
    {
      icon: '🎨',
      name: t('pricing.illustration', 'AI 일러스트'),
      free: '—',
      premium: 'DALL-E 3',
    },
    {
      icon: '🎙',
      name: t('pricing.voiceInput', '음성 입력'),
      free: '—',
      premium: 'Whisper',
    },
    {
      icon: '🔊',
      name: t('pricing.ttsReading', '일기 낭독'),
      free: '—',
      premium: 'TTS',
    },
    {
      icon: '🩺',
      name: t('pricing.healthAnalysis', '건강 분석'),
      free: t('pricing.basic', '기본'),
      premium: t('pricing.detailed', '상세 + 사진 기반'),
    },
  ]

  if (loading) {
    return (
      <motion.div {...pageTransition} style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} className="btn btn-ghost">
          ← {t('common.back')}
        </button>
        <h2 style={styles.headerTitle}>{t('pricing.title', '구독 플랜')}</h2>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content" style={styles.content}>
        {/* Current plan badge */}
        {subscription?.is_premium && (
          <div style={styles.currentPlanBadge}>
            ✨ {t('pricing.currentPremium', '현재 프리미엄 이용 중')}
          </div>
        )}

        {/* Pricing cards */}
        <div style={styles.cardsWrap}>
          {/* Free Tier */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{t('pricing.free', 'Free')}</h3>
              <div style={styles.cardPrice}>
                <span style={styles.priceAmount}>₩0</span>
                <span style={styles.priceUnit}>/{t('pricing.monthly', '월')}</span>
              </div>
            </div>
            <div style={styles.featureList}>
              {features.map((f, i) => (
                <div key={i} style={styles.featureRow}>
                  <span>{f.icon}</span>
                  <span style={styles.featureName}>{f.name}</span>
                  <span style={styles.featureValue}>{f.free}</span>
                </div>
              ))}
            </div>
            {!subscription?.is_premium && (
              <div style={styles.currentTag}>{t('pricing.currentPlan', '현재 플랜')}</div>
            )}
          </div>

          {/* Premium Tier */}
          <div style={{ ...styles.card, ...styles.premiumCard }}>
            <div style={styles.premiumBadge}>PREMIUM</div>
            <div style={styles.cardHeader}>
              <h3 style={{ ...styles.cardTitle, color: 'white' }}>{t('pricing.premium', 'Premium')}</h3>
              <div style={styles.cardPrice}>
                <span style={{ ...styles.priceAmount, color: 'white' }}>₩9,900</span>
                <span style={{ ...styles.priceUnit, color: 'rgba(255,255,255,0.7)' }}>/{t('pricing.monthly', '월')}</span>
              </div>
            </div>
            <div style={styles.featureList}>
              {features.map((f, i) => (
                <div key={i} style={styles.featureRow}>
                  <span>{f.icon}</span>
                  <span style={{ ...styles.featureName, color: 'rgba(255,255,255,0.9)' }}>{f.name}</span>
                  <span style={{ ...styles.featureValue, color: 'white', fontWeight: 700 }}>{f.premium}</span>
                </div>
              ))}
            </div>
            {subscription?.is_premium ? (
              <div style={{ ...styles.currentTag, background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {t('pricing.currentPlan', '현재 플랜')}
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => addToast(t('pricing.comingSoon', '결제 시스템 준비 중입니다!'), 'info')}
                style={styles.upgradeBtn}
              >
                {t('pricing.upgrade', '프리미엄 시작하기')}
              </motion.button>
            )}
          </div>
        </div>

        {/* OpenAI API badges */}
        <div style={styles.aiBadges}>
          <span style={styles.aiBadge}>GPT-4o</span>
          <span style={styles.aiBadge}>GPT-4o Vision</span>
          <span style={styles.aiBadge}>DALL-E 3</span>
          <span style={styles.aiBadge}>Whisper</span>
          <span style={styles.aiBadge}>TTS</span>
        </div>

        <p style={styles.footnote}>
          {t('pricing.footnote', 'Powered by OpenAI — 5개 멀티모달 API 활용')}
        </p>
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
    borderBottom: '1px solid var(--border-light)',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  content: {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  },
  currentPlanBadge: {
    textAlign: 'center',
    padding: '10px',
    background: 'rgba(108,92,231,0.08)',
    borderRadius: 12,
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    marginBottom: 20,
  },
  cardsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    background: 'white',
    borderRadius: 20,
    padding: '24px',
    border: '1.5px solid var(--border-card)',
    boxShadow: 'var(--shadow-card)',
    position: 'relative',
  },
  premiumCard: {
    background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
    border: 'none',
  },
  premiumBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    background: '#FF6B6B',
    color: 'white',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '4px 12px',
    borderRadius: 100,
    letterSpacing: '0.06em',
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  cardPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  priceAmount: {
    fontSize: '1.8rem',
    fontWeight: 900,
    color: 'var(--text-primary)',
  },
  priceUnit: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.82rem',
  },
  featureName: {
    flex: 1,
    color: 'var(--text-secondary)',
  },
  featureValue: {
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'right',
  },
  currentTag: {
    textAlign: 'center',
    padding: '10px',
    background: 'var(--bg-card)',
    borderRadius: 12,
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  upgradeBtn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: 14,
    background: 'white',
    fontFamily: 'inherit',
    fontSize: '0.92rem',
    fontWeight: 800,
    color: '#6C5CE7',
    cursor: 'pointer',
  },
  aiBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
  },
  aiBadge: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    background: 'rgba(108,92,231,0.08)',
    padding: '4px 12px',
    borderRadius: 100,
  },
  footnote: {
    textAlign: 'center',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: 12,
  },
}
