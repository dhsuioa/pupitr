import type { FileRow, Member, Piece, Position, Setlist } from './types'

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
