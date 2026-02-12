import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

const pageTransition = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.3 } },
}

const BREEDS = [
  // 소형견
  '말티즈', '푸들', '토이 푸들', '미니어처 푸들', '포메라니안', '치와와', '요크셔 테리어', '시추',
  '비숑 프리제', '빠삐용', '미니어처 핀셔', '미니어처 슈나우저', '페키니즈', '이탈리안 그레이하운드',
  '카발리에 킹 찰스', '닥스훈트', '웰시 코기', '잭 러셀 테리어', '보스턴 테리어', '프렌치 불독',
  '퍼그', '스피츠', '일본 스피츠', '하바니즈', '코톤 드 튈레아', '볼로네즈', '브뤼셀 그리펀',
  '차이니즈 크레스티드', '로첸', '토이 폭스 테리어', '실키 테리어', '노리치 테리어',
  // 중형견
  '코카스패니얼', '비글', '보더 콜리', '스프링어 스패니얼', '불독', '샤페이',
  '바셋 하운드', '오스트레일리안 셰퍼드', '아메리칸 코카스패니얼', '스태퍼드셔 불 테리어',
  '불 테리어', '위펫', '케리 블루 테리어', '소프트 코티드 휘튼 테리어',
  '아메리칸 에스키모', '사모예드', '시바견', '진돗개', '풍산개', '삽살개',
  '코리안 마스티프 (동경이)', '제주개', '불독', '달마시안',
  // 대형견
  '골든 리트리버', '래브라도 리트리버', '저먼 셰퍼드', '시베리안 허스키', '알래스칸 말라뮤트',
  '도베르만', '로트와일러', '그레이트 데인', '세인트 버나드', '버니즈 마운틴 독',
  '뉴펀들랜드', '그레이트 피레니즈', '아이리시 세터', '와이마라너', '비즐라',
  '보르조이', '아프간 하운드', '아키타', '마스티프', '불마스티프',
  '케인 코르소', '아나톨리안 셰퍼드', '그레이하운드', '자이언트 슈나우저',
  '올드 잉글리시 쉽독', '콜리', '벨지안 말리노이즈', '차우차우', '아이리시 울프하운드',
  '스탠더드 푸들', '플랫 코티드 리트리버', '체서피크 베이 리트리버',
  // 기타
  '믹스견', '기타',
]
const MBTIS = ['ENFP', 'INFJ', 'ISTP', 'ESTJ', 'ESFP', 'INTJ', 'ENFJ', 'ISFP']
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

const ITEM_HEIGHT = 40
const VISIBLE_COUNT = 5

function ScrollPicker({ items, value, onChange }) {
  const scrollRef = useRef(null)
  const isScrolling = useRef(false)

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(value)
    return idx >= 0 ? idx : 0
  }, [items, value])

  useEffect(() => {
    if (scrollRef.current && !isScrolling.current) {
      scrollRef.current.scrollTop = selectedIndex * ITEM_HEIGHT
    }
  }, [selectedIndex])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    isScrolling.current = true
    clearTimeout(scrollRef.current._snapTimer)
    scrollRef.current._snapTimer = setTimeout(() => {
      if (!scrollRef.current) return
      const idx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT)
      const clamped = Math.max(0, Math.min(idx, items.length - 1))
      onChange(items[clamped])
      isScrolling.current = false
    }, 80)
  }, [items, onChange])

  const padCount = Math.floor(VISIBLE_COUNT / 2)

  return (
    <div style={styles.pickerContainer}>
      <div style={styles.pickerHighlight} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={styles.pickerScroll}
      >
        {Array.from({ length: padCount }).map((_, i) => (
          <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT, flexShrink: 0 }} />
        ))}
        {items.map((item, i) => (
          <div
            key={item}
            style={{
              ...styles.pickerItem,
              ...(i === selectedIndex ? styles.pickerItemActive : {}),
            }}
          >
            {item}
          </div>
        ))}
        {Array.from({ length: padCount }).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: ITEM_HEIGHT, flexShrink: 0 }} />
        ))}
      </div>
    </div>
  )
}

