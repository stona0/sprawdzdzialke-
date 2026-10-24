/**
 * Przekierowania po logowaniu (src/lib/auth-redirect.ts): /auth/callback?next=… i /login?redirectTo=…
 * nie mogą wyprowadzić zalogowanego użytkownika poza serwis; błędy Supabase mają polskie komunikaty.
 */
import { describe, expect, it } from 'vitest'
import { authErrorMessage, callbackUrl, errorCode, safeNext } from '../../src/lib/auth-redirect'

describe('safeNext', () => {
  it('przepuszcza ścieżki w aplikacji (z zapytaniem i kotwicą)', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/report/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab')).toBe('/report/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab')
    expect(safeNext('/reset-password')).toBe('/reset-password')
    expect(safeNext('/dashboard?payment=cancelled#raporty')).toBe('/dashboard?payment=cancelled#raporty')
  })

  it.each([
    ['//evil.com'],
    ['//evil.com/dashboard'],
    ['/\\evil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['https://evil.com'],
    ['http:evil.com'],
    ['javascript:alert(1)'],
    ['evil.com'],
    ['dashboard'],
    [''],
  ])('odrzuca %j → domyślnie /dashboard', next => {
    expect(safeNext(next)).toBe('/dashboard')
  })

  it('brak parametru → domyślna ścieżka', () => {
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext(undefined, '/login')).toBe('/login')
  })

  it('zakodowane ukośniki zostają ścieżką na tej samej domenie', () => {
    expect(safeNext('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com')
  })
})

describe('callbackUrl', () => {
  it('domyślny cel bez parametru, inny cel w ?next= (zakodowany)', () => {
    expect(callbackUrl('https://testdzialki.netlify.app', null)).toBe('https://testdzialki.netlify.app/auth/callback')
    expect(callbackUrl('http://localhost:3000', '/reset-password')).toBe('http://localhost:3000/auth/callback?next=%2Freset-password')
    expect(callbackUrl('http://localhost:3000', '//evil.com')).toBe('http://localhost:3000/auth/callback')
  })
})

describe('errorCode', () => {
  it('przenosi tylko kody z bezpiecznych znaków', () => {
    expect(errorCode('access_denied')).toBe('access_denied')
    expect(errorCode('otp_expired')).toBe('otp_expired')
    expect(errorCode('<script>')).toBe('auth_callback_failed')
    expect(errorCode('Access Denied')).toBe('auth_callback_failed')
    expect(errorCode(undefined)).toBe('auth_callback_failed')
  })
})

describe('authErrorMessage', () => {
  it('kody Supabase → polskie komunikaty', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Nieprawidłowy e-mail lub hasło.')
    expect(authErrorMessage('access_denied')).toMatch(/Google.*przerwane/)
    expect(authErrorMessage('provider_disabled')).toMatch(/Google.*niedostępne/)
    expect(authErrorMessage('otp_expired')).toMatch(/Link wygasł/)
  })

  it('odpowiedzi bez kodu rozpoznaje po treści', () => {
    expect(authErrorMessage(undefined, 'Invalid login credentials')).toBe('Nieprawidłowy e-mail lub hasło.')
    expect(authErrorMessage(undefined, 'Email not confirmed')).toMatch(/Potwierdź adres e-mail/)
    expect(authErrorMessage('validation_failed', 'Unsupported provider: provider is not enabled')).toMatch(/Google.*niedostępne/)
  })

  it('nieznany błąd → ogólny komunikat po polsku, nigdy surowy angielski tekst', () => {
    expect(authErrorMessage('something_new', 'Some English message')).toBe('Nie udało się zalogować. Spróbuj ponownie.')
    expect(authErrorMessage('auth_callback_failed')).toBe('Nie udało się zalogować. Spróbuj ponownie.')
  })
})
