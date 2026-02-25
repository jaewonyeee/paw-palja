import { motion, AnimatePresence } from 'motion/react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { api } from '../api'
import { isPushSupported, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../utils/pushNotifications'

const pageTransition = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: 30, transition: { duration: 0.2 } },
}

function resizeImage(file, maxSize = 512, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, handleLogout, handleUserUpdate } = useAuth()
  const { addToast } = useToast()
  const dog = user.dog || {}
  const [editingTime, setEditingTime] = useState(false)
  const [hour, setHour] = useState(user.diary_time?.split(':')[0] || '09')
  const [minute, setMinute] = useState(user.diary_time?.split(':')[1] || '00')
  const [saving, setSaving] = useState(false)
  const [isProfilePublic, setIsProfilePublic] = useState(user.is_profile_public || false)
  const [autoShareSocial, setAutoShareSocial] = useState(user.auto_share_social || false)
  const [bio, setBio] = useState(user.bio || '')
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const pushSupported = isPushSupported()
  const [email, setEmail] = useState(user.email || '')
  const [savingEmail, setSavingEmail] = useState(false)
  const [easterTaps, setEasterTaps] = useState(0)
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const easterTimeout = useRef(null)
  const dogImageRef = useRef(null)
  const [uploadingDog, setUploadingDog] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [managingSubscription, setManagingSubscription] = useState(false)

  useEffect(() => {
    api.getMySubscription()
      .then(setSubscription)
      .catch(() => setSubscription({ tier: 'free', is_premium: false }))
  }, [])

  useEffect(() => {
    if (pushSupported) {
      isSubscribed().then(setPushEnabled)
    }
  }, [pushSupported])

  const handleAvatarTap = () => {
    const next = easterTaps + 1
    setEasterTaps(next)
    if (easterTimeout.current) clearTimeout(easterTimeout.current)
    if (next >= 7) {
      setShowEasterEgg(true)
      setEasterTaps(0)
    } else {
      easterTimeout.current = setTimeout(() => setEasterTaps(0), 2000)
    }
  }

  const handleDogImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDog(true)
    try {
      const base64 = await resizeImage(file)
      const updated = await api.updateUser({ ...dog, image: base64 })
      handleUserUpdate(updated)
      addToast(t('common.success'), 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploadingDog(false)
      e.target.value = ''
    }
  }

  const handleRemoveDogImage = async () => {
    setUploadingDog(true)
    try {
      const updated = await api.updateUser({ ...dog, image: null })
      handleUserUpdate(updated)
      addToast(t('common.success'), 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploadingDog(false)
    }
  }

  const handleTogglePush = async () => {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        await subscribeToPush()
        setPushEnabled(true)
      }
    } catch (err) {
      addToast(t('profile.pushError') + ': ' + err.message, 'error')
    } finally {
      setPushLoading(false)
    }
  }

  const handleSaveEmail = async () => {
    setSavingEmail(true)
    try {
      const updated = await api.updateUser(null, null, email.trim() || null)
      handleUserUpdate(updated)
      addToast(t('common.save') + ' OK', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  const handleTestPush = async () => {
    try {
      await api.pushTest()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleManageSubscription = async () => {
    setManagingSubscription(true)
    try {
      const { portal_url } = await api.createPortalSession()
      window.location.href = portal_url
    } catch (err) {
      addToast(err.message || t('pricing.paymentError', '결제 처리 중 오류가 발생했습니다.'), 'error')
    } finally {
      setManagingSubscription(false)
    }
  }

  const handleSaveVisibility = async () => {
    setSavingVisibility(true)
    try {
      const result = await api.updateVisibility(isProfilePublic, bio, autoShareSocial)
      handleUserUpdate({
        ...user,
        is_profile_public: result.is_profile_public,
        bio: result.bio,
        auto_share_social: result.auto_share_social,
      })
      addToast(t('common.save') + ' OK', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingVisibility(false)
    }
  }

  const handleSaveTime = async () => {
    setSaving(true)
    try {
      const updated = await api.updateUser(null, `${hour}:${minute}`)
      handleUserUpdate(updated)
      setEditingTime(false)
    } catch (err) {
      addToast(t('common.error') + ': ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/home')} className="btn btn-ghost">← {t('common.back')}</button>
        <h3 style={styles.headerTitle}>{t('profile.title')}</h3>
        <div style={{ width: 60 }} />
      </div>

      <div className="page-content" style={styles.content}>
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={styles.profileCard}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            style={{ ...styles.avatarBig, cursor: 'pointer', userSelect: 'none' }}
            onClick={handleAvatarTap}
            whileTap={{ scale: 0.9 }}
          >
            {dog.image ? (
              <img src={dog.image} alt="dog" style={styles.avatarImg} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '🐾' }} />
            ) : (
              '🐾'
            )}
          </motion.div>
          <h2 style={styles.nickname}>{user.nickname}</h2>
          <p style={styles.userId}>@{user.user_id}</p>
        </motion.div>

        {/* Subscription Plan */}
        <motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:0.15}} style={styles.card}>
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.subscription', '구독 플랜')}</h4>
            <span style={{
              ...styles.planBadge,
              ...(subscription?.is_premium ? {
                background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
                color: 'white',
              } : {})
            }}>
              {subscription?.is_premium ? 'Premium' : 'Free'}
            </span>
          </div>

          {subscription?.is_premium ? (
            <>
              <p style={{fontSize:'0.78rem',color:'var(--text-muted)',marginBottom:8,lineHeight:1.5}}>
                {subscription?.expires
                  ? t('profile.premiumExpires', '프리미엄 만료: {{date}}', {
                      date: new Date(subscription.expires).toLocaleDateString()
                    })
                  : t('profile.premiumActive', '프리미엄 이용 중')}
              </p>
              {subscription?.has_stripe_customer && (
                <motion.button
                  whileTap={{scale:0.97}}
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  style={styles.viewPlansBtn}
                >
                  {managingSubscription
                    ? t('common.loading', '로딩 중...')
                    : t('profile.manageSubscription', '구독 관리')}
                </motion.button>
              )}
            </>
          ) : (
            <>
              <p style={{fontSize:'0.78rem',color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>
                {t('profile.subscriptionDesc', '프리미엄으로 업그레이드하면 AI 일러스트, 음성 입력, TTS, 사진 분석을 이용할 수 있어요.')}
              </p>
              <motion.button whileTap={{scale:0.97}} onClick={()=>navigate('/pricing')} style={styles.viewPlansBtn}>
                {t('profile.viewPlans', '플랜 보기')} →
              </motion.button>
            </>
          )}
        </motion.div>

        {/* Dog info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.dogInfo')}</h4>
            <button
              onClick={() => setEditingTime(!editingTime)}
              style={styles.editBtn}
            >
              {editingTime ? t('common.cancel') : t('profile.editTime')}
            </button>
          </div>
          <div style={styles.dogPhotoSection}>
            <div style={styles.dogPhotoPreview}>
              {dog.image ? (
                <img src={dog.image} alt={dog.name} style={styles.dogPhotoImg} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block') }} />
              ) : (
                <span style={styles.dogPhotoPlaceholder}>🐶</span>
              )}
            </div>
            <div style={styles.dogPhotoBtns}>
              <button
                onClick={() => dogImageRef.current?.click()}
                disabled={uploadingDog}
                style={styles.dogPhotoChangeBtn}
              >
                {uploadingDog ? '...' : t('profile.changeDogPhoto')}
              </button>
              {dog.image && (
                <button
                  onClick={handleRemoveDogImage}
                  disabled={uploadingDog}
                  style={styles.dogPhotoRemoveBtn}
                >
                  {t('profile.removePhoto')}
                </button>
              )}
            </div>
            <input
              ref={dogImageRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleDogImageChange}
            />
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.name')}</span>
              <span style={styles.infoValue}>{dog.name || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.breed')}</span>
              <span style={styles.infoValue}>{dog.breed || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('dog.mbti')}</span>
              <span style={styles.infoValue}>{dog.mbti || '-'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('profile.diaryNotification')}</span>
              {editingTime ? (
                <div style={styles.timeEditRow}>
                  <select
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                    style={styles.timeSelect}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    style={styles.timeSelect}
                  >
                    {['00', '15', '30', '45'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveTime}
                    disabled={saving}
                    style={styles.saveBtn}
                  >
                    {saving ? '...' : '✓'}
                  </button>
                </div>
              ) : (
                <span style={styles.infoValue}>{user.diary_time || '09:00'}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Language Settings */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.languageSettings')}</h4>
          </div>
          <div style={styles.languageSelector}>
            {[
              { code: 'ko', flag: '\u{1F1F0}\u{1F1F7}', label: 'language.korean' },
              { code: 'en', flag: '\u{1F1FA}\u{1F1F8}', label: 'language.english' },
              { code: 'ja', flag: '\u{1F1EF}\u{1F1F5}', label: 'language.japanese' },
              { code: 'zh', flag: '\u{1F1E8}\u{1F1F3}', label: 'language.chinese' },
              { code: 'es', flag: '\u{1F1EA}\u{1F1F8}', label: 'language.spanish' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                style={{
                  ...styles.languageBtn,
                  ...(i18n.language === lang.code ? styles.languageBtnActive : {})
                }}
              >
                {lang.flag} {t(lang.label)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Push Notification Settings */}
        {pushSupported && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27 }}
            style={styles.card}
          >
            <div style={styles.cardHeader}>
              <h4 style={styles.cardTitle}>{t('profile.pushNotifications')}</h4>
            </div>
            <div style={styles.toggleRow}>
              <span style={styles.toggleLabel}>{t('profile.enablePush')}</span>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                style={{
                  ...styles.toggle,
                  background: pushEnabled ? 'var(--bg-purple)' : 'var(--border-light)',
                  opacity: pushLoading ? 0.5 : 1,
                }}
              >
                <span style={{
                  ...styles.toggleKnob,
                  transform: pushEnabled ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </button>
            </div>
            {pushEnabled && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTestPush}
                style={styles.testPushBtn}
              >
                {t('profile.testPush')}
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Email Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('profile.emailNotifications', 'Email Notifications')}</h4>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.infoLabel}>{t('profile.emailLabel', 'Email Address')}</label>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.emailPlaceholder', 'Email for diary reminders')}
              style={{ marginTop: 4, fontSize: '0.85rem' }}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
              {t('profile.emailDesc', 'Cute reminder emails arrive at your set time!')}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveEmail}
            disabled={savingEmail}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
          >
            {savingEmail ? t('profile.savingChanges') : t('common.save')}
          </motion.button>
        </motion.div>

        {/* Social Sharing Settings */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={styles.card}
        >
          <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>{t('social.socialSettings', '소셜 공유 설정')}</h4>
          </div>

          <div style={styles.toggleRow}>
            <div style={{ flex: 1 }}>
              <span style={styles.toggleLabel}>{t('social.anonymousSharingToggle', '소셜 피드에서 익명으로 표시')}</span>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {t('social.anonymousSharingDesc', "켜면 소셜 피드에서 '익명 사용자'로 표시됩니다.")}
              </p>
            </div>
            <button
              onClick={() => setIsProfilePublic(!isProfilePublic)}
              style={{
                ...styles.toggle,
                background: !isProfilePublic ? 'var(--bg-purple)' : 'var(--border-light)',
              }}
            >
              <span style={{
                ...styles.toggleKnob,
                transform: !isProfilePublic ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </button>
          </div>

          <div style={{ ...styles.toggleRow, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <span style={styles.toggleLabel}>{t('social.autoShareToggle', '새 일기 자동으로 소셜에 공유')}</span>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {t('social.autoShareDesc', '켜면 새 일기가 자동으로 소셜 피드에 공유됩니다.')}
              </p>
            </div>
            <button
              onClick={() => setAutoShareSocial(!autoShareSocial)}
              style={{
                ...styles.toggle,
                background: autoShareSocial ? 'var(--bg-purple)' : 'var(--border-light)',
              }}
            >
              <span style={{
                ...styles.toggleKnob,
                transform: autoShareSocial ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <span style={styles.infoLabel}>{t('social.bio')}</span>
            <textarea
              className="input-field"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 200))}
              placeholder={t('social.bioPlaceholder')}
              rows={2}
              style={{ marginTop: 4, fontSize: '0.85rem' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{bio.length}/200</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveVisibility}
            disabled={savingVisibility}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
          >
            {savingVisibility ? t('profile.savingChanges') : t('common.save')}
          </motion.button>

          {isProfilePublic && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {t('social.profileLink')}: /profile/{user.user_id}
            </p>
          )}
        </motion.div>

        {/* View Service Guide */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          style={styles.menuSection}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              localStorage.removeItem('pawpalja_guide_seen')
              navigate('/home')
            }}
            style={styles.menuItem}
          >
            <span style={styles.menuIcon}>📖</span>
            <span style={styles.menuLabel}>{t('profile.viewGuide', 'View Service Guide')}</span>
            <span style={styles.menuArrow}>→</span>
          </motion.button>
        </motion.div>

        {/* Menu items - admin only */}
        {user.user_id === 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={styles.menuSection}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin')}
              style={styles.menuItem}
            >
              <span style={styles.menuIcon}>🛠</span>
              <span style={styles.menuLabel}>{t('profile.adminDashboard')}</span>
              <span style={styles.menuArrow}>→</span>
            </motion.button>
          </motion.div>
        )}

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={styles.logoutWrap}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => { await api.logout(); handleLogout(); navigate('/onboarding'); }}
            style={styles.logoutBtn}
          >
            {t('auth.logout')}
          </motion.button>
        </motion.div>
      </div>

      {/* Easter Egg Modal */}
      <AnimatePresence>
        {showEasterEgg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={styles.easterOverlay}
            onClick={() => setShowEasterEgg(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={styles.easterModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={styles.easterHeader}>
                <span style={{ fontSize: '1.5rem' }}>🤫</span>
                <h3 style={styles.easterTitle}>{t('easter.title')}</h3>
              </div>
              <div style={styles.easterBody}>
                <p style={styles.easterIntro}>{t('easter.intro')}</p>
                <p style={styles.easterDilemma}>{t('easter.dilemma')}</p>
                <p style={styles.easterPhilosophy}>{t('easter.philosophy')}</p>
                <p style={styles.easterIdentity}>{t('easter.identity')}</p>
                <p style={styles.easterClosing}>{t('easter.closing')} {t('easter.pawprint')}</p>
              </div>
              <div style={styles.easterFooter}>
                <span style={styles.easterVersion}>{t('easter.version')}</span>
              </div>
              <button
                onClick={() => setShowEasterEgg(false)}
                style={styles.easterCloseBtn}
              >
                {t('common.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  content: {
    padding: '20px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  profileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '28px 20px',
    background: 'linear-gradient(135deg, var(--bg-purple), var(--bg-purple-light))',
    borderRadius: 'var(--radius-lg)',
  },
  avatarBig: {
    width: 72,
    height: 72,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nickname: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'white',
  },
  userId: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
  },
  dogPhotoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: '1px solid var(--border-light)',
  },
  dogPhotoPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--bg-purple-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dogPhotoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  dogPhotoPlaceholder: {
    fontSize: '1.6rem',
  },
  dogPhotoBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  dogPhotoChangeBtn: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
    background: 'transparent',
    border: '1px solid var(--bg-purple)',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dogPhotoRemoveBtn: {
    fontSize: '0.68rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '2px 4px',
    textDecoration: 'underline',
  },
  card: {
    background: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '18px 20px',
    border: '1.5px solid var(--border-light)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  planBadge: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--bg-purple)',
    background: 'rgba(108,92,231,0.1)',
    padding: '3px 10px',
    borderRadius: 6,
  },
  viewPlansBtn: {
    width: '100%',
    padding: '10px',
    border: '1.5px solid var(--bg-purple)',
    borderRadius: 'var(--radius-full)',
    background: 'transparent',
    color: 'var(--bg-purple)',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  editBtn: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--bg-purple)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    fontFamily: 'inherit',
  },
  timeEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  timeSelect: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--bg-purple)',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  infoLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  infoValue: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  // Menu
  menuSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    background: 'white',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-light)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
  },
  menuIcon: {
    fontSize: '1.2rem',
  },
  menuLabel: {
    flex: 1,
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  menuArrow: {
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
  },
  logoutWrap: {
    marginTop: 8,
  },
  logoutBtn: {
    width: '100%',
    padding: '14px',
    border: '1.5px solid #E74C3C',
    borderRadius: 'var(--radius-full)',
    background: 'transparent',
    color: '#E74C3C',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  // Language Settings
  languageSelector: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageBtn: {
    flex: '1 1 calc(50% - 4px)',
    minWidth: 0,
    padding: '10px 8px',
    border: '1.5px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    background: 'white',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  languageBtnActive: {
    background: 'var(--bg-purple)',
    color: 'white',
    borderColor: 'var(--bg-purple)',
  },
  testPushBtn: {
    marginTop: 12,
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--bg-purple)',
    background: 'transparent',
    color: 'var(--bg-purple)',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    padding: 0,
  },
  toggleKnob: {
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
  // Easter Egg
  easterOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  easterModal: {
    background: 'linear-gradient(145deg, #FFF8F0, #FFF3E6)',
    borderRadius: 20,
    padding: '28px 24px 20px',
    maxWidth: 360,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,200,150,0.3)',
    position: 'relative',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  easterHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '1.5px dashed rgba(200,160,120,0.3)',
  },
  easterTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#8B6914',
    margin: 0,
  },
  easterBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  easterIntro: {
    fontSize: '0.88rem',
    lineHeight: 1.7,
    color: '#6B5B3E',
    margin: 0,
    fontStyle: 'italic',
  },
  easterDilemma: {
    fontSize: '0.88rem',
    lineHeight: 1.7,
    color: '#8B6914',
    fontWeight: 600,
    margin: 0,
    padding: '10px 14px',
    background: 'rgba(200,160,80,0.1)',
    borderRadius: 12,
    borderLeft: '3px solid rgba(200,160,80,0.4)',
  },
  easterPhilosophy: {
    fontSize: '0.82rem',
    lineHeight: 1.75,
    color: '#6B5B3E',
    margin: 0,
  },
  easterIdentity: {
    fontSize: '0.82rem',
    lineHeight: 1.75,
    color: '#6B5B3E',
    margin: 0,
  },
  easterClosing: {
    fontSize: '0.88rem',
    lineHeight: 1.7,
    color: '#8B6914',
    fontWeight: 600,
    margin: 0,
    textAlign: 'center',
    paddingTop: 6,
  },
  easterFooter: {
    marginTop: 18,
    paddingTop: 12,
    borderTop: '1.5px dashed rgba(200,160,120,0.3)',
    textAlign: 'center',
  },
  easterVersion: {
    fontSize: '0.7rem',
    color: 'rgba(139,105,20,0.5)',
    fontWeight: 600,
  },
  easterCloseBtn: {
    display: 'block',
    width: '100%',
    marginTop: 14,
    padding: '10px',
    border: '1.5px solid rgba(200,160,120,0.3)',
    borderRadius: 12,
    background: 'transparent',
    color: '#8B6914',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
}
