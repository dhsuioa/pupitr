import { createClient } from '@supabase/supabase-js'

// Таймаут: при блокировке соединение часто не рвётся, а виснет — без него кнопки крутились бы бесконечно.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  db: { timeout: 15000 },
})
