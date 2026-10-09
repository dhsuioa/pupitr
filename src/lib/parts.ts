import type { Position } from './types'

// «Trumpet in B♭ 1» → «trumpetinbb1»: регистр, бемоль и всё, кроме букв и цифр, не важны.
export const normalize = (s: string) => s.toLowerCase().replace(/♭/g, 'b').replace(/[^\p{L}\p{N}]/gu, '')

export function matchPosition(partName: string, positions: Position[]): string | null {
  const n = normalize(partName)
  if (!n) return null
  return positions.find((p) => [p.name, ...p.aliases].some((a) => normalize(a) === n))?.id ?? null
}

const base = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

// MuseScore называет партитуру «Песня.pdf», а партии «Песня-Бас_гитара.pdf». null — партитура.
export function partFromFileName(fileName: string, batch: string[]): string | null {
  const b = base(fileName)
  const bases = batch.map(base)
  const score = bases.filter((x) => bases.some((y) => y.startsWith(`${x}-`))).sort((x, y) => x.length - y.length)[0]
  let part: string | null
  if (score !== undefined && b === score) part = null
  else if (score !== undefined && b.startsWith(`${score}-`)) part = b.slice(score.length + 1)
  else part = b.includes('-') ? b.slice(b.lastIndexOf('-') + 1) : null
  return part === null ? null : part.replace(/_/g, ' ').trim() || null
}

export type Analyzed = { name: string; kind: 'pdf' | 'musicxml' | null; xmlParts: string[] | null; error: string }

// Первое предложение для таблицы подтверждения: что это за файл.
export function planUpload(items: Analyzed[], positions: Position[]): Array<{ partNames: string[]; choice: string }> {
  const names = items.map((i) => i.name)
  const own = items.map((i) => {
    if (i.error || !i.kind) return { partNames: [], choice: 'skip' }
    if (i.xmlParts) {
      if (i.xmlParts.length !== 1) return { partNames: i.xmlParts, choice: 'score' }
      return { partNames: i.xmlParts, choice: matchPosition(i.xmlParts[0], positions) ?? '' }
    }
    const part = partFromFileName(i.name, names)
    return part === null ? { partNames: [], choice: 'score' } : { partNames: [part], choice: matchPosition(part, positions) ?? '' }
  })
  // PDF берёт решение у MusicXML с тем же именем: содержимое надёжнее имени файла.
  return own.map((row, k) => {
    const i = items[k]
    if (i.kind !== 'pdf' || i.error) return row
    const twin = items.findIndex((j) => j.kind === 'musicxml' && !j.error && base(j.name) === base(i.name))
    return twin === -1 ? row : { ...own[twin] }
  })
}

// Две строки одного формата на одну партию: вторая молча заменила бы первую.
export function conflicts(rows: Array<{ kind: string | null; choice: string }>): Set<number> {
  const seen = new Map<string, number>()
  const bad = new Set<number>()
  rows.forEach((r, k) => {
    if (r.choice === 'skip' || r.choice === '' || !r.kind) return
    const key = `${r.kind}:${r.choice}`
    const first = seen.get(key)
    if (first === undefined) seen.set(key, k)
    else bad.add(first).add(k)
  })
  return bad
}
