<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp, type SetlistItem } from '../stores/app'
import { errorMessage } from '../lib/errors'
import { extractPart, parseXml, readMusicXml } from '../lib/musicxml'
import { pickFile } from '../lib/parts'
import {
  LONG_PRESS_MS, eventIndexAt, firstEventTime, keyAction, linearPlayed, loadPrefs, makePlan, savePrefs, screenOf, step, tapAction,
  type Action, type Plan, type Pos,
} from '../lib/stage'
import { borrowTempos, pageOfMeasure, played, quarterTempo, readMeasures, type Measure, type Played } from '../lib/timeline'
import type { FileRow } from '../stores/app'
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

type Content = { kind: 'pdf'; blob: Blob } | { kind: 'xml'; xml: string; full: string } | { kind: 'text'; text: string }
const content = shallowRef<Content | null>(null)
// Ключ загрузки — путь файла, а не объект пункта: фоновое обновление снимка не перезагружает ноты.
const contentKey = computed(() => {
  const it = item.value
  if (!it) return 'none'
  if (!('piece' in it)) return `label:${pos.value.item}`
  return `${pos.value.item}|${piece.value?.id ?? 'gone'}|${choice.value?.file.path ?? 'none'}|${choice.value?.extract ?? ''}`
})
// Автолистание: план текущего пункта и часы. Объявлены до watch ниже — он срабатывает сразу при setup.
const plan = shallowRef<Plan | null>(null)
const planNote = ref('') // почему автолистания нет или о чём предупредить
const toast = ref('')
let toastTimer = 0
const running = ref(false)
let t0 = 0 // момент performance.now(), соответствующий началу пьесы
let raf = 0
let pausedAt: { t: number; screen: number } | null = null

let seq = 0
watch(contentKey, async () => {
  const ticket = ++seq
  stop()
  pausedAt = null
  plan.value = null
  planNote.value = ''
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
      content.value = { kind: 'xml', xml: c.extract ? extractPart(parseXml(xml), c.extract) : xml, full: xml }
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

function flash(text: string) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2500)
}

async function measuresOf(file: FileRow): Promise<Measure[]> {
  const xml = await readMusicXml(await (await app.fileBlob(file.path)).arrayBuffer(), file.name)
  return readMeasures(parseXml(xml))
}

// Темп: из самого файла → из партитуры MusicXML этой пьесы → из BPM и долей пьесы.
async function withTempo(ms: Measure[]): Promise<Played[] | null> {
  const p = piece.value!
  let src = ms
  if (!ms.some((m) => m.tempo)) {
    const score = app.files.find((f) => f.piece_id === p.id && f.kind === 'musicxml' && f.position_id === null)
    if (score) src = borrowTempos(ms, await measuresOf(score).catch(() => []))
  }
  const fallback = p.bpm && p.beats_per_bar ? quarterTempo(src, p.bpm, p.beats_per_bar) : null
  return played(src, fallback)
}

async function xmlPlan(screens: number[], systemOfMeasure: number[]) {
  const ticket = seq
  const c = content.value
  if (c?.kind !== 'xml') return
  const p = await withTempo(readMeasures(parseXml(c.full)))
  if (ticket !== seq) return
  planNote.value = p ? '' : 'Нет темпа: задайте BPM и доли в карточке пьесы'
  const sys = (m: number) => systemOfMeasure[Math.min(m, systemOfMeasure.length - 1)] ?? 0
  plan.value = p ? makePlan(p.map((x) => ({ ...x, screen: screenOf(screens, sys(x.measure)) })), 0) : null
}

async function pdfPlan(pages: number) {
  const ticket = seq
  const c = choice.value
  const p = piece.value
  if (!c || !p) return
  const f = c.file
  if (f.bars_per_page?.length) {
    if (!p.bpm || !p.beats_per_bar) {
      planNote.value = 'Для PDF задайте темп и доли в карточке пьесы'
      return
    }
    planNote.value = f.bars_per_page.length === pages ? '' : `Такты указаны для ${f.bars_per_page.length} страниц из ${pages}`
    plan.value = makePlan(linearPlayed(f.bars_per_page, (p.beats_per_bar * 60) / p.bpm), prefs.value.lead)
    return
  }
  const twin = app.files.find((g) => g.piece_id === p.id && g.kind === 'musicxml' && g.position_id === f.position_id)
  if (!twin) {
    planNote.value = 'Для PDF укажите такты на страницах в карточке пьесы'
    return
  }
  try {
    const ms = await measuresOf(twin)
    const pl = await withTempo(ms)
    if (ticket !== seq) return
    if (!pl) {
      planNote.value = 'Нет темпа: задайте BPM и доли в карточке пьесы'
      return
    }
    const page = pageOfMeasure(ms)
    plan.value = makePlan(pl.map((x) => ({ ...x, screen: Math.min(page[x.measure] ?? 0, pages - 1) })), prefs.value.lead)
  } catch (e) {
    if (ticket === seq) planNote.value = `Автолистание недоступно: ${errorMessage(e)}`
  }
}

