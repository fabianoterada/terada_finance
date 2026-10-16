import { createClient } from '@supabase/supabase-js'

const env = import.meta.env

const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL

const key =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  url && key && !url.includes('your-project') && !key.includes('your-'),
)

export const AUTH_STORAGE_KEY = 'terada_finance_auth'

const AUTH_STORAGE_PREFIXES = ['terada_finance', 'sb-', 'supabase.auth.token']

function purgeStorage(storage) {
  if (!storage) return
  const keys = []
  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index)
    if (!storageKey) continue
    const normalized = storageKey.toLowerCase()
    if (AUTH_STORAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      keys.push(storageKey)
    }
  }
  keys.forEach((storageKey) => storage.removeItem(storageKey))
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return
  try {
    purgeStorage(window.localStorage)
  } catch (err) {
    console.warn('[supabase] Não foi possível limpar o localStorage:', err)
  }
  try {
    purgeStorage(window.sessionStorage)
  } catch (err) {
    console.warn('[supabase] Não foi possível limpar o sessionStorage:', err)
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  : null
