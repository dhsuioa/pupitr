import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { errorMessage, isNetworkError } from '../lib/errors'
import { cacheFiles, clearFiles, clearSnapshot, loadSnapshot, saveSnapshot, type Snapshot } from '../lib/offline'
import { normalize } from '../lib/parts'
import type { FileRow, Member, Piece, Position, Setlist, SetlistItem } from '../lib/types'

export type { FileRow, Member, Piece, Position, Setlist, SetlistItem } from '../lib/types'
export type UploadItem = { file: File; kind: 'pdf' | 'musicxml'; partNames: string[]; choice: string } // choice: 'score' или id позиции

// Supabase отдаёт { data, error }; ошибку превращаем в исключение, чтобы ловить в одном месте.
function must<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error
  return r.data as NonNullable<T>
}

const clean = (email: string) => email.trim().toLowerCase()
const bucket = () => supabase.storage.from('scores')

export const useApp = defineStore('app', () => {
  const user = ref<Snapshot['user'] | null>(null)
  const members = ref<Member[]>([])
  const positions = ref<Position[]>([])
  const pieces = ref<Piece[]>([])
  const files = ref<FileRow[]>([])
  const setlists = ref<Setlist[]>([])
  const inviteToken = ref<string | null>(null)
  const loadError = ref('')
  const offline = ref(false)
  const me = computed(() => members.value.find((m) => m.user_id === user.value?.id) ?? null)
  const isOwner = computed(() => me.value?.role === 'owner')

  function apply(s: Snapshot) {
    user.value = s.user
    members.value = s.members
    positions.value = s.positions
    pieces.value = s.pieces
    files.value = s.files
    setlists.value = s.setlists
  }

  // Сессии больше нет: стираем всё, что знали, вместе со снимком на устройстве.
  function forget() {
    user.value = null
    members.value = []
    positions.value = []
    pieces.value = []
    files.value = []
    setlists.value = []
    inviteToken.value = null
    offline.value = false
    clearSnapshot()
    clearFiles()
  }

  // Ошибка getSession — это неудачное обновление токена (обычно сеть), а не выход: сессия в хранилище цела.
  async function refresh() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!data.session) return forget()
    const [m, p, pc, f, s] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('positions').select('*').order('sort'),
      supabase.from('pieces').select('*').order('title'),
      supabase.from('files').select('*'),
      supabase.from('setlists').select('*').order('title'),
    ])
    const snap: Snapshot = {
      user: { id: data.session.user.id, email: data.session.user.email ?? null },
      members: must(m),
      positions: must(p),
      pieces: must(pc),
      files: must(f),
      setlists: must(s),
    }
    apply(snap)
    inviteToken.value = isOwner.value
      ? must(await supabase.from('band').select('invite_token').single()).invite_token
      : null
    offline.value = false
    saveSnapshot(snap)
  }

  // Без сети, но с данными на устройстве — работаем офлайн; без данных — показываем ошибку с «Повторить».
  async function reload() {
    loadError.value = ''
    try {
      await refresh()
    } catch (e) {
      if (isNetworkError(e) && user.value && members.value.length) offline.value = true
      else loadError.value = errorMessage(e)
    }
  }

  // Со снимком интерфейс не ждёт сеть: данные сразу, обновление в фоне.
  let started: Promise<void> | null = null
  function start() {
    if (started) return started
    const snap = loadSnapshot()
    if (snap) apply(snap)
    const network = reload()
    started = snap ? Promise.resolve() : network
    return started
  }

  async function sendCode(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email: clean(email) })
    if (error) throw error
  }

  // Код принят — человек вошёл; сбой загрузки после этого показывает главная, а не форма кода.
  async function verifyCode(email: string, code: string) {
    const { error } = await supabase.auth.verifyOtp({ email: clean(email), token: code.trim(), type: 'email' })
    if (error) throw error
    await reload()
  }

  async function join(token: string) {
    const { error } = await supabase.rpc('join_band', { token })
    if (error) throw error
    await refresh()
  }

  async function updateMe(patch: Partial<Pick<Member, 'position_id' | 'display_name'>>) {
    must(await supabase.from('members').update(patch).eq('user_id', user.value!.id))
    await refresh()
  }

  async function signOut() {
    await supabase.auth.signOut().catch(() => {})
    forget()
  }

  // Дальше — только для владельца; база отклонит чужие вызовы сама.
  async function savePositions(rows: Array<Partial<Position> & { name: string }>) {
    must(await supabase.from('positions').upsert(rows))
    await refresh()
  }

  async function deletePosition(id: string) {
    must(await supabase.from('positions').delete().eq('id', id))
    await refresh()
  }

  async function resetInvite() {
    must(await supabase.from('band').update({ invite_token: crypto.randomUUID() }).eq('id', 1))
    await refresh()
  }

  async function removeMember(userId: string) {
    must(await supabase.from('members').delete().eq('user_id', userId))
    await refresh()
  }

  async function savePiece(p: Partial<Piece> & { title: string }): Promise<string> {
    const row = must(await supabase.from('pieces').upsert(p).select('id').single())
    await refresh()
    return row.id
  }

  // Сначала строки (файлы уходят каскадом), потом объекты: лишний объект безвреден, строка без объекта — нет.
  async function deletePiece(id: string) {
    const paths = files.value.filter((f) => f.piece_id === id).map((f) => f.path)
    must(await supabase.from('pieces').delete().eq('id', id))
    if (paths.length) must(await bucket().remove(paths))
    await refresh()
  }

  async function updateFile(id: string, patch: Partial<Pick<FileRow, 'bars_per_page'>>) {
    must(await supabase.from('files').update(patch).eq('id', id))
    await refresh()
  }

  async function deleteFile(f: FileRow) {
    must(await supabase.from('files').delete().eq('id', f.id))
    must(await bucket().remove([f.path]))
    await refresh()
  }

  async function upload(pieceId: string, items: UploadItem[]) {
    for (const it of items) {
      const ext = it.file.name.split('.').pop()!.toLowerCase()
      const path = `${pieceId}/${crypto.randomUUID()}.${ext}`
      const position_id = it.choice === 'score' ? null : it.choice
      const old = files.value.find((f) => f.piece_id === pieceId && f.position_id === position_id && f.kind === it.kind)
      must(await bucket().upload(path, it.file))
      must(
        await supabase
          .from('files')
          .upsert(
            { piece_id: pieceId, kind: it.kind, position_id, path, name: it.file.name, part_names: it.partNames },
            { onConflict: 'piece_id,position_id,kind' },
          ),
      )
      if (old) must(await bucket().remove([old.path]))
    }
    // Подтверждённые имена партий учат позиции: в следующий раз сопоставится само.
    const learned = positions.value.flatMap((p) => {
      const known = [p.name, ...p.aliases].map(normalize)
      const add = [...new Set(items.filter((it) => it.choice === p.id && it.partNames.length === 1).map((it) => it.partNames[0]))]
        .filter((n) => !known.includes(normalize(n)))
      return add.length ? [{ ...p, aliases: [...p.aliases, ...add] }] : []
    })
    if (learned.length) must(await supabase.from('positions').upsert(learned))
    await refresh()
  }

  async function saveSetlist(s: Partial<Setlist> & { title: string; items: SetlistItem[] }): Promise<string> {
    // Сразу показываем новый порядок, не дожидаясь сервера.
    const i = setlists.value.findIndex((x) => x.id === s.id)
    if (i >= 0) setlists.value[i] = { ...setlists.value[i], ...s }
    const row = must(await supabase.from('setlists').upsert(s).select('id').single())
    await refresh()
    return row.id
  }

  async function deleteSetlist(id: string) {
    must(await supabase.from('setlists').delete().eq('id', id))
    await refresh()
  }

  async function downloadSetlist(paths: string[], onProgress: (n: number) => void) {
    await cacheFiles(paths, async (p) => must(await bucket().download(p)), onProgress)
  }

  return {
    user, members, positions, pieces, files, setlists, inviteToken, loadError, offline, me, isOwner,
    start, refresh, reload, sendCode, verifyCode, join, updateMe, signOut,
    savePositions, deletePosition, resetInvite, removeMember,
    savePiece, deletePiece, updateFile, deleteFile, upload, saveSetlist, deleteSetlist, downloadSetlist,
  }
})
