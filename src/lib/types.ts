// Строки таблиц Supabase в том виде, в каком их отдаёт select('*').
export type Position = { id: string; name: string; aliases: string[]; sort: number }
export type Member = {
  user_id: string
  role: 'owner' | 'musician'
  email: string | null
  display_name: string | null
  position_id: string | null
}
export type Piece = {
  id: string
  title: string
  duration_sec: number | null
  bpm: number | null
  beats_per_bar: number | null
}
export type FileRow = {
  id: string
  piece_id: string
  kind: 'pdf' | 'musicxml'
  position_id: string | null // null — партитура целиком
  path: string
  name: string
  part_names: string[]
  bars_per_page: number[] | null
}
export type SetlistItem = { piece: string } | { label: string; sec: number }
export type Setlist = { id: string; title: string; items: SetlistItem[] }
