<script setup lang="ts">
import { useApp, type SetlistItem } from '../stores/app'
import type { Prefs } from '../lib/stage'

defineProps<{ items: SetlistItem[]; current: number }>()
const emit = defineEmits<{ go: [k: number]; close: []; exit: [] }>()
const prefs = defineModel<Prefs>('prefs', { required: true })
const viewAs = defineModel<string | null>('viewAs', { required: true })
const app = useApp()
const title = (it: SetlistItem) =>
  'piece' in it ? (app.pieces.find((p) => p.id === it.piece)?.title ?? 'пьеса удалена') : it.label
const zoom = (d: number) => (prefs.value = { ...prefs.value, zoom: Math.min(2.5, Math.max(0.5, +(prefs.value.zoom + d).toFixed(2))) })
</script>

<template>
  <div class="absolute inset-0 z-20 overflow-y-auto bg-neutral-950/95 p-4 text-neutral-100" @click.stop>
    <div class="mx-auto max-w-lg space-y-5">
      <div class="flex items-center justify-between">
        <button class="btn" @click="emit('close')">Закрыть</button>
        <button class="link" @click="emit('exit')">Выйти со сцены</button>
      </div>
      <section class="space-y-1">
        <h2 class="font-medium">Сетлист</h2>
        <button
          v-for="(it, k) in items" :key="k" class="block w-full rounded px-3 py-2 text-left"
          :class="k === current ? 'bg-amber-400 text-black' : 'bg-neutral-800'" @click="emit('go', k)"
        >{{ k + 1 }}. {{ title(it) }}</button>
      </section>
      <section class="space-y-2">
        <h2 class="font-medium">Партия</h2>
        <select v-model="viewAs" class="input mt-0">
          <option :value="null">Партитура целиком</option>
          <option v-for="p in app.positions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </section>
      <section class="space-y-2">
        <h2 class="font-medium">Формат, если есть оба</h2>
        <div class="flex gap-2">
          <button class="btn" :class="{ 'ring-2 ring-amber-400': prefs.prefer === 'pdf' }" @click="prefs = { ...prefs, prefer: 'pdf' }">PDF</button>
          <button class="btn" :class="{ 'ring-2 ring-amber-400': prefs.prefer === 'musicxml' }" @click="prefs = { ...prefs, prefer: 'musicxml' }">MusicXML</button>
        </div>
      </section>
      <section class="space-y-2">
        <h2 class="font-medium">Масштаб MusicXML: {{ Math.round(prefs.zoom * 100) }}%</h2>
        <div class="flex gap-2">
          <button class="btn" @click="zoom(-0.1)">−</button>
          <button class="btn" @click="zoom(0.1)">+</button>
        </div>
      </section>
    </div>
  </div>
</template>
