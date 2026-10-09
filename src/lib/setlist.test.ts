import { describe, expect, it } from 'vitest'
import { formatDuration, parseDuration, setlistTotal } from './setlist'
import type { Piece } from './types'

describe('formatDuration', () => {
  it('минуты и секунды', () => expect(formatDuration(225)).toBe('3:45'))
  it('меньше минуты', () => expect(formatDuration(7)).toBe('0:07'))
  it('часы', () => expect(formatDuration(3725)).toBe('1:02:05'))
})

describe('parseDuration', () => {
  it('мм:сс', () => expect(parseDuration('3:45')).toBe(225))
  it('ч:мм:сс', () => expect(parseDuration('1:02:05')).toBe(3725))
  it('одно число — это минуты', () => expect(parseDuration(' 15 ')).toBe(900))
  it('пустое и мусор — null', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('3:75')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
  })
})

describe('setlistTotal', () => {
  const pieces: Piece[] = [
    { id: 'a', title: 'A', duration_sec: 200, bpm: null, beats_per_bar: null },
    { id: 'b', title: 'B', duration_sec: null, bpm: null, beats_per_bar: null },
  ]
  it('складывает пьесы и пункты без нот', () => {
    expect(setlistTotal([{ piece: 'a' }, { label: 'Антракт', sec: 900 }], pieces)).toBe(1100)
  })
  it('пьеса без длительности и удалённая пьеса дают ноль', () => {
    expect(setlistTotal([{ piece: 'b' }, { piece: 'gone' }], pieces)).toBe(0)
  })
})
