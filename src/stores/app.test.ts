// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { loadSnapshot, saveSnapshot, type Snapshot } from '../lib/offline'

const { auth, from } = vi.hoisted(() => ({ auth: { getSession: vi.fn(), verifyOtp: vi.fn() }, from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth, from } }))

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

// Ответ PostgREST: цепочка select().order() и await в любой точке.
function query(data: unknown, error: unknown = null) {
  const q = {
    select: () => q,
    order: () => q,
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data, error }).then(ok, bad),
  }
  return q
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

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

  it('сессия пропала не из-за сети: снимок стирается, пользователь выходит', async () => {
    saveSnapshot(snap)
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const app = useApp()
    await app.start()
    await vi.waitFor(() => expect(app.user).toBeNull())
    expect(app.pieces).toEqual([])
    expect(loadSnapshot()).toBeNull()
  })

  it('без снимка ждёт сеть и сохраняет снимок', async () => {
    auth.getSession.mockResolvedValue(session)
    const tables: Record<string, unknown> = {
      members: snap.members,
      positions: snap.positions,
      pieces: snap.pieces,
      files: [],
      setlists: [],
    }
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
  })
})
