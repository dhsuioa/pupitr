import { describe, expect, it } from 'vitest'
import { eventIndexAt, eventTimeNear, keyAction, linearPlayed, makePlan, schedule, screenOf, sliceScreens, step, tapAction } from './stage'

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

describe('расписание', () => {
  const pl = (screens: number[], dur = 2) => screens.map((screen, k) => ({ start: k * dur, dur, screen }))
  it('без упреждения — экран меняется в начале первого такта на нём', () => {
    expect(schedule(pl([0, 0, 1, 1, 2]), 0)).toEqual([{ t: 0, screen: 0 }, { t: 4, screen: 1 }, { t: 8, screen: 2 }])
  })
  it('упреждение в такт — когда начинается последний такт страницы', () => {
    expect(schedule(pl([0, 0, 1, 1, 2]), 1)).toEqual([{ t: 0, screen: 0 }, { t: 2, screen: 1 }, { t: 6, screen: 2 }])
  })
  it('повтор назад возвращает на ранний экран', () => {
    expect(schedule(pl([0, 1, 0, 1]), 0).map((e) => e.screen)).toEqual([0, 1, 0, 1])
  })
  it('упреждение не уводит раньше предыдущего события', () => {
    expect(schedule(pl([0, 1, 2]), 3).map((e) => e.t)).toEqual([0, 0, 0])
  })
  it('план знает общую длительность', () => expect(makePlan(pl([0, 1]), 0).total).toBe(4))
})

describe('поиск по расписанию', () => {
  const ev = [{ t: 0, screen: 0 }, { t: 4, screen: 1 }, { t: 8, screen: 0 }]
  it('событие в момент t, до начала — первое', () => {
    expect(eventIndexAt(ev, -1)).toBe(0)
    expect(eventIndexAt(ev, 5)).toBe(1)
    expect(eventIndexAt(ev, 100)).toBe(2)
  })
  it('показ экрана, ближайший к моменту: свежий старт — первый показ, после паузы — текущий проход', () => {
    const rep = [{ t: 0, screen: 0 }, { t: 10, screen: 1 }, { t: 20, screen: 0 }, { t: 30, screen: 1 }, { t: 40, screen: 2 }]
    expect(eventTimeNear(rep, 1, 0)).toBe(10)
    expect(eventTimeNear(rep, 0, 35)).toBe(20)
    expect(eventTimeNear(ev, 7, 12)).toBe(12)
  })
  it('экран нотной строки — последний экран, начавшийся не позже неё', () => {
    expect([0, 1, 2, 3, 4].map((s) => screenOf([0, 2, 4], s))).toEqual([0, 0, 1, 1, 2])
  })
  it('ручной PDF: лишние значения тактов не уводят за последнюю страницу', () => {
    expect(linearPlayed([1, 1, 1], 2, 2).map((p) => p.screen)).toEqual([0, 1, 1])
  })
  it('ручной PDF: такты по страницам с одной длительностью', () => {
    expect(linearPlayed([2, 1], 3, 2)).toEqual([
      { start: 0, dur: 3, screen: 0 },
      { start: 3, dur: 3, screen: 0 },
      { start: 6, dur: 3, screen: 1 },
    ])
  })
})
