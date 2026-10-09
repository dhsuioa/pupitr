<script setup lang="ts">
import { useApp } from '../stores/app'
import { useAction } from '../lib/errors'

const emit = defineEmits<{ picked: [] }>()
const app = useApp()
const { busy, error, run } = useAction()

const pick = (id: string | null) => run(async () => {
  await app.updateMe({ position_id: id })
  emit('picked')
})
</script>

<template>
  <section class="space-y-2">
    <h2 class="font-medium">Мой инструмент</h2>
    <p class="text-sm text-neutral-400">
      В каждой пьесе сразу откроется ваша партия, а если её нет — партитура целиком.
    </p>
    <div class="grid gap-2">
      <button
        v-for="p in app.positions" :key="p.id" :disabled="busy" class="btn text-left"
        :class="{ 'ring-2 ring-amber-400': p.id === app.me?.position_id }" @click="pick(p.id)"
      >{{ p.name }}</button>
      <button
        v-if="app.isOwner" :disabled="busy" class="btn text-left"
        :class="{ 'ring-2 ring-amber-400': !app.me?.position_id }" @click="pick(null)"
      >Партитура целиком</button>
    </div>
    <p v-if="!app.positions.length" class="text-sm text-neutral-400">
      Руководитель ещё не заполнил состав коллектива.
    </p>
    <p v-if="error" class="text-red-400">{{ error }}</p>
  </section>
</template>