export default function Signup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { handleLogin } = useAuth()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState('')
  const [idAvailable, setIdAvailable] = useState(null) // null=unchecked, true/false
  const [idChecking, setIdChecking] = useState(false)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [dogName, setDogName] = useState('')
  const [breed, setBreed] = useState('푸들')
  const [breedSearch, setBreedSearch] = useState('')
  const [breedOpen, setBreedOpen] = useState(false)
  const [mbti, setMbti] = useState('ENFP')
  const [dogImage, setDogImage] = useState(null) // base64 string
  const [hour, setHour] = useState('09')
  const [minute, setMinute] = useState('00')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)
  const debounceRef = useRef(null)

  const checkIdAvailability = useCallback(async (id) => {
    const val = (id ?? userId).trim()
    if (!val || val.length < 3) {
      setIdAvailable(null)
      return
    }
    if (!/^[a-zA-Z0-9]+$/.test(val)) {
      setIdAvailable(null)
      return
    }
    setIdChecking(true)
    try {
      const res = await api.checkId(val)
      setIdAvailable(res.available)
    } catch {
      setIdAvailable(null)
    } finally {
      setIdChecking(false)
    }
  }, [userId])

  // Debounced auto-check when userId changes
  useEffect(() => {
    setIdAvailable(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const val = userId.trim()
    if (val.length >= 3 && /^[a-zA-Z0-9]+$/.test(val)) {
      debounceRef.current = setTimeout(() => checkIdAvailability(val), 500)
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [userId])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError(t('auth.imageSizeLimit'))
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setDogImage(ev.target.result)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canProceedStep0 = userId.trim().length >= 3 && /^[a-zA-Z0-9]+$/.test(userId.trim()) &&
    idAvailable === true && nickname.trim() && password.trim().length >= 4 && isValidEmail && privacyAgreed

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.signup({
        user_id: userId.trim(),
        nickname: nickname.trim(),
        password,
        dog: {
          name: dogName.trim() || '멍멍이',
          breed,
          mbti,
          ...(dogImage ? { image: dogImage } : {}),
        },
        diary_time: `${hour}:${minute}`,
        email: email.trim(),
      })
      handleLogin(data)
      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div {...pageTransition} style={styles.container}>
      <div style={styles.topBar}>
        <button onClick={() => navigate('/login')} className="btn btn-ghost">← {t('auth.backBtn')}</button>
        <span style={styles.stepIndicator}>
          {[0, 1, 2].map((s) => (
            <span key={s} style={{ ...styles.dot, ...(s <= step ? styles.dotActive : {}) }} />
          ))}
        </span>
      </div>

      {step === 0 && (
        <motion.div
          key="step0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.stepContent}
        >
          <span style={{ fontSize: '2.5rem' }}>👋</span>
          <h2 style={styles.title}>{t('auth.signupGreeting')}</h2>
          <p style={styles.desc}>{t('auth.signupStep0Title')}</p>
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('auth.userId')}</label>
              <div style={styles.idRow}>
                <input
                  className="input-field"
                  placeholder={t('auth.userIdLabel')}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-secondary"
                  onClick={() => checkIdAvailability()}
                  disabled={idChecking || !userId.trim() || userId.trim().length < 3}
                  style={styles.checkBtn}
                >
                  {idChecking ? t('auth.checking') : t('auth.checkIdBtn')}
                </motion.button>
              </div>
              {idAvailable === true && (
                <span style={styles.idOk}>{t('auth.idAvailable')}</span>
              )}
              {idAvailable === false && (
                <span style={styles.idFail}>{t('auth.idTaken')}</span>
              )}
              {userId.trim() && !/^[a-zA-Z0-9]+$/.test(userId.trim()) && (
                <span style={styles.idFail}>{t('auth.onlyEnglishNumbers', '영문과 숫자만 사용 가능합니다')}</span>
              )}
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('auth.nickname')}</label>
              <input className="input-field" placeholder={t('auth.nickname')} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('auth.password')}</label>
              <input className="input-field" type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('auth.emailRequired', '이메일 (일기 알림용)')}</label>
              <input className="input-field" type="email" placeholder={t('auth.emailPlaceholder', 'example@email.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {/* Privacy consent */}
            <div
              role="checkbox"
              aria-checked={privacyAgreed}
              tabIndex={0}
              style={styles.privacyRow}
              onClick={() => setPrivacyAgreed(!privacyAgreed)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPrivacyAgreed(!privacyAgreed) } }}
            >
              <span style={{
                ...styles.checkbox,
                ...(privacyAgreed ? styles.checkboxChecked : {}),
              }}>
                {privacyAgreed ? '✓' : ''}
              </span>
              <span style={styles.privacyText}>
                {t('auth.privacyConsent', '[필수] 개인정보 수집·이용 동의')}
              </span>
            </div>
            <div style={styles.privacyBox}>
              <p style={styles.privacyDetail}>
                {t('auth.privacyDetail', '• 수집 항목: 이메일 주소\n• 수집 목적: 일기 알림 이메일 발송\n• 보유 기간: 회원 탈퇴 시까지\n• 동의를 거부할 수 있으나, 거부 시 서비스 이용이 제한됩니다.')}
              </p>
            </div>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <motion.button
            whileTap={canProceedStep0 ? { scale: 0.97 } : {}}
            className="btn btn-primary"
            disabled={!canProceedStep0}
            onClick={() => canProceedStep0 && setStep(1)}
            style={{ width: '100%', marginTop: 16, opacity: canProceedStep0 ? 1 : 0.5 }}
          >
            {t('auth.nextBtn')}
          </motion.button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div
          key="step1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.stepContent}
        >
          <span style={{ fontSize: '2.5rem' }}>🐶</span>
          <h2 style={styles.title}>{t('auth.dogProfileTitle')}</h2>
          <p style={styles.desc}>{t('auth.introduceDog')}</p>
          <div style={styles.form}>
            {/* Dog Image */}
            <div style={styles.imageSection}>
              <motion.div
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                style={styles.imageCircle}
              >
                {dogImage ? (
                  <img src={dogImage} alt="dog" style={styles.imagePreview} />
                ) : (
                  <div style={styles.imagePlaceholder}>
                    <span style={{ fontSize: '2rem' }}>📷</span>
                    <span style={styles.imagePlaceholderText}>{t('diary.addPhoto')}</span>
                  </div>
                )}
              </motion.div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
              {dogImage && (
                <button
                  onClick={() => setDogImage(null)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('dog.name')}</label>
              <input className="input-field" placeholder={t('dog.name')} value={dogName} onChange={(e) => setDogName(e.target.value)} />
            </div>
            <div style={styles.row}>
              <div style={{ ...styles.inputGroup, flex: 1, position: 'relative' }}>
                <label style={styles.label}>{t('dog.breed')}</label>
                <input
                  className="input-field"
                  placeholder={t('dog.searchBreed')}
                  value={breedOpen ? breedSearch : breed}
                  onChange={(e) => {
                    setBreedSearch(e.target.value)
                    if (!breedOpen) setBreedOpen(true)
                  }}
                  onFocus={() => {
                    setBreedOpen(true)
                    setBreedSearch('')
                  }}
                  onBlur={() => setTimeout(() => setBreedOpen(false), 200)}
                />
                {breedOpen && (
                  <div style={styles.breedDropdown}>
                    {BREEDS.filter((b) => b.toLowerCase().includes(breedSearch.toLowerCase())).slice(0, 8).map((b) => (
                      <button
                        key={b}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setBreed(b)
                          setBreedOpen(false)
                          setBreedSearch('')
                        }}
                        style={{ ...styles.breedOption, ...(b === breed ? styles.breedOptionActive : {}) }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>{t('dog.mbti')}</label>
                <select className="input-field" value={mbti} onChange={(e) => setMbti(e.target.value)}>
                  {MBTIS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.btnRow}>
            <button onClick={() => setStep(0)} className="btn btn-secondary">{t('auth.backBtn')}</button>
            <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary" onClick={() => setStep(2)} style={{ flex: 1 }}>
              {t('auth.nextBtn')}
            </motion.button>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          key="step2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.step2Container}
        >
          <div style={styles.step2Scroll}>
            <div style={styles.step2Header}>
              <span style={{ fontSize: '2.5rem' }}>⏰</span>
              <h2 style={styles.title}>{t('auth.notificationTitle')}</h2>
              <p style={styles.desc}>{t('auth.notificationDesc')}</p>
            </div>

            <div style={styles.timePickerWrap}>
              <div style={styles.timePicker}>
                <div style={styles.timeCol}>
                  <span style={styles.timeLabel}>{t('auth.hour', '시')}</span>
                  <ScrollPicker items={HOURS} value={hour} onChange={setHour} />
                </div>
                <span style={styles.timeColon}>:</span>
                <div style={styles.timeCol}>
                  <span style={styles.timeLabel}>{t('auth.minute', '분')}</span>
                  <ScrollPicker items={MINUTES} value={minute} onChange={setMinute} />
                </div>
              </div>
              <p style={styles.timePreview}>{t('auth.timePreview', '매일 {{time}}에 일기가 도착합니다', { time: `${hour}:${minute}` })}</p>
            </div>

            {error && <p style={styles.error}>{error}</p>}
          </div>

          <div style={styles.step2BtnRow}>
            <button onClick={() => setStep(1)} className="btn btn-secondary">{t('auth.backBtn')}</button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : t('auth.startNow', '시작하기!')}
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 28px 28px',
    background: 'var(--bg-primary)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepIndicator: {
    display: 'flex',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--border-card)',
    transition: 'all 0.3s ease',
  },
  dotActive: {
    background: 'var(--bg-purple)',
    width: 24,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    overflowY: 'auto',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginTop: 8,
  },
  desc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 20,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    paddingLeft: 4,
  },
  idRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  checkBtn: {
    fontSize: '0.78rem',
    padding: '10px 14px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  idOk: {
    fontSize: '0.72rem',
    color: '#27AE60',
    paddingLeft: 4,
    fontWeight: 600,
  },
  idFail: {
    fontSize: '0.72rem',
    color: '#E74C3C',
    paddingLeft: 4,
    fontWeight: 600,
  },
  row: {
    display: 'flex',
    gap: 12,
  },
  btnRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
    marginTop: 'auto',
    paddingTop: 20,
  },
  // Privacy consent
  privacyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    userSelect: 'none',
    padding: '2px 0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: '2px solid var(--border-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'white',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  checkboxChecked: {
    background: 'var(--bg-purple)',
    borderColor: 'var(--bg-purple)',
  },
  privacyText: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  privacyBox: {
    background: 'var(--bg-secondary, #F9F9F9)',
    borderRadius: 10,
    padding: '10px 14px',
    border: '1px solid var(--border-light)',
  },
  privacyDetail: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  // Dog image
  imageSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  imageCircle: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    border: '2.5px dashed var(--border-card)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'var(--bg-secondary)',
    transition: 'border-color 0.2s',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imagePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  imagePlaceholderText: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  // Step 2
  step2Container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  step2Scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  step2Header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  step2BtnRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
    paddingTop: 12,
    paddingBottom: 4,
    flexShrink: 0,
    background: 'var(--bg-primary)',
  },
  timePickerWrap: {
    width: '100%',
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  timePicker: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  timeCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  pickerContainer: {
    position: 'relative',
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    width: 70,
    overflow: 'hidden',
    borderRadius: 14,
    background: 'var(--bg-secondary, #F9F9F9)',
  },
  pickerHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    background: 'var(--bg-purple)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  pickerScroll: {
    height: '100%',
    overflowY: 'auto',
    scrollSnapType: 'y mandatory',
    WebkitOverflowScrolling: 'touch',
    position: 'relative',
    zIndex: 1,
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    scrollSnapAlign: 'start',
    transition: 'color 0.15s',
    userSelect: 'none',
  },
  pickerItemActive: {
    color: 'white',
    fontWeight: 800,
    fontSize: '1.1rem',
  },
  timeColon: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginTop: 28,
  },
  timePreview: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  error: {
    fontSize: '0.82rem',
    color: '#E74C3C',
    textAlign: 'center',
    padding: '8px 12px',
    background: '#FDF2F2',
    borderRadius: 12,
    width: '100%',
  },
  // Breed searchable dropdown
  breedDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'white',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    border: '1px solid var(--border-light)',
    maxHeight: 200,
    overflowY: 'auto',
    zIndex: 100,
    marginTop: 4,
  },
  breedOption: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  breedOptionActive: {
    background: 'rgba(108,92,231,0.08)',
    color: 'var(--bg-purple)',
    fontWeight: 700,
  },
}
