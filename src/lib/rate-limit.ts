/**
 * In-memory sliding window rate limiter.
 *
 * Wystarczający dla single-instance Node.js (Vercel function per-invocation
 * nie zachowuje stanu, ale w trybie edge/standalone — działa).
 *
 * Dla produkcyjnego scale → przenieść na Upstash Redis (@upstash/ratelimit).
 * Na MVP to jest OK.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Auto-cleanup co 5 minut żeby nie zjadać pamięci
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs * 2
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix ms
}

/**
 * Sprawdza rate limit.
 *
 * @param key       Unikalny klucz (np. userId lub IP)
 * @param maxHits   Max ilość requestów w oknie
 * @param windowMs  Okno czasowe w ms
 */
export function checkRateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): RateLimitResult {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Wyczyść stare
  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= maxHits) {
    const oldestInWindow = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: maxHits - entry.timestamps.length,
    resetAt: now + windowMs,
  }
}

/**
 * Pobiera klucz rate limit z requestu.
 * Preferuje userId (zalogowany), fallback na IP.
 */
export function getRateLimitKey(userId: string | null, request: Request): string {
  if (userId) return `user:${userId}`
  const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const ip = forwarded || 'unknown'
  return `ip:${ip}`
}
