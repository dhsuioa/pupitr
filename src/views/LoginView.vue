<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import LoginForm from '../components/LoginForm.vue'

const route = useRoute()
const router = useRouter()
const done = () => router.replace(typeof route.query.next === 'string' ? route.query.next : '/')
</script>

<template>
  <main class="mx-auto max-w-sm space-y-6 p-6">
    <h1 class="text-2xl font-semibold">Пюпитр</h1>
    <p class="text-sm text-neutral-400">Вход по почте: пароль не нужен, придёт код.</p>
    <LoginForm @done="done" />
  </main>
</template>
