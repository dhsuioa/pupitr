// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { loadSnapshot, saveSnapshot, type Snapshot } from '../lib/offline'

const { auth, from, storage } = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn() },
  from: vi.fn(),
  storage: { from: vi.fn() },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth, from, storage } }))

import { useApp } from './app'

const snap: Snapshot = {
  user: { id: 'u1', email: 'a@b.c' },
  members: [{ user_id: 'u1', role: 'musician', email: 'a@b.c', display_name: null, position_id: 'p1' }],
  positions: [{ id: 'p1', name: 'Бас', aliases: [], sort: 0 }],
  pieces: [{ id: 'x', title: 'Песня', duration_sec: 200, bpm: null, beats_per_bar: null }],
  files: [],
  setlists: [],
}
const session = { data: { session: { user: { id: 'u1', email: 'a@b.c' } } }, error: null }
const offlineError = { message: 'TypeError: Failed to fetch' }

const upserts: unknown[] = []

// Ответ PostgREST: цепочка select().order()/upsert() и await в любой точке.
function query(data: unknown, error: unknown = null) {
  const q = {
    select: () => q,
    order: () => q,
    upsert: (row: unknown) => (upserts.push(row), q),
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data, error }).then(ok, bad),
  }
  return q
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.resetAllMocks()
  upserts.length = 0
})

const tables: Record<string, unknown> = {
  members: snap.members,
  positions: snap.positions,
  pieces: snap.pieces,
  files: [],
  setlists: [],
}

describe('запуск', () => {
  it('со снимком и без сети: сразу данные из снимка, затем плашка «нет связи», снимок цел', async () => {
    saveSnapshot(snap)
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Load failed' } })
    const app = useApp()
    await app.start()
    expect(app.me?.position_id).toBe('p1')
    expect(app.pieces).toHaveLength(1)
    await vi.waitFor(() => expect(app.offline).toBe(true))
    expect(app.user?.id).toBe('u1')
    expect(loadSnapshot()).toEqual(snap)
  })

  it('сессия пропала сама: ноты и снимок остаются, просим войти снова', async () => {
    saveSnapshot(snap)
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const app = useApp()
    await app.start()
    await vi.waitFor(() => expect(app.sessionLost).toBe(true))
    expect(app.user?.id).toBe('u1')
    expect(app.pieces).toHaveLength(1)
    expect(loadSnapshot()).toEqual(snap)
  })

  it('явный «Выйти» стирает снимок', async () => {
    saveSnapshot(snap)
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Load failed' } })
    auth.signOut.mockResolvedValue({ error: null })
    const app = useApp()
    await app.start()
    await app.signOut()
    expect(app.user).toBeNull()
    expect(loadSnapshot()).toBeNull()
  })

  it('удачное обновление снимает прежнюю ошибку загрузки', async () => {
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation(() => query(null, { code: 'PGRST002', message: 'schema cache' }))
    const app = useApp()
    await app.start()
    expect(app.loadError).not.toBe('')
    from.mockImplementation((table: string) => query(tables[table]))
    await app.refresh()
    expect(app.loadError).toBe('')
  })

  it('вернулась сеть — данные обновляются сами', async () => {
    saveSnapshot(snap)
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation((table: string) => query(tables[table]))
    const app = useApp()
    await app.start()
    await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalled())
    const before = auth.getSession.mock.calls.length
    dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(auth.getSession.mock.calls.length).toBeGreaterThan(before))
  })

  it('без снимка ждёт сеть и сохраняет снимок', async () => {
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation((table: string) => query(tables[table]))
    const app = useApp()
    await app.start()
    expect(app.user?.id).toBe('u1')
    expect(app.offline).toBe(false)
    expect(loadSnapshot()).toEqual(snap)
  })

  it('без снимка и без сети: понятная ошибка с «Повторить», а не пустой офлайн', async () => {
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation(() => query(null, offlineError))
    const app = useApp()
    await app.start()
    expect(app.offline).toBe(false)
    expect(app.loadError).toMatch(/Нет связи/)
  })
})

describe('вход', () => {
  it('код принят, а загрузка упала: verifyCode не бросает, ошибка видна на главной', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation(() => query(null, offlineError))
    const app = useApp()
    await expect(app.verifyCode('a@b.c', '123456')).resolves.toBeUndefined()
    expect(app.loadError).toMatch(/Нет связи/)
    expect(app.user?.id).toBe('u1') // иначе охранник вернёт на форму кода без объяснений
  })
})

describe('загрузка нот', () => {
  it('замена PDF сбрасывает такты на страницах старого файла', async () => {
    const old = { id: 'f1', piece_id: 'x', kind: 'pdf', position_id: null, path: 'x/old.pdf', name: 'old.pdf', part_names: [], bars_per_page: [4, 4] }
    saveSnapshot({ ...snap, files: [old] as Snapshot['files'] })
    auth.getSession.mockResolvedValue(session)
    from.mockImplementation((table: string) => query(tables[table]))
    storage.from.mockReturnValue({
      upload: async () => ({ data: {}, error: null }),
      remove: async () => ({ data: [], error: null }),
    })
    const app = useApp()
    await app.start()
    await app.upload('x', [{ file: new File(['%PDF'], 'new.pdf'), kind: 'pdf', partNames: [], choice: 'score' }])
    expect(upserts[0]).toMatchObject({ piece_id: 'x', kind: 'pdf', position_id: null, bars_per_page: null })
  })
})
