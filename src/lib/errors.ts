import { ref } from 'vue'

// Человеческие сообщения для ошибок Supabase и сети.
export function errorMessage(e: unknown): string {
  const err = (e ?? {}) as { name?: string; code?: string; message?: string }
  const msg = err.message ?? ''
  if (err.name === 'AuthRetryableFetchError' || /Failed to fetch|Load failed|NetworkError/.test(msg))
    return 'Нет связи с сервером. Проверьте интернет или включите VPN.'
  if (err.code === 'otp_expired') return 'Код неверный или устарел. Запросите новый.'
  if (err.code?.startsWith('over_')) return 'Слишком часто. Подождите минуту и попробуйте снова.'
  if (msg.includes('invalid_invite')) return 'Ссылка-приглашение устарела. Попросите у руководителя новую.'
  if (err.code === '23503') return 'Нельзя удалить: у этой позиции есть файлы.'
  return msg || 'Что-то пошло не так.'
}

// Обёртка для кнопок: занятость и текст ошибки.
export function useAction() {
  const busy = ref(false)
  const error = ref('')
  async function run(fn: () => Promise<unknown>) {
    busy.value = true
    error.value = ''
    try {
      await fn()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
