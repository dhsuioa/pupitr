// @vitest-environment jsdom
/// <reference types="node" />
// Настоящие файлы из fixtures/ (в git не идут, см. fixtures/README.md). Без папки — тест пропускается, как в CI.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPart, parseXml, partNames, readMusicXml } from './musicxml'
import { pageOfMeasure, played, readMeasures, unfold } from './timeline'

// Путь от корня проекта: new URL(…, import.meta.url) Vite превращает в адрес ассета.
const url = (p: string) => join(process.cwd(), 'fixtures', p)
const doc = async (p: string) => {
  const b = readFileSync(url(p))
  return parseXml(await readMusicXml(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), p))
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k)
// Раздел |: from … to :| с вольтами: первый проход целиком, второй — без первой вольты, затем вторая вольта.
const voltaSection = (from: number, volta1: number, volta2: number) => [...range(from, volta1), ...range(from, volta1 - 1), volta2]

describe.skipIf(!existsSync(url('README.md')))('настоящие файлы', () => {
  it('Джоплин, «Entertainer»: вступление и четыре раздела с вольтами — как играет пианист', async () => {
    const order = unfold(readMeasures(await doc('repeats/ScottJoplin_The_Entertainer.xml')))
    expect(order).toEqual([
      ...range(0, 3),
      ...voltaSection(4, 19, 20),
      ...voltaSection(21, 36, 37),
      ...range(38, 53),
      ...voltaSection(54, 69, 70),
      ...range(71, 74),
      ...voltaSection(75, 90, 91),
    ])
  })

  it('«Сальтарелло»: повтор к началу с вольтами, второй раздел с вольтами', async () => {
    const order = unfold(readMeasures(await doc('repeats/Saltarello.mxl')))
    expect(order).toEqual([...range(0, 7), ...range(0, 5), 8, 9, ...range(10, 19), ...range(10, 17), 20, 21])
  })

  it('MuseScore D.S. al Coda: до D.S., от знака до «To Coda», кода', async () => {
    const order = unfold(readMeasures(await doc('jumps/testDSalCoda.xml')))
    expect(order).toEqual([...range(0, 9), 1, 2, ...range(10, 13)])
  })

  it('MuseScore D.C. al Coda, D.C. al Fine, D.S.', async () => {
    expect(unfold(readMeasures(await doc('jumps/testDCalCoda_ref.xml')))).toEqual([...range(0, 5), 0, 1, 4, 5])
    expect(unfold(readMeasures(await doc('jumps/testDCalFine.xml')))).toEqual([0, 1, 2, 0, 1])
    expect(unfold(readMeasures(await doc('jumps/testDalSegno.xml')))).toEqual([0, 1, 2, 1, 2])
  })

  it('смена темпа 60 → 90 → 120 ускоряет такты', async () => {
    const p = played(readMeasures(await doc('jumps/testTempo1.xml')), null)!
    expect(p[0].dur).toBeCloseTo(p[1].dur)
    expect(p[2].dur / p[0].dur).toBeCloseTo(60 / 90)
    expect(p[4].dur / p[0].dur).toBeCloseTo(60 / 120)
  })

  it('партия с мультипаузами: 35 тактов по 4 четверти, темпа нет — нужен запасной', async () => {
    const ms = readMeasures(await doc('part-multirest/testMultiMeasureRest4.xml'))
    expect(ms).toHaveLength(35)
    expect(ms.every((m) => m.quarters === 4)).toBe(true)
    expect(played(ms, null)).toBeNull()
    const p = played(ms, 120)!
    expect(p[p.length - 1].start + p[p.length - 1].dur).toBe(70)
  })

  it('партитуры: части читаются, каждая вырезается и остаётся годной для OSMD', async () => {
    for (const f of ['score/Mozart_String_Quartet_in_G_K._387_1st_Mvmnt_excerpt.musicxml', 'score/ActorPreludeSample.xml']) {
      const d = await doc(f)
      const names = partNames(d)
      expect(names.length).toBeGreaterThan(1)
      // jsdom клонирует 1,2 МБ в сотни раз медленнее браузера — у большой партитуры берём первую, среднюю и последнюю часть.
      const sample = names.length > 6 ? [names[0], names[Math.floor(names.length / 2)], names[names.length - 1]] : names
      for (const name of new Set(sample)) {
        const xml = extractPart(d, name)
        expect(xml).toMatch(/^<\?xml/)
        expect(partNames(parseXml(xml))).toEqual([name])
      }
    }
  }, 30000)

  it('«Christbaum» Корнелиуса: три страницы по <print new-page>', async () => {
    const page = pageOfMeasure(readMeasures(await doc('score/Cornelius_P_Christbaum_Opus_8_1_1865.mxl')))
    expect(page[page.length - 1]).toBe(2)
  })
})
