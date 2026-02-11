import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from './locales/en/translation.json'
import koTranslation from './locales/ko/translation.json'
import jaTranslation from './locales/ja/translation.json'
import zhTranslation from './locales/zh/translation.json'
import esTranslation from './locales/es/translation.json'

const resources = {
  en: {
    translation: enTranslation,
  },
  ko: {
    translation: koTranslation,
  },
  ja: {
    translation: jaTranslation,
  },
  zh: {
    translation: zhTranslation,
  },
  es: {
    translation: esTranslation,
  },
}

i18n
  // 브라우저 언어 감지
  .use(LanguageDetector)
  // react-i18next 초기화
  .use(initReactI18next)
  // 설정
  .init({
    resources,
    fallbackLng: 'en', // 기본값(fallback)은 영어
    lng: undefined, // LanguageDetector가 자동으로 감지
    debug: false, // 개발 시 true로 설정하면 콘솔에 디버그 로그 출력

    // 언어 감지 옵션
    detection: {
      // 우선순위: localStorage > navigator (브라우저 언어)
      order: ['localStorage', 'navigator'],
      // localStorage 키 이름
      lookupLocalStorage: 'i18nextLng',
      // 지원 언어만 허용
      checkWhitelist: true,
    },

    // 지원 언어 목록
    supportedLngs: ['en', 'ko', 'ja', 'zh', 'es'],
    // 비표준 언어 코드 매핑 (예: ko-KR -> ko)
    load: 'languageOnly',

    interpolation: {
      escapeValue: false, // React는 XSS 보호가 내장되어 있음
    },

    react: {
      useSuspense: false, // Suspense 사용 안 함 (호환성)
    },
  })

export default i18n
