/**
 * Przekierowania i komunikaty logowania (hasło, Google, link z maila).
 * Czyste funkcje — używa ich callback OAuth (serwer) i strony (auth) (przeglądarka).
 */

const BASE = 'http://localhost.invalid'
export const DEFAULT_NEXT = '/dashboard'

/**
 * Dokąd wrócić po zalogowaniu: tylko ścieżka w tej aplikacji. Bez tego `?next=//evil.com`
 * albo `?next=/\evil.com` przekierowałby zalogowanego użytkownika na obcą stronę (open redirect).
 */
export function safeNext(next: string | null | undefined, fallback = DEFAULT_NEXT): string {
  // ukośnik wsteczny i znaki sterujące przeglądarki zamieniają lub usuwają → „//host”
  if (!next || next[0] !== '/' || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return fallback
  }
  return url.origin === BASE ? url.pathname + url.search + url.hash : fallback
}

/** Adres powrotu z Google lub z linku w mailu: callback wymienia `code` na sesję i przechodzi do `next`. */
export function callbackUrl(origin: string, next?: string | null): string {
  const target = safeNext(next)
  return target === DEFAULT_NEXT ? `${origin}/auth/callback` : `${origin}/auth/callback?next=${encodeURIComponent(target)}`
}

/** Kod błędu do `?error=` — tylko bezpieczne znaki, żeby nie przenosić dowolnego tekstu w adresie. */
export function errorCode(code: string | null | undefined, fallback = 'auth_callback_failed'): string {
  return code && /^[a-z0-9_]{1,64}$/.test(code) ? code : fallback
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
  email_not_confirmed: 'Potwierdź adres e-mail — link aktywacyjny jest w Twojej skrzynce.',
  user_already_exists: 'Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.',
  email_exists: 'Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.',
  weak_password: 'Hasło jest za słabe — wybierz dłuższe.',
  same_password: 'Nowe hasło musi się różnić od dotychczasowego.',
  over_request_rate_limit: 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  over_email_send_rate_limit: 'Wysłaliśmy już kilka maili. Odczekaj chwilę, zanim poprosisz o kolejny.',
  email_address_invalid: 'Ten adres e-mail jest nieprawidłowy.',
  access_denied: 'Logowanie przez Google zostało przerwane.',
  provider_disabled: 'Logowanie przez Google jest chwilowo niedostępne. Zaloguj się e-mailem i hasłem.',
  otp_expired: 'Link wygasł albo został już użyty. Poproś o nowy.',
  pkce_code_verifier_not_found: 'Nie udało się dokończyć logowania. Otwórz link w tej samej przeglądarce, w której o niego poproszono.',
  flow_state_not_found: 'Nie udało się dokończyć logowania. Spróbuj ponownie.',
  flow_state_expired: 'Logowanie trwało zbyt długo. Spróbuj ponownie.',
  bad_oauth_state: 'Nie udało się dokończyć logowania. Spróbuj ponownie.',
  session_missing: 'Sesja wygasła. Poproś o nowy link do zmiany hasła.',
}

const DEFAULT_MESSAGE = 'Nie udało się zalogować. Spróbuj ponownie.'

/**
 * Komunikat po polsku dla kodu błędu Supabase (`error.code`, `?error=` z callbacku).
 * Starsze odpowiedzi nie mają kodu — wtedy rozpoznajemy treść.
 */
export function authErrorMessage(code: string | null | undefined, message?: string | null): string {
  if (code && MESSAGES[code]) return MESSAGES[code]
  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login credentials')) return MESSAGES.invalid_credentials
  if (m.includes('email not confirmed')) return MESSAGES.email_not_confirmed
  if (m.includes('already registered')) return MESSAGES.user_already_exists
  if (m.includes('provider is not enabled')) return MESSAGES.provider_disabled
  if (m.includes('rate limit')) return MESSAGES.over_request_rate_limit
  return DEFAULT_MESSAGE
}
