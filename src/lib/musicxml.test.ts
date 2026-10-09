// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parseXml, partNames, readMusicXml } from './musicxml'

const score = (...names: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list>${names
  .map((n, i) => `<score-part id="P${i + 1}"><part-name>${n}</part-name></score-part>`)
  .join('')}</part-list>${names.map((_, i) => `<part id="P${i + 1}"><measure number="1"/></part>`).join('')}</score-partwise>`

const bytes = (s: string) => new TextEncoder().encode(s).slice().buffer

async function zipOf(files: Record<string, string>) {
  const zip = new JSZip()
  for (const [path, text] of Object.entries(files)) zip.file(path, text)
  return (await zip.generateAsync({ type: 'uint8array' })).slice().buffer
}

const container = (path: string) => `<container><rootfiles><rootfile full-path="${path}"/></rootfiles></container>`

describe('readMusicXml', () => {
  it('несжатый файл читается как текст', async () => {
    expect(await readMusicXml(bytes(score('Bass')), 'Song-Bass.musicxml')).toContain('<part-name>Bass</part-name>')
  })
  it('.mxl распаковывается по container.xml, регистр расширения не важен', async () => {
    const data = await zipOf({ 'META-INF/container.xml': container('Song/inner.musicxml'), 'Song/inner.musicxml': score('Bass') })
    expect(await readMusicXml(data, 'Song.MXL')).toContain('Bass')
  })
  it('битый .mxl — ошибка', async () => {
    await expect(readMusicXml(bytes('not a zip'), 'x.mxl')).rejects.toThrow()
  })
  it('.mxl без нот — понятная ошибка', async () => {
    await expect(readMusicXml(await zipOf({ 'readme.txt': 'нет нот' }), 'x.mxl')).rejects.toThrow('В архиве .mxl нет нот')
  })
})

describe('parseXml и partNames', () => {
  it('имена частей по порядку, без краевых пробелов, с ♭', () => {
    expect(partNames(parseXml(score(' Trumpet in B♭ 1 ', 'Bass')))).toEqual(['Trumpet in B♭ 1', 'Bass'])
  })
  it('не MusicXML — понятная ошибка', () => {
    expect(() => parseXml('<html><body/></html>')).toThrow('Это не MusicXML')
    expect(() => parseXml('<<<')).toThrow('Это не MusicXML')
  })
})
