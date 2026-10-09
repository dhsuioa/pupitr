<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { useAction } from '../lib/errors'
import { formatDuration, setlistTotal } from '../lib/setlist'
import { cachedCount, neededPaths } from '../lib/offline'
import PositionPicker from '../components/PositionPicker.vue'

const app = useApp()
const router = useRouter()
const { busy, error, run } = useAction()
const title = ref('')
const position = computed(() => app.positions.find((p) => p.id === app.me?.position_id))
const ready = ref<Record<string, boolean>>({})
watch(
  () => [app.setlists, app.files, app.me?.position_id] as const,
  async () => {
    const entries = await Promise.all(app.setlists.map(async (s) => {
      const paths = neededPaths(s.items, app.files, app.me?.position_id ?? null)
      return [s.id, paths.length > 0 && (await cachedCount(paths)) === paths.length] as const
    }))
    ready.value = Object.fromEntries(entries)
  },
  { immediate: true },
)
const signOut = () => app.signOut().then(() => router.replace('/login'))

const create = () => run(async () => {
  if (!title.value.trim()) return
  const id = await app.saveSetlist({ title: title.value.trim(), items: [] })
  router.push(`/setlist/${id}`)
})
</script>

<template>
  <main class="mx-auto max-w-lg space-y-4 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Пюпитр</h1>
      <nav v-if="app.me" class="flex gap-4">
        <RouterLink to="/library" class="link">Библиотека</RouterLink>
        <RouterLink to="/settings" class="link">Настройки</RouterLink>
      </nav>
    </header>
    <p v-if="app.loadError" class="text-red-400">
      {{ app.loadError }} <button class="link" @click="app.reload()">Повторить</button>
    </p>
    <template v-else-if="!app.me">
      <p>
        Вы вошли как {{ app.user?.email }}, но ещё не состоите в коллективе.
        Попросите у руководителя ссылку-приглашение.
      </p>
      <button class="link" @click="signOut">Выйти</button>
    </template>
    <PositionPicker v-else-if="!app.me.position_id && !app.isOwner" />
    <template v-else>
      <p class="text-sm text-neutral-400">Мой инструмент: {{ position?.name ?? 'партитура целиком' }}</p>
      <h2 class="font-medium">Сетлисты</h2>
      <p v-if="error" class="text-red-400">{{ error }}</p>
      <RouterLink
        v-for="s in app.setlists" :key="s.id" :to="`/setlist/${s.id}`"
        class="flex justify-between gap-2 rounded border border-neutral-700 px-3 py-2"
      >
        <span>{{ s.title }}<span v-if="ready[s.id]" class="text-green-400"> ✓</span></span>
        <span class="text-sm text-neutral-400">{{ formatDuration(setlistTotal(s.items, app.pieces)) }}</span>
      </RouterLink>
      <p v-if="!app.setlists.length" class="text-sm text-neutral-400">Сетлистов пока нет.</p>
      <form v-if="app.isOwner" class="flex gap-2" @submit.prevent="create">
        <input v-model="title" class="input mt-0" placeholder="Новый сетлист" />
        <button :disabled="busy" class="btn">Создать</button>
      </form>
    </template>
  </main>
</template>
