// Такты MusicXML в порядке исполнения и их время — основа автолистания.

export type Measure = {
  quarters: number // длительность по содержимому, в четвертях
  timeQuarters: number // длина такта по текущему размеру
  forward: boolean
  backward: number // сколько раз играть секцию; 0 — повтора нет
  endingStart: number[] | null
  endingStop: boolean
  segno: string | null
  coda: string | null
  tocoda: string | null
  dacapo: boolean
  dalsegno: string | null
  fine: boolean
  tempo: number | null // четвертей в минуту с начала такта
  newPage: boolean
}

const num = (el: Element | null | undefined) => Number(el?.textContent ?? 0)
const measuresOf = (part: Element) => [...part.children].filter((c) => c.tagName === 'measure')

export function readMeasures(doc: Document): Measure[] {
  const parts = [...doc.querySelectorAll('part')].map(measuresOf)
  if (!parts.length) return []
  let divisions = 1
  let timeQuarters = 4
  return parts[0].map((m, i) => {
    const d = m.querySelector('attributes > divisions')
    if (d) divisions = num(d) || 1
    const time = m.querySelector('attributes > time')
    if (time) timeQuarters = (num(time.querySelector('beats')) * 4) / (num(time.querySelector('beat-type')) || 4)
    let pos = 0
    let max = 0
    for (const el of m.children) {
      if (el.tagName === 'note' && !el.querySelector('chord') && !el.querySelector('grace')) pos += num(el.querySelector('duration'))
      else if (el.tagName === 'backup') pos -= num(el.querySelector('duration'))
      else if (el.tagName === 'forward') pos += num(el.querySelector('duration'))
      max = Math.max(max, pos)
    }
    // Указания MuseScore пишет в верхнюю часть, поэтому <sound> собираем со всех частей.
    const sounds = parts.flatMap((p) => [...(p[i]?.querySelectorAll('sound') ?? [])])
    const attr = (name: string) => sounds.find((s) => s.hasAttribute(name))?.getAttribute(name) ?? null
    const tempo = Number(attr('tempo'))
    const back = m.querySelector('repeat[direction="backward"]')
    const ending = m.querySelector('ending[type="start"]')
    return {
      quarters: max ? max / divisions : timeQuarters,
      timeQuarters,
      forward: !!m.querySelector('repeat[direction="forward"]'),
      backward: back ? Number(back.getAttribute('times') ?? 2) || 2 : 0,
      endingStart: ending ? ((ending.getAttribute('number') ?? '').match(/\d+/g)?.map(Number) ?? [1]) : null,
      endingStop: !!m.querySelector('ending[type="stop"], ending[type="discontinue"]'),
      segno: attr('segno'),
      coda: attr('coda'),
      tocoda: attr('tocoda'),
      dacapo: attr('dacapo') === 'yes',
      dalsegno: attr('dalsegno'),
      fine: attr('fine') !== null,
      tempo: tempo > 0 ? tempo : null,
      newPage: !!m.querySelector('print[new-page="yes"]'),
    }
  })
}

// Порядок исполнения. После D.C./D.S. повторы не берутся и играется последняя вольта — общая условность.
export function unfold(ms: Measure[]): number[] {
  const n = ms.length
  const out: number[] = []
  const endingEnd = (i: number) => {
    for (let j = i; j < n; j++) if (ms[j].endingStop) return j
    return n - 1
  }
  const label = (key: 'segno' | 'coda', value: string, after = 0) => {
    const exact = ms.findIndex((m, k) => k >= after && m[key] === value)
    return exact >= 0 ? exact : ms.findIndex((m, k) => k >= after && m[key] !== null)
  }
  let i = 0
  let pass = 1
  let section = 0
  let jumped = false
  while (i < n && out.length < 10 * n) {
    const m = ms[i]
    if (m.forward && section !== i) {
      section = i
      pass = 1
    }
    if (m.endingStart) {
      const end = endingEnd(i)
      const take = jumped ? !ms[end + 1]?.endingStart : m.endingStart.includes(pass)
      if (!take) {
        i = end + 1
        continue
      }
    }
    out.push(i)
    if (jumped && m.fine) break
    if (jumped && m.tocoda !== null) {
      const c = label('coda', m.tocoda, i + 1)
      if (c >= 0) {
        i = c
        continue
      }
    }
    if (!jumped && m.backward) {
      if (pass < m.backward) {
        pass++
        i = section
        continue
      }
      section = i + 1
      pass = 1
    }
    if (!jumped && (m.dacapo || m.dalsegno !== null)) {
      jumped = true
      i = m.dacapo ? 0 : Math.max(0, label('segno', m.dalsegno!))
      section = i
      continue
    }
    i++
  }
  return out
}

export type Played = { measure: number; start: number; dur: number }

// Время каждого сыгранного такта. Темп — последний знак темпа не позже такта в порядке нот.
export function played(ms: Measure[], fallbackQpm: number | null): Played[] | null {
  const first = ms[0]?.tempo ?? fallbackQpm ?? ms.find((m) => m.tempo)?.tempo ?? null
  if (first === null) return null
  const qpm: number[] = []
  ms.forEach((m, i) => (qpm[i] = m.tempo ?? (i ? qpm[i - 1] : first)))
  let t = 0
  return unfold(ms).map((measure) => {
    const dur = (ms[measure].quarters * 60) / qpm[measure]
    const p = { measure, start: t, dur }
    t += dur
    return p
  })
}

export const duration = (p: Played[]) => (p.length ? p[p.length - 1].start + p[p.length - 1].dur : 0)

// Партия из MuseScore до 4.6 могла выйти без темпа — берём темпы партитуры по номерам тактов.
export const borrowTempos = (ms: Measure[], from: Measure[]): Measure[] =>
  ms.some((m) => m.tempo) ? ms : ms.map((m, i) => ({ ...m, tempo: from[i]?.tempo ?? null }))

// BPM и доли пьесы → четверти в минуту по размеру первого такта.
export const quarterTempo = (ms: Measure[], bpm: number, beats: number) => ((ms[0]?.timeQuarters ?? 4) * bpm) / beats

export function pageOfMeasure(ms: Measure[]): number[] {
  let page = 0
  return ms.map((m, i) => (m.newPage && i > 0 ? ++page : page))
}
