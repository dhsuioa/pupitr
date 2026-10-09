<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import { errorMessage } from '../lib/errors'
import LoginForm from '../components/LoginForm.vue'
import PositionPicker from '../components/PositionPicker.vue'

const app = useApp()
const token = String(useRoute().params.token)
const step = ref<'login' | 'joining' | 'pick' | 'install'>('joining')
const error = ref('')
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = matchMedia('(display-mode: standalone)').matches

async function join() {
  step.value = 'joining'
  error.value = ''
  try {
    await app.join(token)
    step.value = app.me?.position_id || app.isOwner ? 'install' : 'pick'
  } catch (e) {
    error.value = errorMessage(e)
  }
}

onMounted(async () => {
  await app.start()
  if (app.user) join()
  else step.value = 'login'
})
</script>

<template>
  <main class="mx-auto max-w-sm space-y-4 p-6">
    <h1 class="text-2xl font-semibold">Приглашение в Пюпитр</h1>
    <p v-if="error" class="text-red-400">{{ error }}</p>
    <template v-else-if="step === 'login'">
      <p>Войдите по почте: пароль не нужен, придёт код.</p>
      <LoginForm @done="join" />
    </template>
    <p v-else-if="step === 'joining'">Подключаемся…</p>
    <PositionPicker v-else-if="step === 'pick'" @picked="step = 'install'" />
    <template v-else>
      <p>Готово, вы в коллективе.</p>
      <div v-if="!standalone" class="space-y-2 text-sm text-neutral-300">
        <p v-if="isIOS">
          Чтобы ноты были под рукой без сети, добавьте приложение на экран «Домой»:
          кнопка «Поделиться» → «На экран „Домой“». Потом откройте его с экрана «Домой»
          и войдите ещё раз по почте — у установленного приложения своя память.
        </p>
        <p v-else>
          Установите приложение: в меню браузера выберите «Установить приложение»
          или «Добавить на главный экран».
        </p>
      </div>
      <RouterLink to="/" class="btn inline-block">Открыть Пюпитр</RouterLink>
    </template>
  </main>
</template>
