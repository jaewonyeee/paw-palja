export const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

export const MOOD_MAP = {
  sparkles: '✨', heart: '❤️', 'cloud-rain': '🌧️', star: '⭐', fire: '🔥',
  sun: '☀️', moon: '🌙', rainbow: '🌈',
}

export function formatDate(dateStr) {
  const d = new Date(dateStr)
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    dayName: DAY_KR[d.getDay()],
    year: d.getFullYear(),
  }
}

export function todayString() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export function dateLabel(dateStr) {
  const d = new Date(dateStr || Date.now())
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_KR[d.getDay()]}요일`
}
