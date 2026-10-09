// Логика сцены без DOM: позиция в сетлисте, клавиши, тапы, нарезка нотных строк на экраны.

// screen = -1 — последний экран пункта; станет известен, когда ноты загрузятся.
export type Pos = { item: number; screen: number }

export function step(pos: Pos, dir: 1 | -1, count: number, items: number): Pos {
  if (dir === 1) {
    if (pos.screen < count - 1) return { ...pos, screen: pos.screen + 1 }
    return pos.item < items - 1 ? { item: pos.item + 1, screen: 0 } : pos
  }
  if (pos.screen > 0) return { ...pos, screen: pos.screen - 1 }
  return pos.item > 0 ? { item: pos.item - 1, screen: -1 } : pos
}

export type Action = 'next' | 'prev' | 'toggle' | null

// Педали шлют стрелки или PageUp/PageDown; Enter и пробел — старт и пауза автолистания.
export function keyAction(key: string): Action {
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') return 'next'
  if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') return 'prev'
  if (key === 'Enter' || key === ' ') return 'toggle'
  return null
}

export const tapAction = (x: number, width: number): Action =>
  x < width / 3 ? 'prev' : x > (2 * width) / 3 ? 'next' : 'toggle'

// ponytail: порог долгого нажатия педали — проверить на педали владельца (этап «Живые проверки»)
export const LONG_PRESS_MS = 600

// Экран MusicXML начинается с нотной строки, которая на предыдущем экране была последней целиком видимой:
// музыкант всегда видит продолжение и не теряет строку, которую играет.
export function sliceScreens(systems: { top: number; bottom: number }[], height: number): number[] {
  const starts = [0]
  let first = 0
  for (;;) {
    let last = first
    while (last + 1 < systems.length && systems[last + 1].bottom - systems[first].top <= height) last++
    if (last + 1 >= systems.length) return starts
    first = last > first ? last : first + 1
    starts.push(first)
  }
}

export type Prefs = { prefer: 'pdf' | 'musicxml'; zoom: number }
const PREFS = 'pupitr-prefs'

export function loadPrefs(width: number): Prefs {
  const base: Prefs = { prefer: width < 700 ? 'musicxml' : 'pdf', zoom: 1 }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }
  } catch {
    return base
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p))
  } catch {
    // ponytail: без localStorage настройки живут до перезапуска
  }
}
