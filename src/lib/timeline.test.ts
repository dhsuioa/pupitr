// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseXml } from './musicxml'
import { borrowTempos, duration, pageOfMeasure, played, quarterTempo, readMeasures, unfold } from './timeline'

// Такт с паузой нужной длины; inner — барлайны и указания.
const M = (inner = '', dur = 4) => `<measure>${inner}<note><rest/><duration>${dur}</duration></note></measure>`
function doc(measures: string[], { divisions = 1, time = [4, 4], tempo = 120 as number | null } = {}) {
  const head = `<attributes><divisions>${divisions}</divisions><time><beats>${time[0]}</beats><beat-type>${time[1]}</beat-type></time></attributes>${
    tempo ? `<direction><sound tempo="${tempo}"/></direction>` : ''
  }`
  const first = measures[0].replace('<measure>', `<measure>${head}`)
  return parseXml(
    `<score-partwise><part-list><score-part id="P1"><part-name>A</part-name></score-part></part-list><part id="P1">${[
      first,
      ...measures.slice(1),
    ].join('')}</part></score-partwise>`,
  )
}
const fwd = '<barline location="left"><repeat direction="forward"/></barline>'
const back = (times?: number) =>
  `<barline location="right"><repeat direction="backward"${times ? ` times="${times}"` : ''}/></barline>`
const volta = (n: string) =>
  `<barline location="left"><ending number="${n}" type="start"/></barline><barline location="right"><ending number="${n}" type="stop"/></barline>`
const sound = (attrs: string) => `<direction><sound ${attrs}/></direction>`
const order = (d: Document) => unfold(readMeasures(d))

describe('unfold', () => {
  it('без повторов', () => expect(order(doc([M(), M(), M()]))).toEqual([0, 1, 2]))
  it('повтор к началу', () => expect(order(doc([M(), M(back())]))).toEqual([0, 1, 0, 1]))
  it('повтор с началом и times=3', () => {
    expect(order(doc([M(), M(fwd), M(back(3)), M()]))).toEqual([0, 1, 2, 1, 2, 1, 2, 3])
  })
  it('вольты 1 и 2', () => {
    expect(order(doc([M(), M(volta('1') + back()), M(volta('2'))]))).toEqual([0, 1, 0, 2])
  })
  it('вольта «1, 2» и вольта 3', () => {
    expect(order(doc([M(fwd), M(volta('1, 2') + back(3)), M(volta('3'))]))).toEqual([0, 1, 0, 1, 0, 2])
  })
  it('D.C. al Fine', () => {
    expect(order(doc([M(), M(sound('fine="yes"')), M(sound('dacapo="yes"'))]))).toEqual([0, 1, 2, 0, 1])
  })
  it('D.S. al Coda', () => {
    const d = doc([M(), M(sound('segno="s"')), M(sound('tocoda="c"')), M(sound('dalsegno="s"')), M(sound('coda="c"'))])
    expect(order(d)).toEqual([0, 1, 2, 3, 1, 2, 4])
  })
  it('D.C. al Coda — dacapo плюс tocoda, как пишет MuseScore', () => {
    const d = doc([M(), M(sound('tocoda="coda"')), M(sound('dacapo="yes"')), M(sound('coda="coda"'))])
    expect(order(d)).toEqual([0, 1, 2, 0, 1, 3])
  })
  it('после D.C. повторы не берутся, из вольт играется последняя', () => {
    const d = doc([M(), M(volta('1') + back()), M(volta('2')), M(sound('dacapo="yes"'))])
    expect(order(d)).toEqual([0, 1, 0, 2, 3, 0, 2, 3])
  })
  it('битая разметка не зацикливается', () => {
    expect(order(doc([M(sound('dalsegno="нет"'))]))).toEqual([0, 0])
    expect(order(doc([M(back(99))])).length).toBeLessThanOrEqual(10)
  })
})

describe('played и duration', () => {
  it('время по темпу и длительности тактов, смена темпа с начала такта', () => {
    const p = played(readMeasures(doc([M(), M(sound('tempo="60"')), M('', 2)])), null)!
    expect(p.map((x) => [x.start, x.dur])).toEqual([[0, 2], [2, 4], [6, 2]])
    expect(duration(p)).toBe(8)
  })
  it('затакт короче полного такта', () => {
    expect(played(readMeasures(doc([M('', 1), M()])), null)!.map((x) => x.dur)).toEqual([0.5, 2])
  })
  it('аккорд и второй голос не удлиняют такт, divisions учитываются', () => {
    const chord = '<note><duration>16</duration></note><note><chord/><duration>16</duration></note><backup><duration>16</duration></backup><note><duration>16</duration></note>'
    const d = parseXml(`<score-partwise><part-list><score-part id="P1"><part-name>A</part-name></score-part></part-list><part id="P1"><measure><attributes><divisions>4</divisions></attributes><direction><sound tempo="120"/></direction>${chord}</measure></part></score-partwise>`)
    expect(played(readMeasures(d), null)!.map((x) => x.dur)).toEqual([2])
  })
  it('без темпа: с запасным темпом — считается, без него — null', () => {
    const ms = readMeasures(doc([M(), M()], { tempo: null }))
    expect(played(ms, null)).toBeNull()
    expect(played(ms, 60)!.map((x) => x.dur)).toEqual([4, 4])
  })
  it('два знака темпа в такте — дальше действует последний', () => {
    const p = played(readMeasures(doc([M(), M(sound('tempo="90"') + sound('tempo="60"')), M()])), null)!
    expect(p.map((x) => x.dur)).toEqual([2, 4, 4])
  })
  it('повтор после D.C. возвращает исходный темп', () => {
    const p = played(readMeasures(doc([M(), M(sound('tempo="60"') + sound('dacapo="yes"'))])), null)!
    expect(p.map((x) => x.dur)).toEqual([2, 4, 2, 4])
  })
})

describe('источники темпа и страницы', () => {
  it('темп партитуры переносится в партию без темпа', () => {
    const part = readMeasures(doc([M(), M()], { tempo: null }))
    const score = readMeasures(doc([M(), M(sound('tempo="60"'))]))
    expect(borrowTempos(part, score).map((m) => m.tempo)).toEqual([120, 60])
  })
  it('темп пьесы из BPM и долей: 6/8 «на два», 60 → 90 четвертей', () => {
    expect(quarterTempo(readMeasures(doc([M('', 3)], { time: [6, 8] })), 60, 2)).toBe(90)
  })
  it('страница каждого такта по <print new-page>', () => {
    const page = '<print new-page="yes"/>'
    expect(pageOfMeasure(readMeasures(doc([M(), M(), M(page), M(), M(page)])))).toEqual([0, 0, 1, 1, 2])
  })
})
