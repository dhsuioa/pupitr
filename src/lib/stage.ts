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

export type Prefs = { prefer: 'pdf' | 'musicxml'; zoom: number; lead: number }
const PREFS = 'pupitr-prefs'

export function loadPrefs(width: number): Prefs {
  const base: Prefs = { prefer: width < 700 ? 'musicxml' : 'pdf', zoom: 1, lead: 1 }
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

// Расписание автолистания: в момент t показать экран screen.
export type Ev = { t: number; screen: number }
export type Plan = { events: Ev[]; total: number }

// lead — на сколько тактов раньше листать (PDF): глаз музыканта уже прочитал последний такт страницы.
export function schedule(played: { start: number; screen: number }[], lead: number): Ev[] {
  if (!played.length) return []
  const ev: Ev[] = [{ t: 0, screen: played[0].screen }]
  for (let k = 1; k < played.length; k++) {
    if (played[k].screen === played[k - 1].screen) continue
    const t = played[Math.max(0, k - lead)].start
    ev.push({ t: Math.max(t, ev[ev.length - 1].t), screen: played[k].screen })
  }
  return ev
}

export function makePlan(played: { start: number; dur: number; screen: number }[], lead: number): Plan {
  const last = played[played.length - 1]
  return { events: schedule(played, lead), total: last ? last.start + last.dur : 0 }
}

export function eventIndexAt(events: Ev[], t: number): number {
  let k = 0
  while (k + 1 < events.length && events[k + 1].t <= t) k++
  return k
}

export const firstEventTime = (events: Ev[], screen: number) => events.find((e) => e.screen === screen)?.t ?? 0

export function screenOf(screens: number[], system: number): number {
  let k = 0
  while (k + 1 < screens.length && screens[k + 1] <= system) k++
  return k
}

export function linearPlayed(barsPerPage: number[], secPerBar: number) {
  return barsPerPage.flatMap((bars, page) => Array.from({ length: bars }, () => page)).map((screen, k) => ({
    start: k * secPerBar,
    dur: secPerBar,
    screen,
  }))
}
