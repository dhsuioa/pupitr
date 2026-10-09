<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '../stores/app'
import { errorMessage, useAction } from '../lib/errors'
import { parseXml, partNames, readMusicXml } from '../lib/musicxml'
import { conflicts, planUpload, type Analyzed } from '../lib/parts'

const props = defineProps<{ pieceId: string }>()
const app = useApp()
const { busy, error, run } = useAction()
type Row = Analyzed & { file: File; partNames: string[]; choice: string }
const rows = ref<Row[]>([])
const bad = computed(() => conflicts(rows.value))
const ready = computed(
  () => rows.value.some((r) => r.choice !== 'skip') && rows.value.every((r) => r.choice !== '') && bad.value.size === 0,
)

const kindOf = (name: string) =>
  /\.pdf$/i.test(name) ? 'pdf' : /\.(mxl|musicxml|xml)$/i.test(name) ? 'musicxml' : null

async function analyze(file: File): Promise<Analyzed> {
  const kind = kindOf(file.name)
  if (!kind) return { name: file.name, kind, xmlParts: null, error: 'Не PDF и не MusicXML' }
  if (kind === 'pdf') return { name: file.name, kind, xmlParts: null, error: '' }
  try {
    const doc = parseXml(await readMusicXml(await file.arrayBuffer(), file.name))
    return { name: file.name, kind, xmlParts: partNames(doc), error: '' }
  } catch (e) {
    return { name: file.name, kind, xmlParts: null, error: `Файл не читается: ${errorMessage(e)}` }
  }
}

const pick = (e: Event) => run(async () => {
  const input = e.target as HTMLInputElement
  const list = [...(input.files ?? [])]
  input.value = ''
  const analyzed = await Promise.all(list.map(analyze))
  const plan = planUpload(analyzed, app.positions)
  rows.value = analyzed.map((a, k) => ({ ...a, file: list[k], ...plan[k] }))
})

const send = () => run(async () => {
  await app.upload(
    props.pieceId,
    rows.value
      .filter((r) => r.choice !== 'skip')
      .map((r) => ({ file: r.file, kind: r.kind!, partNames: r.partNames, choice: r.choice })),
  )
  rows.value = []
})
</script>

<template>
  <section class="space-y-2">
    <h2 class="font-medium">Загрузить ноты</h2>
    <p class="text-sm text-neutral-400">
      Выберите сразу всё, что выгрузил MuseScore: партитуру и партии, PDF и MusicXML (.mxl).
      Файл той же партии в том же формате заменит старый.
    </p>
    <input type="file" multiple accept=".pdf,.mxl,.musicxml,.xml" class="block text-sm" :disabled="busy" @change="pick" />
    <div
      v-for="(r, k) in rows" :key="k" class="space-y-1 rounded border p-2"
      :class="r.error || bad.has(k) || r.choice === '' ? 'border-red-400' : 'border-neutral-700'"
    >
      <p class="break-all text-sm">
        {{ r.name }}<span v-if="r.partNames.length === 1" class="text-neutral-400"> · {{ r.partNames[0] }}</span>
      </p>
      <p v-if="r.error" class="text-sm text-red-400">{{ r.error }}</p>
      <select v-else v-model="r.choice" class="input mt-0">
        <option value="" disabled>— что это? —</option>
        <option value="score">Партитура целиком</option>
        <option v-for="p in app.positions" :key="p.id" :value="p.id">{{ p.name }}</option>
        <option value="skip">Не загружать</option>
      </select>
      <p v-if="bad.has(k)" class="text-sm text-red-400">Для этой партии выбран ещё один файл того же формата.</p>
    </div>
    <button v-if="rows.length" :disabled="busy || !ready" class="btn" @click="send">
      {{ busy ? 'Загружаем…' : 'Загрузить' }}
    </button>
    <p v-if="error" class="text-red-400">{{ error }}</p>
  </section>
</template>
