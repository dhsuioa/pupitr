import { describe, expect, it } from 'vitest'
import { errorMessage, isNetworkError } from './errors'

describe('errorMessage', () => {
  it('нет связи — в Chrome, Safari и из supabase-js', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Нет связи/)
    expect(errorMessage(new TypeError('Load failed'))).toMatch(/Нет связи/)
    expect(errorMessage({ name: 'AuthRetryableFetchError', message: '{}' })).toMatch(/Нет связи/)
  })

  it('неверный или просроченный код', () => {
    expect(errorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(/Код неверный/)
  })

  it('слишком частые запросы кода', () => {
    expect(errorMessage({ code: 'over_email_send_rate_limit', message: 'rate limit' })).toMatch(/Подождите минуту/)
    expect(errorMessage({ code: 'over_request_rate_limit', message: 'rate limit' })).toMatch(/Подождите минуту/)
  })

  it('устаревшая ссылка-приглашение', () => {
    expect(errorMessage({ code: 'P0001', message: 'invalid_invite' })).toMatch(/Ссылка-приглашение устарела/)
  })

  it('позиция с файлами', () => {
    expect(errorMessage({ code: '23503', message: 'violates foreign key constraint' })).toMatch(/есть файлы/)
  })

  it('прочее — исходный текст или общая фраза', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(undefined)).toBe('Что-то пошло не так.')
  })
})

describe('isNetworkError', () => {
  it('обрыв сети — да, ошибка базы — нет', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: '' })).toBe(true)
    expect(isNetworkError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
  it('запрос оборван по таймауту — тоже нет связи', () => {
    expect(isNetworkError({ message: 'AbortError: The user aborted a request.' })).toBe(true)
    expect(isNetworkError({ name: 'TimeoutError', message: 'signal timed out' })).toBe(true)
    expect(errorMessage({ message: 'AbortError: The user aborted a request.' })).toMatch(/Нет связи/)
  })
})
