<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp, type FileRow } from '../stores/app'
import { useAction } from '../lib/errors'
import { formatDuration, parseDuration } from '../lib/setlist'
import UploadTable from '../components/UploadTable.vue'

const app = useApp()
const router = useRouter()
const { busy, error, run } = useAction()
const id = String(useRoute().params.id)
const piece = computed(() => app.pieces.find((p) => p.id === id))
const files = computed(() => app.files.filter((f) => f.piece_id === id))
const form = ref({
  title: piece.value?.title ?? '',
  duration: piece.value?.duration_sec ? formatDuration(piece.value.duration_sec) : '',
  bpm: piece.value?.bpm ? String(piece.value.bpm) : '',
  beats: piece.value?.beats_per_bar ? String(piece.value.beats_per_bar) : '',
})
const confirmDelete = ref(false)

const partOf = (f: FileRow) =>
  f.position_id === null ? 'Партитура' : app.positions.find((p) => p.id === f.position_id)?.name ?? '—'
const mine = (f: FileRow) => f.position_id !== null && f.position_id === app.me?.position_id
const hasTwin = (f: FileRow) => files.value.some((g) => g.kind === 'musicxml' && g.position_id === f.position_id)
const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null)

const save = () => run(async () => {
  const t = form.value.duration.trim()
  const duration = t ? parseDuration(t) : null
  if (t && duration === null) throw new Error('Длительность — в виде 3:45')
  const bpm = num(form.value.bpm)
  const beats = num(form.value.beats)
  if ((bpm !== null && !(bpm > 0)) || (beats !== null && !(Number.isInteger(beats) && beats > 0)))
    throw new Error('Темп и доли — положительные числа, доли целые')
  await app.savePiece({ id, title: form.value.title.trim() || piece.value!.title, duration_sec: duration, bpm, beats_per_bar: beats })
})

const saveBars = (f: FileRow, text: string) => run(async () => {
  const bars = text.split(/[\s,;]+/).filter(Boolean).map(Number)
  if (bars.some((b) => !Number.isInteger(b) || b <= 0)) throw new Error('Такты на страницах — целые числа через пробел')
  await app.updateFile(f.id, { bars_per_page: bars.length ? bars : null })
})

const remove = () => run(async () => {
  await app.deletePiece(id)
  router.replace('/library')
})
</script>

<template>
  <main class="mx-auto max-w-lg space-y-6 p-6">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">{{ piece?.title ?? 'Пьеса не найдена' }}</h1>
      <RouterLink to="/library" class="link shrink-0">Библиотека</RouterLink>
    </header>
    <RouterLink v-if="piece && files.length" :to="`/stage/piece/${id}`" class="btn inline-block">▶ Открыть ноты</RouterLink>
    <p v-if="error" class="text-red-400">{{ error }}</p>
    <template v-if="piece">
      <form v-if="app.isOwner" class="space-y-2" @submit.prevent="save">
        <label class="block">Название <input v-model="form.title" class="input" /></label>
        <label class="block">Длительность <input v-model="form.duration" class="input" placeholder="3:45" /></label>
        <div class="flex gap-2">
          <label class="block flex-1">Темп, BPM <input v-model="form.bpm" inputmode="decimal" class="input" /></label>
          <label class="block flex-1">Долей в такте <input v-model="form.beats" inputmode="numeric" class="input" /></label>
        </div>
        <p class="text-sm text-neutral-400">
          Темп и доли нужны для автолистания PDF, у которого нет пары в MusicXML. 6/8 «на два» — темп 60, долей 2.
        </p>
        <button :disabled="busy" class="btn">Сохранить</button>
      </form>
      <p v-else-if="piece.duration_sec" class="text-neutral-400">{{ formatDuration(piece.duration_sec) }}</p>

      <section class="space-y-2">
        <h2 class="font-medium">Файлы</h2>
        <div
          v-for="f in files" :key="f.id" class="space-y-1 rounded border p-2"
          :class="mine(f) ? 'border-amber-400' : 'border-neutral-700'"
        >
          <div class="flex items-center justify-between gap-2">
            <span>{{ partOf(f) }} · {{ f.kind === 'pdf' ? 'PDF' : 'MusicXML' }}<span v-if="mine(f)"> · моя партия</span></span>
            <button v-if="app.isOwner" :disabled="busy" class="link" @click="run(() => app.deleteFile(f))">Удалить</button>
          </div>
          <p class="break-all text-xs text-neutral-400">{{ f.name }}</p>
          <input
            v-if="app.isOwner && f.kind === 'pdf' && !hasTwin(f)" :value="f.bars_per_page?.join(' ') ?? ''"
            class="input mt-0 text-sm" placeholder="Тактов на страницах, например: 12 14 13"
            @change="saveBars(f, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p v-if="!files.length" class="text-sm text-neutral-400">Файлов пока нет.</p>
      </section>

      <UploadTable v-if="app.isOwner" :piece-id="id" />

      <section v-if="app.isOwner">
        <button v-if="!confirmDelete" class="link" @click="confirmDelete = true">Удалить пьесу</button>
        <button v-else :disabled="busy" class="link text-red-400" @click="remove">Точно удалить пьесу и все её файлы</button>
      </section>
    </template>
  </main>
</template>
