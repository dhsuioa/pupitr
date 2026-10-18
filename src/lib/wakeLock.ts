import { onBeforeUnmount, onMounted, ref } from 'vue'

// На iOS до 18.4 в приложении с домашнего экрана замок «берётся» без ошибки, но экран всё равно гаснет (WebKit 254545).
export function wakeLockReliable(ua: string, standalone: boolean): boolean {
  if (!standalone) return true
  const ios = ua.match(/OS (\d+)_(\d+)/) ?? (/Macintosh/.test(ua) ? ua.match(/Version\/(\d+)\.(\d+)/) : null)
  if (!ios || !/iPhone|iPad|iPod|Macintosh/.test(ua)) return true
  const [major, minor] = [Number(ios[1]), Number(ios[2])]
  return major > 18 || (major === 18 && minor >= 4)
}

// Не даём экрану гаснуть, пока открыта сцена. Браузер отпускает замок, когда приложение свёрнуто, — берём снова.
export function useWakeLock() {
  const ok = ref(true)
  let lock: WakeLockSentinel | null = null

  const standalone =
    matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const reliable = wakeLockReliable(navigator.userAgent, standalone)

  async function take() {
    if (!('wakeLock' in navigator) || !reliable) return void (ok.value = false)
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
