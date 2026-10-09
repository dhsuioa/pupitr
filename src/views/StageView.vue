<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp, type SetlistItem } from '../stores/app'
import { errorMessage } from '../lib/errors'
import { extractPart, parseXml, readMusicXml } from '../lib/musicxml'
import { pickFile } from '../lib/parts'
import { LONG_PRESS_MS, keyAction, loadPrefs, savePrefs, step, tapAction, type Action, type Pos } from '../lib/stage'
import { useWakeLock } from '../lib/wakeLock'
import PdfScreen from '../components/PdfScreen.vue'
import XmlScreen from '../components/XmlScreen.vue'
import StageMenu from '../components/StageMenu.vue'

const app = useApp()
const route = useRoute()
const router = useRouter()
const single = route.name === 'stage-piece'
const id = String(route.params.id)
const items = computed<SetlistItem[]>(() =>
  single ? [{ piece: id }] : (app.setlists.find((s) => s.id === id)?.items ?? []),
)
const pos = ref<Pos>({ item: Number(route.query.i ?? 0) || 0, screen: 0 })
const count = ref(1) // экранов у текущего пункта
const prefs = ref(loadPrefs(innerWidth))
watch(prefs, savePrefs)
const viewAs = ref<string | null>(app.me?.position_id ?? null) // чью партию показываем; null — партитура
const menu = ref(false)
const wake = useWakeLock()
const area = ref<HTMLDivElement>()

const item = computed(() => items.value[pos.value.item])
const piece = computed(() => {
  const it = item.value
  return it && 'piece' in it ? app.pieces.find((p) => p.id === it.piece) : undefined
})
const choice = computed(() => {
  if (!piece.value) return null
  const position = app.positions.find((p) => p.id === viewAs.value) ?? null
  return pickFile(app.files.filter((f) => f.piece_id === piece.value!.id), position, prefs.value.prefer)
})

type Content = { kind: 'pdf'; blob: Blob } | { kind: 'xml'; xml: string } | { kind: 'text'; text: string }
const content = shallowRef<Content | null>(null)
// Ключ загрузки — путь файла, а не объект пункта: фоновое обновление снимка не перезагружает ноты.
const contentKey = computed(() => {
  const it = item.value
  if (!it) return 'none'
  if (!('piece' in it)) return `label:${pos.value.item}`
  return `${pos.value.item}|${piece.value?.id ?? 'gone'}|${choice.value?.file.path ?? 'none'}|${choice.value?.extract ?? ''}`
})
let seq = 0
watch(contentKey, async () => {
  const ticket = ++seq
  content.value = null
  count.value = 1
  const it = item.value
  if (!it) return
  if (!('piece' in it)) {
    content.value = { kind: 'text', text: it.sec ? `${it.label} · ${Math.round(it.sec / 60)} мин` : it.label }
    return fixScreen()
  }
  const c = choice.value
  if (!piece.value || !c) {
    content.value = { kind: 'text', text: piece.value ? `${piece.value.title}: нот пока нет` : 'Пьеса удалена из библиотеки' }
    return fixScreen()
  }
  try {
    const blob = await app.fileBlob(c.file.path)
    if (ticket !== seq) return
    if (c.file.kind === 'pdf') content.value = { kind: 'pdf', blob }
    else {
      const xml = await readMusicXml(await blob.arrayBuffer(), c.file.name)
      if (ticket !== seq) return
      content.value = { kind: 'xml', xml: c.extract ? extractPart(parseXml(xml), c.extract) : xml }
    }
  } catch (e) {
    if (ticket !== seq) return
    content.value = { kind: 'text', text: `${piece.value.title}: ноты не открылись. ${errorMessage(e)}` }
    fixScreen()
  }
}, { immediate: true })

// «Последний экран» (-1) и выход за край становятся настоящим номером, когда известно число экранов.
function fixScreen() {
  const s = pos.value.screen
  if (s < 0 || s >= count.value) pos.value = { ...pos.value, screen: count.value - 1 }
}
function onCount(n: number) {
  count.value = Math.max(1, n)
  fixScreen()
}

function act(a: Action) {
  if (!wake.ok.value) wake.take()
  if (a === 'next' || a === 'prev') pos.value = step(pos.value, a === 'next' ? 1 : -1, count.value, items.value.length)
  // 'toggle' — автолистание, план 4
}

function onTap(e: MouseEvent) {
  const r = area.value!.getBoundingClientRect()
  act(tapAction(e.clientX - r.left, r.width))
}

const pressedAt = new Map<string, number>()
function onKeyDown(e: KeyboardEvent) {
  if (menu.value || !keyAction(e.key)) return
  e.preventDefault()
  if (!e.repeat) pressedAt.set(e.key, performance.now())
}
function onKeyUp(e: KeyboardEvent) {
  const a = keyAction(e.key)
  const t = pressedAt.get(e.key)
  pressedAt.delete(e.key)
  if (menu.value || !a || t === undefined) return
  act(performance.now() - t >= LONG_PRESS_MS ? 'toggle' : a)
}

const go = (k: number) => {
  pos.value = { item: k, screen: 0 }
  menu.value = false
}
const exit = () => router.push(single ? `/piece/${id}` : `/setlist/${id}`)

onMounted(() => {
  addEventListener('keydown', onKeyDown)
  addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  removeEventListener('keydown', onKeyDown)
  removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <main class="fixed inset-0 flex flex-col bg-neutral-950">
    <div v-if="!wake.ok.value" class="bg-amber-300 px-3 py-1 text-center text-sm text-black">
      Экран может погаснуть — выключите автоблокировку в настройках телефона
    </div>
    <div ref="area" class="relative flex-1 overflow-hidden" @click="onTap">
      <PdfScreen v-if="content?.kind === 'pdf'" :key="contentKey" :blob="content.blob" :screen="pos.screen" @count="onCount" />
      <XmlScreen
        v-else-if="content?.kind === 'xml'" :key="contentKey" :xml="content.xml" :screen="pos.screen"
        :zoom="prefs.zoom" @layout="(screens) => onCount(screens.length)"
      />
      <div v-else class="flex h-full items-center justify-center p-6 text-center text-2xl text-neutral-200">
        {{ content?.kind === 'text' ? content.text : 'Загружаем…' }}
      </div>
    </div>
    <button class="absolute left-2 top-2 z-10 rounded bg-neutral-800/80 px-3 py-1 text-neutral-200" @click.stop="menu = true">≡</button>
    <div class="pointer-events-none absolute right-2 top-2 z-10 rounded bg-neutral-800/80 px-2 text-sm text-neutral-300">
      {{ pos.item + 1 }}/{{ items.length }}
    </div>
    <StageMenu
      v-if="menu" v-model:prefs="prefs" v-model:view-as="viewAs" :items="items" :current="pos.item"
      @go="go" @close="menu = false" @exit="exit"
    />
  </main>
</template>
