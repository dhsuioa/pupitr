<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useApp } from './stores/app'

const { needRefresh, updateServiceWorker } = useRegisterSW()
const app = useApp()
const route = useRoute()
const router = useRouter()

// Сессия пропала (вышли на другом устройстве, токен отозван) — на вход.
watch(() => app.user, (u) => {
  if (!u && !route.meta.public) router.replace('/login')
})
</script>

<template>
  <div v-if="app.offline" class="bg-neutral-800 px-4 py-1 text-center text-sm text-neutral-300">
    Нет связи — показаны сохранённые данные
  </div>
  <RouterView />
  <div
    v-if="needRefresh"
    class="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-amber-300 p-3 text-black"
  >
    <span>Есть обновление приложения</span>
    <button class="rounded bg-black px-3 py-1 text-white" @click="updateServiceWorker()">Обновить</button>
  </div>
</template>
