<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { useAction } from '../lib/errors'
import { formatDuration } from '../lib/setlist'

const app = useApp()
const router = useRouter()
const { busy, error, run } = useAction()
const title = ref('')

const create = () => run(async () => {
  if (!title.value.trim()) return
  const id = await app.savePiece({ title: title.value.trim() })
  router.push(`/piece/${id}`)
})
</script>

<template>
  <main class="mx-auto max-w-lg space-y-4 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Библиотека</h1>
      <RouterLink to="/" class="link">Назад</RouterLink>
    </header>
    <p v-if="error" class="text-red-400">{{ error }}</p>
    <form v-if="app.isOwner" class="flex gap-2" @submit.prevent="create">
      <input v-model="title" class="input mt-0" placeholder="Название новой пьесы" />
      <button :disabled="busy" class="btn">Добавить</button>
    </form>
    <RouterLink
      v-for="p in app.pieces" :key="p.id" :to="`/piece/${p.id}`"
      class="flex justify-between rounded border border-neutral-700 px-3 py-2"
    >
      <span>{{ p.title }}</span>
      <span class="text-neutral-400">{{ p.duration_sec ? formatDuration(p.duration_sec) : '' }}</span>
    </RouterLink>
    <p v-if="!app.pieces.length" class="text-sm text-neutral-400">Пьес пока нет.</p>
  </main>
</template>
