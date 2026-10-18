import { describe, expect, it } from 'vitest'
import { wakeLockReliable } from './wakeLock'

const iphone = (v: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`

describe('wakeLockReliable', () => {
  it('приложение с домашнего экрана на iOS до 18.4 — замок «берётся», но экран гаснет', () => {
    expect(wakeLockReliable(iphone('17_5'), true)).toBe(false)
    expect(wakeLockReliable(iphone('18_3_1'), true)).toBe(false)
  })
  it('iOS 18.4 и новее — работает', () => {
    expect(wakeLockReliable(iphone('18_4'), true)).toBe(true)
    expect(wakeLockReliable(iphone('26_0'), true)).toBe(true)
  })
  it('iPad в режиме «как Mac» — версия из Version/', () => {
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    expect(wakeLockReliable(ipad, true)).toBe(false)
  })
  it('вкладка Safari и Android — работает', () => {
    expect(wakeLockReliable(iphone('17_5'), false)).toBe(true)
    expect(wakeLockReliable('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', true)).toBe(true)
  })
})
