import { describe, expect, it } from 'vitest'
import { neededPaths, offlineStatus } from './offline'
import type { FileRow } from './types'

const file = (id: string, piece_id: string, position_id: string | null): FileRow => ({
  id, piece_id, position_id, kind: 'pdf', path: `${piece_id}/${id}.pdf`, name: `${id}.pdf`, part_names: [], bars_per_page: null,
})
const files = [file('s', 'a', null), file('bass', 'a', 'p-bass'), file('gtr', 'a', 'p-gtr'), file('s2', 'b', null), file('x', 'c', null)]

describe('neededPaths', () => {
  it('своя партия и партитура каждой пьесы сетлиста, чужие партии и другие пьесы — нет', () => {
    expect(neededPaths([{ piece: 'a' }, { label: 'Антракт', sec: 900 }, { piece: 'b' }], files, 'p-bass')).toEqual([
      'a/s.pdf', 'a/bass.pdf', 'b/s2.pdf',
    ])
  })
  it('без позиции — только партитуры', () => {
    expect(neededPaths([{ piece: 'a' }], files, null)).toEqual(['a/s.pdf'])
  })
  it('удалённая пьеса ничего не добавляет', () => {
    expect(neededPaths([{ piece: 'gone' }], files, 'p-bass')).toEqual([])
  })
})

describe('offlineStatus', () => {
  it('нет нот, всё скачано, часть, ничего', () => {
    expect(offlineStatus(0, 0)).toBe('empty')
    expect(offlineStatus(3, 3)).toBe('ready')
    expect(offlineStatus(1, 3)).toBe('partial')
    expect(offlineStatus(0, 3)).toBe('none')
  })
})
