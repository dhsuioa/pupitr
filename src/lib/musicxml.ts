// Чтение MusicXML из MuseScore. .mxl — это zip: META-INF/container.xml указывает на корневой файл с нотами.
export async function readMusicXml(data: ArrayBuffer, name: string): Promise<string> {
  if (!name.toLowerCase().endsWith('.mxl')) return new TextDecoder().decode(data)
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const container = await zip.file('META-INF/container.xml')?.async('string')
  const root = container?.match(/full-path="([^"]+)"/)?.[1]
  const xml = root ? await zip.file(root)?.async('string') : undefined
  if (!xml) throw new Error('В архиве .mxl нет нот')
  return xml
}

export function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror') || !doc.querySelector('score-partwise')) throw new Error('Это не MusicXML')
  return doc
}

export const partNames = (doc: Document): string[] =>
  [...doc.querySelectorAll('part-list > score-part')].map((p) => p.querySelector('part-name')?.textContent?.trim() ?? '')
