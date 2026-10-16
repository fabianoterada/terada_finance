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

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'terada_finance_auth',
      },
    })
  : null
