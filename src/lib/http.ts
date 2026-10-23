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
  /** Wynik z trwałego cache po terminie świeżości — źródło nie odpowiedziało przy tym raporcie. */
  stale?: boolean
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

// ─── Cache ────────────────────────────────────────────────────────────────────
// Dwa poziomy: pamięć procesu (L1, żyje tyle co ciepła instancja) i opcjonalny
// trwały magazyn (L2, tabela source_cache) współdzielony przez instancje.
// L2 jest zarazem zapisem postępu: gdy platforma przerwie generowanie raportu,
// kolejna próba z kolejki bierze z L2 wszystko, co zdążyło się pobrać.

/** Zmień przy zmianie kształtu cache'owanych danych — stare wpisy w L2 przestaną pasować. */
export const CACHE_VERSION = 'v1'

export interface PersistentEntry {
  value: unknown
  /** Do kiedy wynik jest aktualny (ms epoch). */
  freshUntil: number
  /** Do kiedy wolno go użyć awaryjnie, gdy źródło nie odpowiada. */
  keepUntil: number
  createdAt: number
}

export interface PersistentCache {
  get(key: string): Promise<PersistentEntry | null>
  set(key: string, entry: PersistentEntry): Promise<void>
}

let persistent: PersistentCache | null = null

/** Włącza L2. Bez tego (testy, skrypty) cache działa tylko w pamięci. */
export function setPersistentCache(store: PersistentCache | null) {
  persistent = store
}

const L2_TIMEOUT_MS = 2500

// Awaria magazynu nigdy nie psuje raportu — najwyżej pobieramy dane od nowa.
async function l2<T>(op: string, fn: (s: PersistentCache) => Promise<T>): Promise<T | null> {
  if (!persistent) return null
  const store = persistent
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fn(store),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout ${L2_TIMEOUT_MS} ms`)), L2_TIMEOUT_MS) }),
    ])
  } catch (e) {
    console.warn(`[cache] ${op} L2 nieudany:`, e instanceof Error ? e.message : e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const MAX_ENTRIES = 1000
const store = new Map<string, { exp: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

/** Jak długo trzymamy wynik w L2 na wypadek awarii źródła. */
export const STALE_KEEP_MS = 30 * 24 * 60 * 60 * 1000

function remember(key: string, value: unknown, exp: number) {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string)
  store.set(key, { exp, value })
}

interface StalePolicy<T> {
  /** Oznacza wartość jako kopię (np. flaga widoczna w raporcie). */
  mark: (v: T) => T
  /** Czy użyć kopii także, gdy fn zwróci wynik odrzucony przez shouldCache (a nie tylko rzuci). */
  onRejected: boolean
}

async function load<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  shouldCache: (v: T) => boolean,
  stalePolicy?: StalePolicy<T>,
  persist = true,
): Promise<T> {
  const l2Key = `${CACHE_VERSION}:${key}`
  const entry = persist ? await l2('odczyt', s => s.get(l2Key)) : null
  if (entry && entry.freshUntil > Date.now()) {
    remember(key, entry.value, entry.freshUntil)
    return entry.value as T
  }
  // Przeterminowany wpis ratuje raport, gdy źródło właśnie nie odpowiada.
  const stale = stalePolicy && entry && entry.keepUntil > Date.now() ? stalePolicy.mark(entry.value as T) : undefined

  let value: T
  try {
    value = await fn()
  } catch (e) {
    if (stale !== undefined) return stale
    throw e
  }
  if (!shouldCache(value)) return stalePolicy?.onRejected && stale !== undefined ? stale : value

  const now = Date.now()
  remember(key, value, now + ttlMs)
  if (persist) await l2('zapis', s => s.set(l2Key, { value, freshUntil: now + ttlMs, keepUntil: now + Math.max(ttlMs, STALE_KEEP_MS), createdAt: now }))
  return value
}

function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.value as T)
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const p = run().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export interface CacheOptions<T> {
  /** Czy wynik zapisać (domyślnie zawsze). */
  shouldCache?: (v: T) => boolean
  /** Gdy fn rzuci (źródło nie odpowiada), zwróć przeterminowany wpis z L2 (do STALE_KEEP_MS) oznaczony tą funkcją. */
  staleOnThrow?: (v: T) => T
  /** false = tylko pamięć procesu (duże albo pomocnicze dane, których nie warto trzymać w bazie). */
  persist?: boolean
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, opts: CacheOptions<T> = {}): Promise<T> {
  const { shouldCache = () => true, staleOnThrow, persist = true } = opts
  return dedupe(key, () => load(key, ttlMs, fn, shouldCache, staleOnThrow && { mark: staleOnThrow, onRejected: false }, persist))
}

/**
 * Cache wyniku źródła danych. Gdy źródło zwróci błąd, a w L2 jest wcześniejszy
 * wynik (do STALE_KEEP_MS), zwracamy go z flagą `stale` — raport pokazuje datę pobrania.
 */
export async function cachedSource<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<SourceResult<T>>,
): Promise<SourceResult<T>> {
  return dedupe(key, () => load(key, ttlMs, fn, cacheableResult, { mark: v => ({ ...v, stale: true }), onRejected: true }))
}

// ─── Bezpiecznik ──────────────────────────────────────────────────────────────
// Usługę, która właśnie przestała odpowiadać, pomijamy przez chwilę we wszystkich
// instancjach (L1 + L2), zamiast w każdym raporcie czekać na jej timeout.

const tripped = new Map<string, number>()

export async function isTripped(name: string): Promise<boolean> {
  const until = tripped.get(name)
  if (until && until > Date.now()) return true
  const entry = await l2('odczyt', s => s.get(`${CACHE_VERSION}:circuit:${name}`))
  if (entry && entry.freshUntil > Date.now()) {
    tripped.set(name, entry.freshUntil)
    return true
  }
  return false
}

export async function trip(name: string, ms: number, reason: string): Promise<void> {
  const now = Date.now()
  tripped.set(name, now + ms)
  await l2('zapis', s => s.set(`${CACHE_VERSION}:circuit:${name}`, { value: { reason }, freshUntil: now + ms, keepUntil: now + ms, createdAt: now }))
}

export function clearCache() {
  store.clear()
  tripped.clear()
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
    // Przyczyna trafia do logów funkcji hostingu; „fetch failed” bez cause nic nie mówi.
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${(e.cause as NodeJS.ErrnoException).code ?? ''} ${e.cause.message})` : ''
    console.warn(`[source] ${source} błąd po ${Date.now() - t0} ms: ${e instanceof Error ? e.message : String(e)}${cause}`)
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
