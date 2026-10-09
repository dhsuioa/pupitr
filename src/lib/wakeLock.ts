import { onBeforeUnmount, onMounted, ref } from 'vue'

// Не даём экрану гаснуть, пока открыта сцена. Браузер отпускает замок, когда приложение свёрнуто, — берём снова.
export function useWakeLock() {
  const ok = ref(true)
  let lock: WakeLockSentinel | null = null

  async function take() {
    if (!('wakeLock' in navigator)) return void (ok.value = false)
    try {
      lock = await navigator.wakeLock.request('screen')
      ok.value = true
    } catch {
      ok.value = false // Safari иногда требует жест пользователя — сцена повторит на первом тапе
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') take()
  }

  onMounted(() => {
    take()
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release()
  })
  return { ok, take }
}
