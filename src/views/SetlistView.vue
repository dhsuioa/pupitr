<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sortable from 'sortablejs'
import { useApp, type SetlistItem } from '../stores/app'
import { useAction } from '../lib/errors'
import { formatDuration, itemSeconds, parseDuration, setlistTotal } from '../lib/setlist'

const app = useApp()
const router = useRouter()
const { busy, error, run } = useAction()
const id = String(useRoute().params.id)
const setlist = computed(() => app.setlists.find((s) => s.id === id))
const items = computed(() => setlist.value?.items ?? [])
const total = computed(() => setlistTotal(items.value, app.pieces))
const pieceTitle = (pid: string) => app.pieces.find((p) => p.id === pid)?.title ?? 'пьеса удалена'
const value = (e: Event) => (e.target as HTMLInputElement).value
const addPiece = ref('')
const label = ref('')
const labelTime = ref('')
const confirmDelete = ref(false)
const list = ref<HTMLElement>()

const save = (next: SetlistItem[], title = setlist.value!.title) => run(() => app.saveSetlist({ id, title, items: next }))
const add = () => {
  if (!addPiece.value) return
  save([...items.value, { piece: addPiece.value }])
  addPiece.value = ''
}
const addLabel = () => run(async () => {
  if (!label.value.trim()) return
  const sec = labelTime.value.trim() ? parseDuration(labelTime.value) : 0
  if (sec === null) throw new Error('Длительность — в минутах или как 3:45')
  await app.saveSetlist({ id, title: setlist.value!.title, items: [...items.value, { label: label.value.trim(), sec }] })
  label.value = ''
  labelTime.value = ''
})
const removeAt = (k: number) => save(items.value.filter((_, i) => i !== k))
const rename = (t: string) => save(items.value, t.trim() || setlist.value!.title)
const remove = () => run(async () => {
  await app.deleteSetlist(id)
  router.replace('/')
})

onMounted(() => {
  if (!app.isOwner || !list.value) return
  let next: Node | null = null
  Sortable.create(list.value, {
    handle: '.handle',
    animation: 150,
    onStart: ({ item }) => (next = item.nextSibling),
    onEnd: ({ oldIndex, newIndex, item, from }) => {
      // Sortable уже переставил DOM; возвращаем как было, порядок задаст Vue из данных.
      from.insertBefore(item, next)
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
      const reordered = [...items.value]
      reordered.splice(newIndex, 0, ...reordered.splice(oldIndex, 1))
      save(reordered)
    },
  })
})
</script>

<template>
  <main class="mx-auto max-w-lg space-y-6 p-6">
    <header class="flex items-center justify-between gap-2">
      <input
        v-if="app.isOwner && setlist" :value="setlist.title" class="input mt-0 text-xl font-semibold"
        @change="rename(value($event))"
      />
      <h1 v-else class="text-2xl font-semibold">{{ setlist?.title ?? 'Сетлист не найден' }}</h1>
      <RouterLink to="/" class="link shrink-0">Назад</RouterLink>
    </header>
    <p v-if="error" class="text-red-400">{{ error }}</p>
    <template v-if="setlist">
      <p class="text-neutral-400">Пунктов: {{ items.length }} · общая длина {{ formatDuration(total) }}</p>
      <ol ref="list" class="space-y-1">
        <li v-for="(it, k) in items" :key="k" class="flex items-center gap-2 rounded border border-neutral-700 px-2 py-2">
          <span v-if="app.isOwner" class="handle cursor-grab touch-none select-none px-1 text-neutral-500">⠿</span>
          <span class="w-6 text-right text-neutral-500">{{ k + 1 }}</span>
          <RouterLink v-if="'piece' in it" :to="`/piece/${it.piece}`" class="flex-1">{{ pieceTitle(it.piece) }}</RouterLink>
          <span v-else class="flex-1 italic">{{ it.label }}</span>
          <span class="text-sm text-neutral-400">{{ formatDuration(itemSeconds(it, app.pieces)) }}</span>
          <button v-if="app.isOwner" :disabled="busy" class="link" @click="removeAt(k)">✕</button>
        </li>
      </ol>
      <template v-if="app.isOwner">
        <form class="flex gap-2" @submit.prevent="add">
          <select v-model="addPiece" class="input mt-0">
            <option value="" disabled>Пьеса из библиотеки</option>
            <option v-for="p in app.pieces" :key="p.id" :value="p.id">{{ p.title }}</option>
          </select>
          <button :disabled="busy || !addPiece" class="btn">Добавить</button>
        </form>
        <form class="flex gap-2" @submit.prevent="addLabel">
          <input v-model="label" class="input mt-0" placeholder="Пункт без нот: Антракт" />
          <input v-model="labelTime" class="input mt-0 w-24" placeholder="мин" />
          <button :disabled="busy" class="btn">Добавить</button>
        </form>
        <button v-if="!confirmDelete" class="link" @click="confirmDelete = true">Удалить сетлист</button>
        <button v-else :disabled="busy" class="link text-red-400" @click="remove">Точно удалить сетлист</button>
      </template>
    </template>
  </main>
</template>
