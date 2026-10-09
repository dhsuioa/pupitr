import { describe, expect, it } from 'vitest'
import { conflicts, matchPosition, partFromFileName, pickFile, planUpload } from './parts'
import type { FileRow, Position } from './types'

const positions: Position[] = [
  { id: 'tp1', name: 'Труба 1', aliases: ['Trumpet in B♭ 1'], sort: 0 },
  { id: 'bass', name: 'Бас', aliases: ['Bass Guitar'], sort: 1 },
]

describe('matchPosition', () => {
  it('регистр, бемоль, пробелы, дефисы и точки не важны', () => {
    expect(matchPosition('TRUMPET in Bb 1', positions)).toBe('tp1')
    expect(matchPosition('trumpet-in-b♭-1.', positions)).toBe('tp1')
  })
  it('совпадает и с именем самой позиции', () => expect(matchPosition('бас', positions)).toBe('bass'))
  it('нет совпадения или пустое имя — null', () => {
    expect(matchPosition('Flute', positions)).toBeNull()
    expect(matchPosition(' . ', positions)).toBeNull()
  })
})

describe('partFromFileName', () => {
  const batch = ['Song.pdf', 'Song-Trumpet_in_Bb_1.pdf', 'Song-Bass_Guitar.pdf']
  it('имя, которое служит префиксом остальным, — партитура', () => expect(partFromFileName('Song.pdf', batch)).toBeNull())
  it('остаток после «Название-», подчёркивания становятся пробелами', () => {
    expect(partFromFileName('Song-Trumpet_in_Bb_1.pdf', batch)).toBe('Trumpet in Bb 1')
  })
  it('дефис в названии песни не ломает разбор', () => {
    const b = ['Rock-n-Roll.pdf', 'Rock-n-Roll-Bass.pdf']
    expect(partFromFileName('Rock-n-Roll.pdf', b)).toBeNull()
    expect(partFromFileName('Rock-n-Roll-Bass.pdf', b)).toBe('Bass')
  })
  it('одна партия без партитуры в пачке — часть после последнего дефиса', () => {
    expect(partFromFileName('Song-Bass.pdf', ['Song-Bass.pdf'])).toBe('Bass')
  })
  it('одиночный файл без дефиса — партитура', () => expect(partFromFileName('Song.pdf', ['Song.pdf'])).toBeNull())
})

describe('planUpload', () => {
  it('MusicXML: несколько частей — партитура, одна — по алиасу, незнакомая — не выбрано', () => {
    const rows = planUpload(
      [
        { name: 'S.mxl', kind: 'musicxml', xmlParts: ['Trumpet in B♭ 1', 'Bass Guitar'], error: '' },
        { name: 'S-Tp.mxl', kind: 'musicxml', xmlParts: ['Trumpet in B♭ 1'], error: '' },
        { name: 'S-Fl.mxl', kind: 'musicxml', xmlParts: ['Flute'], error: '' },
      ],
      positions,
    )
    expect(rows.map((r) => r.choice)).toEqual(['score', 'tp1', ''])
    expect(rows[0].partNames).toEqual(['Trumpet in B♭ 1', 'Bass Guitar'])
  })
  it('PDF берёт решение у MusicXML с тем же именем', () => {
    const rows = planUpload(
      [
        { name: 'S-Tp.pdf', kind: 'pdf', xmlParts: null, error: '' },
        { name: 'S-Tp.mxl', kind: 'musicxml', xmlParts: ['Trumpet in B♭ 1'], error: '' },
      ],
      positions,
    )
    expect(rows[0]).toEqual({ partNames: ['Trumpet in B♭ 1'], choice: 'tp1' })
  })
  it('PDF без пары — по имени файла', () => {
    const rows = planUpload(
      [
        { name: 'S.pdf', kind: 'pdf', xmlParts: null, error: '' },
        { name: 'S-Bass_Guitar.pdf', kind: 'pdf', xmlParts: null, error: '' },
      ],
      positions,
    )
    expect(rows.map((r) => r.choice)).toEqual(['score', 'bass'])
  })
  it('битый и посторонний файлы — не загружать', () => {
    const rows = planUpload(
      [
        { name: 'x.mxl', kind: 'musicxml', xmlParts: null, error: 'Файл не читается' },
        { name: 'a.docx', kind: null, xmlParts: null, error: 'Не PDF и не MusicXML' },
      ],
      positions,
    )
    expect(rows.map((r) => r.choice)).toEqual(['skip', 'skip'])
  })
})

describe('conflicts', () => {
  it('два файла одного формата на одну партию', () => {
    const rows = [
      { kind: 'pdf', choice: 'tp1' },
      { kind: 'musicxml', choice: 'tp1' },
      { kind: 'pdf', choice: 'tp1' },
      { kind: 'pdf', choice: 'skip' },
      { kind: 'pdf', choice: 'skip' },
    ]
    expect([...conflicts(rows)]).toEqual([0, 2])
  })
  it('две партитуры одного формата', () => {
    expect([...conflicts([{ kind: 'pdf', choice: 'score' }, { kind: 'pdf', choice: 'score' }])]).toEqual([0, 1])
  })
})

describe('pickFile', () => {
  const f = (id: string, kind: 'pdf' | 'musicxml', position_id: string | null, part_names: string[] = []): FileRow => ({
    id, piece_id: 'x', kind, position_id, path: `x/${id}`, name: id, part_names, bars_per_page: null,
  })
  const tp1 = positions[0]
  const score = f('score-xml', 'musicxml', null, ['Trumpet in B♭ 1', 'Bass Guitar'])
  const scorePdf = f('score-pdf', 'pdf', null)

  it('своя партия в предпочитаемом формате, иначе в другом', () => {
    const own = [f('tp-pdf', 'pdf', 'tp1'), f('tp-xml', 'musicxml', 'tp1'), score]
    expect(pickFile(own, tp1, 'pdf')?.file.id).toBe('tp-pdf')
    expect(pickFile(own, tp1, 'musicxml')?.file.id).toBe('tp-xml')
    expect(pickFile([f('tp-pdf', 'pdf', 'tp1')], tp1, 'musicxml')?.file.id).toBe('tp-pdf')
  })
  it('предпочтение MusicXML: часть из партитуры MusicXML раньше своего PDF', () => {
    expect(pickFile([f('tp-pdf', 'pdf', 'tp1'), score], tp1, 'musicxml')).toEqual({ file: score, extract: 'Trumpet in B♭ 1' })
  })
  it('своей партии нет — часть из партитуры MusicXML по алиасу', () => {
    expect(pickFile([scorePdf, score], tp1, 'pdf')).toEqual({ file: score, extract: 'Trumpet in B♭ 1' })
  })
  it('части с таким именем нет — партитура целиком в предпочитаемом формате', () => {
    const flute: Position = { id: 'fl', name: 'Флейта', aliases: [], sort: 2 }
    expect(pickFile([scorePdf, score], flute, 'pdf')).toEqual({ file: scorePdf, extract: null })
    expect(pickFile([scorePdf, score], null, 'musicxml')).toEqual({ file: score, extract: null })
  })
  it('файлов нет — null', () => expect(pickFile([], tp1, 'pdf')).toBeNull())
})
