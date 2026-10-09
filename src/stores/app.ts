import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

export type Position = { id: string; name: string; aliases: string[]; sort: number }
export type Member = {
  user_id: string
  role: 'owner' | 'musician'
  email: string | null
  display_name: string | null
  position_id: string | null
}

// Supabase отдаёт { data, error }; ошибку превращаем в исключение, чтобы ловить в одном месте.
function must<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error
  return r.data as NonNullable<T>
}

const clean = (email: string) => email.trim().toLowerCase()

export const useApp = defineStore('app', () => {
  const user = ref<User | null>(null)
  const members = ref<Member[]>([])
  const positions = ref<Position[]>([])
  const inviteToken = ref<string | null>(null)
  const loadError = ref('')
  const me = computed(() => members.value.find((m) => m.user_id === user.value?.id) ?? null)
  const isOwner = computed(() => me.value?.role === 'owner')

  async function refresh() {
    members.value = must(await supabase.from('members').select('*'))
    positions.value = must(await supabase.from('positions').select('*').order('sort'))
    inviteToken.value = isOwner.value
      ? must(await supabase.from('band').select('invite_token').single()).invite_token
      : null
  }

  async function reload() {
    loadError.value = ''
    try {
      await refresh()
    } catch (e) {
      loadError.value = errorMessage(e)
    }
  }

  let started: Promise<void> | null = null
  function start() {
    started ??= (async () => {
      user.value = (await supabase.auth.getSession()).data.session?.user ?? null
      if (user.value) await reload()
    })()
    return started
  }

  async function sendCode(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email: clean(email) })
    if (error) throw error
  }

  async function verifyCode(email: string, code: string) {
    const { data, error } = await supabase.auth.verifyOtp({ email: clean(email), token: code.trim(), type: 'email' })
    if (error) throw error
    user.value = data.user
    await refresh()
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
    await supabase.auth.signOut()
    user.value = null
    members.value = []
    positions.value = []
    inviteToken.value = null
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

  return {
    user, members, positions, inviteToken, loadError, me, isOwner,
    start, refresh, reload, sendCode, verifyCode, join, updateMe, signOut,
    savePositions, deletePosition, resetInvite, removeMember,
  }
})
