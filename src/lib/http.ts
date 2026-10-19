export const USER_AGENT = 'SprawdzDzialke/2.0 (+https://sprawdzdzialke.com)'

/**
 * ok          – źródło odpowiedziało i ma dane dla działki
 * no_data     – źródło odpowiedziało, ale dla działki nic nie ma (np. brak MPZP, brak strefy zalewowej)
 * not_covered – źródło nie obejmuje tego obszaru (np. gmina nie podłączona do krajowej integracji)
 * error       – źródło nie odpowiedziało / zwróciło błąd → wynik nieznany, NIE „brak”
 */
export type SourceStatus = 'ok' | 'no_data' | 'not_covered' | 'error'

export interface SourceResult<T> {
  source: string
  status: SourceStatus
  data: T | null
  error?: string
  ms: number
  fetchedAt: string
}

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} ${new URL(url).host}`)
  }
}

interface RetryInit extends RequestInit {
  timeoutMs?: number
  retries?: number
}

export async function fetchWithRetry(url: string, init: RetryInit = {}): Promise<Response> {
  const { timeoutMs = 10_000, retries = 2, headers, ...rest } = init
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { 'User-Agent': USER_AGENT, ...(headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      if (res.status >= 500 || res.status === 429) throw new HttpError(res.status, url)
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) await new Promise(r => setTimeout(r, 400 * 2 ** attempt))
    }
  }
  throw lastErr
}

// ─── Cache w pamięci procesu ──────────────────────────────────────────────────
// Na serverless żyje tyle co ciepła instancja; to wystarcza do odciążenia
// państwowych usług przy powtórnych zapytaniach o tę samą działkę.

const MAX_ENTRIES = 1000
const store = new Map<string, { exp: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  shouldCache: (v: T) => boolean = () => true,
): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.value as T
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const p = fn()
    .then(v => {
      if (shouldCache(v)) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string)
        store.set(key, { exp: Date.now() + ttlMs, value: v })
      }
      return v
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function clearCache() {
  store.clear()
}

export const DAY = 24 * 60 * 60 * 1000

/** Uruchamia zapytanie do źródła i zawsze zwraca SourceResult — nigdy nie rzuca. */
export async function runSource<T>(
  source: string,
  fn: () => Promise<{ status: SourceStatus; data: T | null }>,
): Promise<SourceResult<T>> {
  const t0 = Date.now()
  try {
    const { status, data } = await fn()
    return { source, status, data, ms: Date.now() - t0, fetchedAt: new Date().toISOString() }
  } catch (e) {
    return {
      source,
      status: 'error',
      data: null,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
      fetchedAt: new Date().toISOString(),
    }
  }
}

/** Wynik cache'ujemy tylko gdy źródło odpowiedziało (błędy mają być ponawiane). */
export function cacheableResult<T>(r: SourceResult<T>): boolean {
  return r.status !== 'error'
}
