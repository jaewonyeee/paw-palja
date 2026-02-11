import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useState, useRef, useEffect } from 'react'

const LANGUAGES = [
  { code: 'ko', label: 'KO', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'en', label: 'EN', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'ja', label: 'JA', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'zh', label: 'ZH', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'es', label: 'ES', flag: '\u{1F1EA}\u{1F1F8}' },
]

export default function LanguageToggle({ style, compact = false }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[1]

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectLanguage = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  if (compact) {
    return (
      <div ref={ref} style={{ position: 'relative', ...style }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(!open)}
          style={styles.compactButton}
        >
          <span style={styles.languageIcon}>{'\u{1F310}'}</span>
          <span style={styles.currentLang}>{current.label}</span>
        </motion.button>
        {open && (
          <div style={styles.dropdown}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => selectLanguage(lang.code)}
                style={{
                  ...styles.dropdownItem,
                  ...(lang.code === i18n.language ? styles.dropdownItemActive : {}),
                }}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        style={styles.toggleButton}
      >
        {LANGUAGES.map((lang, i) => (
          <span key={lang.code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={styles.divider}>|</span>}
            <motion.span
              style={{
                ...styles.languageOption,
                ...(lang.code === i18n.language ? styles.activeOption : styles.inactiveOption),
              }}
              animate={{ fontWeight: lang.code === i18n.language ? 700 : 400 }}
            >
              {lang.label}
            </motion.span>
          </span>
        ))}
      </motion.button>
      {open && (
        <div style={styles.dropdown}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              style={{
                ...styles.dropdownItem,
                ...(lang.code === i18n.language ? styles.dropdownItemActive : {}),
              }}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1.5px solid #E0E0E0',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  languageOption: {
    fontSize: '0.75rem',
    transition: 'all 0.2s ease',
  },
  activeOption: {
    color: '#FF9F43',
  },
  inactiveOption: {
    color: '#B0B0B0',
  },
  divider: {
    color: '#E0E0E0',
    fontSize: '0.75rem',
  },
  compactButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#666',
    transition: 'all 0.2s ease',
  },
  languageIcon: {
    fontSize: '1rem',
  },
  currentLang: {
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'white',
    borderRadius: 12,
    border: '1.5px solid #E0E0E0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 1000,
    overflow: 'hidden',
    minWidth: 90,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 500,
    color: '#555',
    transition: 'background 0.15s',
  },
  dropdownItemActive: {
    background: 'rgba(255, 159, 67, 0.1)',
    color: '#FF9F43',
    fontWeight: 700,
  },
}
