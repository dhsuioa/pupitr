<script setup lang="ts">
import { ref } from 'vue'
import { useApp } from '../stores/app'
import { useAction } from '../lib/errors'

const emit = defineEmits<{ done: [] }>()
const app = useApp()
const { busy, error, run } = useAction()
const email = ref('')
const code = ref('')
const step = ref<'email' | 'code'>('email')

const send = () => run(async () => {
  await app.sendCode(email.value)
  step.value = 'code'
})
const verify = () => run(async () => {
  await app.verifyCode(email.value, code.value)
  emit('done')
})
</script>

<template>
  <form v-if="step === 'email'" class="space-y-3" @submit.prevent="send">
    <label class="block">Почта
      <input v-model="email" type="email" required autocomplete="email" class="input" />
    </label>
    <button :disabled="busy" class="btn">Получить код</button>
  </form>
  <form v-else class="space-y-3" @submit.prevent="verify">
    <p>Код отправлен на {{ email }}. Письмо может идти минуту, загляните и в «Спам».</p>
    <input
      v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required
      class="input tracking-widest" placeholder="Код из письма"
    />
    <div class="flex items-center gap-4">
      <button :disabled="busy" class="btn">Войти</button>
      <button type="button" class="link" @click="step = 'email'">Другая почта</button>
    </div>
  </form>
  <p v-if="error" class="mt-3 text-red-400">{{ error }}</p>
</template>
