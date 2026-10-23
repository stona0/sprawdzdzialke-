/**
 * Trwały cache źródeł (L2) — przez supabase-js na mocku Supabase
 * (PGlite ze schematem z repo). Bez sieci.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cached, cachedSource, clearCache, setPersistentCache, type SourceResult } from '@/lib/http'
import { supabaseSourceCache } from '@/lib/source-cache'
import { startMockSupabase } from '../e2e/mock-supabase.mjs'

let mock: Awaited<ReturnType<typeof startMockSupabase>>
let svc: SupabaseClient
const pg = () => mock.db() as PGlite
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await pg().query<T>(q, params)).rows

beforeAll(async () => {
  mock = await startMockSupabase()
  svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false, autoRefreshToken: false } })
})
afterAll(async () => {
  setPersistentCache(null)
  await mock.close()
})
beforeEach(async () => {
  await sql('DELETE FROM source_cache')
  clearCache()
  setPersistentCache(supabaseSourceCache(svc))
})

describe('trwały cache źródeł (source_cache)', () => {
  const result = (status: SourceResult<unknown>['status'], data: unknown = null): SourceResult<unknown> =>
    ({ source: 'Test', status, data, ms: 5, fetchedAt: '2026-10-01T10:00:00.000Z' })

  it('nowa instancja (pusta pamięć) bierze wynik z bazy, bez zapytania do źródła', async () => {
    const fn = vi.fn(async () => result('ok', { strefa: 'MN' }))
    await cachedSource('test:a', 60_000, fn)
    const [row] = await sql<{ key: string; value: { data: unknown } }>('SELECT key, value FROM source_cache')
    expect(row.key).toBe('v1:test:a')
    expect(row.value.data).toEqual({ strefa: 'MN' })

    clearCache()
    const again = await cachedSource('test:a', 60_000, fn)
    expect(again.data).toEqual({ strefa: 'MN' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('błędów nie zapisujemy', async () => {
    await cachedSource('test:b', 60_000, async () => result('error'))
    expect(await sql('SELECT 1 FROM source_cache')).toHaveLength(0)
  })

  it('awaria źródła → przeterminowany wynik z flagą stale i oryginalną datą pobrania', async () => {
    await cachedSource('test:c', 60_000, async () => result('ok', { x: 1 }))
    await sql(`UPDATE source_cache SET fresh_until = NOW() - interval '1 hour'`)
    clearCache()
    const r = await cachedSource('test:c', 60_000, async () => result('error'))
    expect(r).toMatchObject({ status: 'ok', data: { x: 1 }, stale: true, fetchedAt: '2026-10-01T10:00:00.000Z' })

    const thrown = await cachedSource('test:c', 60_000, async () => { throw new Error('offline') })
    expect(thrown.stale).toBe(true)
  })

  it('po keep_until nie używamy starego wyniku', async () => {
    await cachedSource('test:d', 60_000, async () => result('ok', { x: 1 }))
    await sql(`UPDATE source_cache SET fresh_until = NOW() - interval '2 days', keep_until = NOW() - interval '1 day'`)
    clearCache()
    expect((await cachedSource('test:d', 60_000, async () => result('error'))).status).toBe('error')
  })

  it('ULDK: kopia tylko przy awarii, nie przy odpowiedzi „brak działki”', async () => {
    type P = { found: boolean; stale?: boolean }
    const mark = (p: P) => ({ ...p, stale: true })
    await cached<P>('uldk:t', 60_000, async () => ({ found: true }), p => p.found, mark)
    await sql(`UPDATE source_cache SET fresh_until = NOW() - interval '1 hour'`)
    clearCache()
    expect(await cached<P>('uldk:t', 60_000, async () => ({ found: false }), p => p.found, mark)).toEqual({ found: false })
    clearCache()
    expect(await cached<P>('uldk:t', 60_000, async () => { throw new Error('ULDK: HTTP 503') }, p => p.found, mark)).toEqual({ found: true, stale: true })
  })

  it('niedostępna baza nie psuje pobierania', async () => {
    setPersistentCache({ get: async () => { throw new Error('db down') }, set: async () => { throw new Error('db down') } })
    const r = await cachedSource('test:e', 60_000, async () => result('ok', 1))
    expect(r.data).toBe(1)
  })
})
