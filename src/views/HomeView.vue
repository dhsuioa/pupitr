<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import PositionPicker from '../components/PositionPicker.vue'

const app = useApp()
const router = useRouter()
const position = computed(() => app.positions.find((p) => p.id === app.me?.position_id))
const signOut = () => app.signOut().then(() => router.replace('/login'))
</script>

<template>
  <main class="mx-auto max-w-lg space-y-4 p-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Пюпитр</h1>
      <nav v-if="app.me" class="flex gap-4">
        <RouterLink to="/library" class="link">Библиотека</RouterLink>
        <RouterLink to="/settings" class="link">Настройки</RouterLink>
      </nav>
    </header>
    <p v-if="app.loadError" class="text-red-400">
      {{ app.loadError }} <button class="link" @click="app.reload()">Повторить</button>
    </p>
    <template v-else-if="!app.me">
      <p>
        Вы вошли как {{ app.user?.email }}, но ещё не состоите в коллективе.
        Попросите у руководителя ссылку-приглашение.
      </p>
      <button class="link" @click="signOut">Выйти</button>
    </template>
    <PositionPicker v-else-if="!app.me.position_id && !app.isOwner" />
    <p v-else>
      Мой инструмент: {{ position?.name ?? 'партитура целиком' }}.
      Библиотека и сетлисты появятся на следующем этапе.
    </p>
  </main>
</template>
