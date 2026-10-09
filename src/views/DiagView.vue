<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const ua = navigator.userAgent
const standalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const log = ref<string[]>([])
const wake = ref('wakeLock' in navigator ? 'не запрошен' : 'нет API (iOS до 18.4?)')
const persisted = ref<boolean | null>(null)
const pressedAt = new Map<string, number>()
let lock: WakeLockSentinel | null = null

const add = (line: string) => (log.value = [line, ...log.value].slice(0, 30))

function onDown(e: KeyboardEvent) {
  e.preventDefault()
  if (e.repeat) add(`${e.key} — автоповтор`)
  else pressedAt.set(e.key, performance.now())
}

function onUp(e: KeyboardEvent) {
  const t = pressedAt.get(e.key)
  add(`${e.key} (${e.code}) — ${t === undefined ? '?' : Math.round(performance.now() - t)} мс`)
  pressedAt.delete(e.key)
}

async function requestWake() {
  if (!('wakeLock' in navigator)) return
  try {
    lock = await navigator.wakeLock.request('screen')
    wake.value = 'держим'
    lock.addEventListener('release', () => (wake.value = 'отпущен'))
  } catch (e) {
    wake.value = `ошибка: ${(e as Error).message}`
  }
}

function onVisible() {
  if (document.visibilityState === 'visible' && wake.value === 'отпущен') requestWake()
}

async function askPersist() {
  persisted.value = (await navigator.storage?.persist?.()) ?? null
}

onMounted(async () => {
  addEventListener('keydown', onDown)
  addEventListener('keyup', onUp)
  document.addEventListener('visibilitychange', onVisible)
  persisted.value = (await navigator.storage?.persisted?.()) ?? null
})

onUnmounted(() => {
  removeEventListener('keydown', onDown)
  removeEventListener('keyup', onUp)
  document.removeEventListener('visibilitychange', onVisible)
  lock?.release()
})
</script>

<template>
  <main class="mx-auto max-w-lg space-y-4 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Проверка устройства</h1>
      <RouterLink to="/" class="link">Назад</RouterLink>
    </header>
    <p>Режим: {{ standalone ? 'установленное приложение' : 'вкладка браузера' }}</p>
    <p class="break-all text-xs text-neutral-400">{{ ua }}</p>
    <p>Экран: {{ wake }} <button class="btn ml-2" @click="requestWake">Не гасить</button></p>
    <p>
      Хранилище: {{ persisted === null ? 'нет API' : persisted ? 'постоянное' : 'может быть очищено' }}
      <button class="btn ml-2" @click="askPersist">Запросить</button>
    </p>
    <h2 class="font-medium">Нажмите педаль или клавишу, подержите её</h2>
    <ol class="font-mono text-sm">
      <li v-for="(line, i) in log" :key="i">{{ line }}</li>
    </ol>
  </main>
</template>
