import type { FileRow, Member, Piece, Position, Setlist, SetlistItem } from './types'

// Снимок библиотеки на устройстве: из него интерфейс рисуется сразу, сеть только обновляет.
export type Snapshot = {
  user: { id: string; email: string | null }
  members: Member[]
  positions: Position[]
  pieces: Piece[]
  files: FileRow[]
  setlists: Setlist[]
}

const KEY = 'pupitr-snapshot'

export function loadSnapshot(): Snapshot | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

export function saveSnapshot(s: Snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // ponytail: переполнение localStorage молча пропускаем; библиотека — десятки КБ при лимите 5 МБ
  }
}

export const clearSnapshot = () => localStorage.removeItem(KEY)

// Файлы скачанных сетлистов лежат в Cache Storage; путь неизменяем, поэтому ключ — сам путь.
const CACHE = 'scores'
const key = (path: string) => `files/${path}`

// Для сетлиста нужны файлы своей позиции и партитуры каждой пьесы.
export function neededPaths(items: SetlistItem[], files: FileRow[], positionId: string | null): string[] {
  const ids = new Set(items.flatMap((it) => ('piece' in it ? [it.piece] : [])))
  return files
    .filter((f) => ids.has(f.piece_id) && (f.position_id === null || f.position_id === positionId))
    .map((f) => f.path)
}

export type OfflineStatus = 'empty' | 'ready' | 'partial' | 'none'
export const offlineStatus = (have: number, total: number): OfflineStatus =>
  total === 0 ? 'empty' : have === total ? 'ready' : have > 0 ? 'partial' : 'none'

// Статус проверяем по факту: Safari может удалить кэш по своим правилам.
export async function cachedCount(paths: string[]): Promise<number> {
  const cache = await caches.open(CACHE)
  const hits = await Promise.all(paths.map((p) => cache.match(key(p))))
  return hits.filter(Boolean).length
}

export async function cacheFiles(paths: string[], fetchFile: (path: string) => Promise<Blob>, onProgress: (n: number) => void) {
  const cache = await caches.open(CACHE)
  let done = 0
  for (const p of paths) {
    if (!(await cache.match(key(p)))) await cache.put(key(p), new Response(await fetchFile(p)))
    onProgress(++done)
  }
  await navigator.storage?.persist?.()
}

// ponytail: старые версии файлов из кэша не чистим — мегабайты; чистка по пути, когда понадобится
export const clearFiles = () => globalThis.caches?.delete(CACHE)

// Сначала с устройства; если файла там нет — из сети и сразу в кэш.
export async function getFile(path: string, fetchFile: (path: string) => Promise<Blob>): Promise<Blob> {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(key(path))
  if (hit) return hit.blob()
  const blob = await fetchFile(path)
  await cache.put(key(path), new Response(blob))
  return blob
}
