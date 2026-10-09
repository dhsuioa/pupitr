<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp, type Position } from '../stores/app'
import { useAction } from '../lib/errors'
import PositionPicker from '../components/PositionPicker.vue'

const app = useApp()
const router = useRouter()
const { busy, error, run } = useAction()
const name = ref(app.me?.display_name ?? '')
const newPosition = ref('')
const confirmRemove = ref<string | null>(null)
const copied = ref(false)
const inviteUrl = computed(() => `${location.origin}${import.meta.env.BASE_URL}#/join/${app.inviteToken}`)
const positionName = (id: string | null) => app.positions.find((p) => p.id === id)?.name ?? 'партитура'
const value = (e: Event) => (e.target as HTMLInputElement).value

const saveName = () => run(() => app.updateMe({ display_name: name.value.trim() || null }))
const addPosition = () => run(async () => {
  if (!newPosition.value.trim()) return
  await app.savePositions([{ name: newPosition.value.trim(), sort: app.positions.length }])
  newPosition.value = ''
})
const rename = (p: Position, text: string) => run(() => app.savePositions([{ ...p, name: text.trim() || p.name }]))
const saveAliases = (p: Position, text: string) =>
  run(() => app.savePositions([{ ...p, aliases: text.split(',').map((s) => s.trim()).filter(Boolean) }]))
const move = (i: number, d: -1 | 1) => run(() => {
  const list = [...app.positions]
  ;[list[i], list[i + d]] = [list[i + d], list[i]]
  return app.savePositions(list.map((p, k) => ({ ...p, sort: k })))
})
const copy = () => run(async () => {
  await navigator.clipboard.writeText(inviteUrl.value)
  copied.value = true
})
const signOut = () => app.signOut().then(() => router.replace('/login'))
</script>

<template>
  <main class="mx-auto max-w-lg space-y-8 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Настройки</h1>
      <RouterLink to="/" class="link">Назад</RouterLink>
    </header>
    <p v-if="error" class="text-red-400">{{ error }}</p>

    <PositionPicker />

    <section class="space-y-2">
      <h2 class="font-medium">Как вас зовут</h2>
      <form class="flex gap-2" @submit.prevent="saveName">
        <input v-model="name" class="input mt-0" placeholder="Имя для списка участников" />
        <button :disabled="busy" class="btn">Сохранить</button>
      </form>
    </section>

    <template v-if="app.isOwner">
      <section class="space-y-2">
        <h2 class="font-medium">Ссылка-приглашение</h2>
        <p class="break-all text-sm">{{ inviteUrl }}</p>
        <div class="flex gap-2">
          <button :disabled="busy" class="btn" @click="copy">{{ copied ? 'Скопировано' : 'Копировать' }}</button>
          <button :disabled="busy" class="btn" @click="run(app.resetInvite)">Сбросить</button>
        </div>
        <p class="text-sm text-neutral-400">После сброса старая ссылка перестаёт работать, а уже вступившие остаются.</p>
      </section>

      <section class="space-y-2">
        <h2 class="font-medium">Состав коллектива</h2>
        <p class="text-sm text-neutral-400">
          Позиция — это партия: «Труба 1» и «Труба 2» разные. Во второй строке через запятую —
          имена партий в файлах MuseScore, которые к ней относятся.
        </p>
        <div v-for="(p, i) in app.positions" :key="p.id" class="space-y-1 rounded border border-neutral-700 p-2">
          <div class="flex items-center gap-2">
            <input :value="p.name" class="input mt-0" @change="rename(p, value($event))" />
            <button class="link" :disabled="busy || i === 0" @click="move(i, -1)">↑</button>
            <button class="link" :disabled="busy || i === app.positions.length - 1" @click="move(i, 1)">↓</button>
            <button class="link" :disabled="busy" @click="run(() => app.deletePosition(p.id))">Удалить</button>
          </div>
          <input
            :value="p.aliases.join(', ')" class="input mt-0 text-sm" placeholder="Trumpet in B♭ 1, Tpt. 1"
            @change="saveAliases(p, value($event))"
          />
        </div>
        <form class="flex gap-2" @submit.prevent="addPosition">
          <input v-model="newPosition" class="input mt-0" placeholder="Новая позиция, например «Бас»" />
          <button :disabled="busy" class="btn">Добавить</button>
        </form>
      </section>

      <section class="space-y-2">
        <h2 class="font-medium">Участники</h2>
        <div v-for="m in app.members" :key="m.user_id" class="flex items-center justify-between gap-2">
          <span>
            {{ m.display_name || m.email }} · {{ positionName(m.position_id) }}
            <template v-if="m.role === 'owner'"> · руководитель</template>
          </span>
          <template v-if="m.role !== 'owner'">
            <button v-if="confirmRemove !== m.user_id" class="link" @click="confirmRemove = m.user_id">Удалить</button>
            <button v-else :disabled="busy" class="link text-red-400" @click="run(() => app.removeMember(m.user_id))">
              Точно удалить
            </button>
          </template>
        </div>
        <p class="text-sm text-neutral-400">Скачанные на устройство ноты у удалённого участника останутся.</p>
      </section>
    </template>

    <section class="space-y-2">
      <RouterLink to="/diag" class="link block">Проверка педали и экрана</RouterLink>
      <button class="link" @click="signOut">Выйти</button>
    </section>
  </main>
</template>
