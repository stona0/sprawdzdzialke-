/**
 * Server-side input validation for parcelId and gmina.
 *
 * Identyfikator EGB: TERYT.OBREB.DZIALKA
 * Przykłady poprawnych:
 *   141201_1.0001.6/2
 *   0261011.0001.AR_1.6/3
 *   020301_1.0001.123
 *
 * TERYT gminy:
 *   6-7 cyfr + opcjonalnie _1/_2/_3 (typ gminy)
 *   Przykład: 141201_1, 0261011
 */

// Dozwolone znaki w identyfikatorze EGB: cyfry, litery, kropki, podkreślenia, ukośnik, myślnik
const PARCEL_ID_REGEX = /^[a-zA-Z0-9._\-/]{5,60}$/

// TERYT gminy: 6-7 cyfr + opcjonalny suffix _1, _2, _3, _4, _5, _8, _9
const TERYT_REGEX = /^\d{6,7}(_[1-9])?$/

// Nazwa gminy: litery polskie, spacje, myślniki (max 100 znaków)
const GMINA_NAME_REGEX = /^[\p{L}\s\-().]{2,100}$/u

/**
 * Waliduje parcelId. Zwraca null jeśli OK, string z błędem jeśli nie.
 */
export function validateParcelId(parcelId: unknown): string | null {
  if (typeof parcelId !== 'string') {
    return 'parcelId musi być stringiem'
  }

  const trimmed = parcelId.trim()
  if (trimmed.length === 0) {
    return 'parcelId nie może być pusty'
  }

  if (trimmed.length > 60) {
    return 'parcelId zbyt długi (max 60 znaków)'
  }

  if (!trimmed.includes('.')) {
    return 'parcelId musi zawierać kropki (format EGB: TERYT.OBREB.DZIALKA)'
  }

  if (!PARCEL_ID_REGEX.test(trimmed)) {
    return 'parcelId zawiera niedozwolone znaki'
  }

  // Musi mieć min 2 kropki (TERYT.OBREB.DZIALKA)
  const dotCount = (trimmed.match(/\./g) ?? []).length
  if (dotCount < 2) {
    return 'parcelId musi mieć format TERYT.OBREB.DZIALKA (min 2 kropki)'
  }

  return null
}

/**
 * Waliduje TERYT gminy (kod numeryczny).
 */
export function validateTeryt(teryt: unknown): string | null {
  if (typeof teryt !== 'string') return 'teryt musi być stringiem'
  const trimmed = teryt.trim()
  if (trimmed.length === 0) return 'teryt nie może być pusty'
  if (!TERYT_REGEX.test(trimmed)) return 'teryt musi mieć format: 6-7 cyfr + opcjonalnie _1-_9'
  return null
}

/**
 * Waliduje nazwę gminy (pole tekstowe).
 */
export function validateGmina(gmina: unknown): string | null {
  if (typeof gmina !== 'string') return 'gmina musi być stringiem'
  const trimmed = gmina.trim()
  if (trimmed.length === 0) return 'Nazwa gminy nie może być pusta'
  if (trimmed.length > 100) return 'Nazwa gminy zbyt długa (max 100 znaków)'
  if (!GMINA_NAME_REGEX.test(trimmed)) return 'Nazwa gminy zawiera niedozwolone znaki'
  return null
}

/**
 * Sanityzuje string — usuwa control characters, trim, max length.
 */
export function sanitize(input: string, maxLength = 200): string {
  return input
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars
    .trim()
    .slice(0, maxLength)
}
