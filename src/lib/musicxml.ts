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

// Оставляет в партитуре одну часть: лишние <score-part> и <part> убираются до отрисовки.
export function extractPart(doc: Document, partName: string): string {
  const copy = doc.cloneNode(true) as Document
  const parts = [...copy.querySelectorAll('part-list > score-part')]
  const keep = parts.find((p) => p.querySelector('part-name')?.textContent?.trim() === partName)
  if (keep) {
    for (const p of parts) {
      if (p === keep) continue
      copy.querySelector(`part[id="${p.getAttribute('id')}"]`)?.remove()
      p.remove()
    }
  }
  return new XMLSerializer().serializeToString(copy)
}
