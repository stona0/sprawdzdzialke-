import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, callbackUrl } from '@/lib/auth-redirect'

/**
 * Czy dostawca Google jest włączony w projekcie Supabase (publiczne /auth/v1/settings).
 * Wyłączony dostawca kończy się stroną z surowym JSON-em na supabase.co („provider is not enabled”),
 * więc sprawdzamy przed przekierowaniem. Gdy sprawdzenie się nie uda, nie blokujemy logowania.
 */
async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
    if (!res.ok) return true
    const settings = await res.json()
    return settings?.external?.google !== false
  } catch {
    return true
  }
}

/** Przekierowuje do Google; zwraca komunikat błędu, gdy logowanie nie może się zacząć. */
export async function startGoogleLogin(next: string | null): Promise<string | null> {
  if (!(await googleEnabled())) return authErrorMessage('provider_disabled')
  // auth-js sam przechodzi pod zwrócony adres (skipBrowserRedirect domyślnie false)
  const { error } = await createClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl(window.location.origin, next) },
  })
  return error ? authErrorMessage(error.code, error.message) : null
}
