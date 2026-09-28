import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

function sanitize(val: string | undefined, fallback: string): string {
  if (!val) return fallback
  // Strip UTF-16 BOM (\ufeff), non-printable ASCII, or non-ISO-8859-1 characters
  const cleaned = val.replace(/^\ufeff/, '').replace(/[^\x20-\x7E]/g, '').trim()
  return cleaned || fallback
}

const supabaseUrl = sanitize(
  import.meta.env.VITE_SUPABASE_URL,
  'https://mpqivpxswksjqkohhjje.supabase.co'
)

const supabaseAnonKey = sanitize(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  'sb_publishable_QHCcnFUxdqD5AQ6nbc8jIQ_Chnp6ssW'
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    storage: window.localStorage
  }
})