function onPdfCount(n: number) {
  onCount(n)
  pdfPlan(n)
}
function onLayout(screens: number[], systemOfMeasure: number[]) {
  onCount(screens.length)
  xmlPlan(screens, systemOfMeasure)
}
watch(() => prefs.value.lead, () => {
  if (content.value?.kind === 'pdf') pdfPlan(count.value)
})

const now = () => (performance.now() - t0) / 1000

function tick() {
  const p = plan.value
  if (!running.value || !p) return
  const t = now()
  if (t >= p.total) return stop()
  const s = p.events[eventIndexAt(p.events, t)].screen
  if (pos.value.screen !== s) pos.value = { ...pos.value, screen: s }
  raf = requestAnimationFrame(tick)
}
function seek(t: number) {
  t0 = performance.now() - Math.max(0, t) * 1000
}
function start(t: number) {
  seek(t)
  running.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}
function stop() {
  running.value = false
  cancelAnimationFrame(raf)
}

function toggle() {
  if (running.value) {
    pausedAt = { t: now(), screen: pos.value.screen }
    return stop()
  }
  if (!plan.value) return flash(planNote.value || (piece.value ? 'Автолистание ещё готовится' : 'Здесь нет нот'))
  const from = pausedAt && pausedAt.screen === pos.value.screen ? pausedAt.t : firstEventTime(plan.value.events, pos.value.screen)
  pausedAt = null
  start(from)
}

function act(a: Action) {
  if (!wake.ok.value) wake.take()
  if (a === 'toggle') return toggle()
  if (!a) return
  // Во время хода поправка — переход к соседнему событию расписания: позиция и часы всегда согласованы.
  if (running.value && plan.value) {
    const ev = plan.value.events
    const k = eventIndexAt(ev, now())
    const target = a === 'next' ? k + 1 : Math.max(0, k - 1)
    if (target < ev.length) {
      seek(ev[target].t)
      pos.value = { ...pos.value, screen: ev[target].screen }
      return
    }
    stop() // после последнего события «вперёд» — дальше по сетлисту
  }
  pos.value = step(pos.value, a === 'next' ? 1 : -1, count.value, items.value.length)
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
  stop()
  clearTimeout(toastTimer)
})
</script>

<template>
  <main class="fixed inset-0 flex flex-col bg-neutral-950">
    <div v-if="!wake.ok.value" class="bg-amber-300 px-3 py-1 text-center text-sm text-black">
      Экран может погаснуть — выключите автоблокировку в настройках телефона
    </div>
    <div ref="area" class="relative flex-1 overflow-hidden" @click="onTap">
      <PdfScreen v-if="content?.kind === 'pdf'" :key="contentKey" :blob="content.blob" :screen="pos.screen" @count="onPdfCount" />
      <XmlScreen
        v-else-if="content?.kind === 'xml'" :key="contentKey" :xml="content.xml" :screen="pos.screen"
        :zoom="prefs.zoom" @layout="onLayout"
      />
      <div v-else class="flex h-full items-center justify-center p-6 text-center text-2xl text-neutral-200">
        {{ content?.kind === 'text' ? content.text : 'Загружаем…' }}
      </div>
    </div>
    <button class="absolute left-2 top-2 z-10 rounded bg-neutral-800/80 px-3 py-1 text-neutral-200" @click.stop="menu = true">≡</button>
    <div class="pointer-events-none absolute right-2 top-2 z-10 rounded bg-neutral-800/80 px-2 text-sm text-neutral-300">
      <span v-if="running" class="text-green-400">▶ </span>{{ pos.item + 1 }}/{{ items.length }}
    </div>
    <div
      v-if="toast"
      class="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-fit max-w-[90%] rounded bg-neutral-800 px-4 py-2 text-center text-neutral-100"
    >
      {{ toast }}
    </div>
    <StageMenu
      v-if="menu" v-model:prefs="prefs" v-model:view-as="viewAs" :items="items" :current="pos.item"
      @go="go" @close="menu = false" @exit="exit"
    />
  </main>
</template>
