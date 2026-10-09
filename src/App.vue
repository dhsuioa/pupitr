<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <RouterView />
  <div
    v-if="needRefresh"
    class="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-amber-300 p-3 text-black"
  >
    <span>Есть обновление приложения</span>
    <button class="rounded bg-black px-3 py-1 text-white" @click="updateServiceWorker()">Обновить</button>
  </div>
</template>
