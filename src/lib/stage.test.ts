import { describe, expect, it } from 'vitest'
import { keyAction, sliceScreens, step, tapAction } from './stage'

describe('step', () => {
  it('вперёд по экранам, потом в следующий пункт', () => {
    expect(step({ item: 0, screen: 0 }, 1, 3, 2)).toEqual({ item: 0, screen: 1 })
    expect(step({ item: 0, screen: 2 }, 1, 3, 2)).toEqual({ item: 1, screen: 0 })
  })
  it('назад с первого экрана — на последний экран предыдущего пункта', () => {
    expect(step({ item: 1, screen: 0 }, -1, 4, 2)).toEqual({ item: 0, screen: -1 })
    expect(step({ item: 1, screen: 2 }, -1, 4, 2)).toEqual({ item: 1, screen: 1 })
  })
  it('края сетлиста — на месте', () => {
    expect(step({ item: 1, screen: 2 }, 1, 3, 2)).toEqual({ item: 1, screen: 2 })
    expect(step({ item: 0, screen: 0 }, -1, 3, 2)).toEqual({ item: 0, screen: 0 })
  })
})

describe('keyAction и tapAction', () => {
  it('педали и клавиатура', () => {
    expect(['ArrowRight', 'ArrowDown', 'PageDown'].map(keyAction)).toEqual(['next', 'next', 'next'])
    expect(['ArrowLeft', 'ArrowUp', 'PageUp'].map(keyAction)).toEqual(['prev', 'prev', 'prev'])
    expect(['Enter', ' '].map(keyAction)).toEqual(['toggle', 'toggle'])
    expect(keyAction('a')).toBeNull()
  })
  it('трети экрана', () => {
    expect(tapAction(10, 300)).toBe('prev')
    expect(tapAction(150, 300)).toBe('toggle')
    expect(tapAction(290, 300)).toBe('next')
  })
})

describe('sliceScreens', () => {
  const sys = (n: number, h = 100) => Array.from({ length: n }, (_, k) => ({ top: k * h, bottom: (k + 1) * h }))
  it('следующий экран начинается с последней целиком видимой строки', () => {
    expect(sliceScreens(sys(6), 300)).toEqual([0, 2, 4])
  })
  it('всё влезло — один экран', () => expect(sliceScreens(sys(3), 500)).toEqual([0]))
  it('строка выше экрана — по одной строке, без зацикливания', () => {
    expect(sliceScreens(sys(3, 400), 300)).toEqual([0, 1, 2])
  })
  it('нет строк — один экран', () => expect(sliceScreens([], 300)).toEqual([0]))
})
