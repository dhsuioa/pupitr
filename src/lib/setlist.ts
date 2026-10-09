import type { Piece, SetlistItem } from './types'

// 225 → «3:45», 3725 → «1:02:05»
export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

// «3:45» → 225, «1:02:05» → 3725, «15» → 900 (одно число — минуты). Пустое или мусор → null.
export function parseDuration(text: string): number | null {
  const t = text.trim()
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null
  const parts = t.split(':').map(Number)
  if (parts.length === 1) return parts[0] * 60
  if (parts.slice(1).some((p) => p >= 60)) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export const itemSeconds = (item: SetlistItem, pieces: Piece[]): number =>
  'piece' in item ? (pieces.find((p) => p.id === item.piece)?.duration_sec ?? 0) : item.sec

export const setlistTotal = (items: SetlistItem[], pieces: Piece[]): number =>
  items.reduce((sum, item) => sum + itemSeconds(item, pieces), 0)
