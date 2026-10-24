import type { SupabaseClient } from '@supabase/supabase-js'
import { setPersistentCache, type PersistentCache } from './http'

const TABLE = 'source_cache'

interface Row {
  value: unknown
  fresh_until: string
  keep_until: string
  created_at: string
}

/** Trwały cache źródeł w tabeli source_cache (migracja 20261020). */
export function supabaseSourceCache(svc: SupabaseClient): PersistentCache {
  const iso = (ms: number) => new Date(ms).toISOString()
  return {
    async get(key) {
      const { data, error } = await svc.from(TABLE).select('value, fresh_until, keep_until, created_at').eq('key', key).maybeSingle<Row>()
      if (error) throw new Error(error.message)
      if (!data) return null
      return {
        value: data.value,
        freshUntil: Date.parse(data.fresh_until),
        keepUntil: Date.parse(data.keep_until),
        createdAt: Date.parse(data.created_at),
      }
    },
    async set(key, e) {
      const { error } = await svc.from(TABLE).upsert({
        key, value: e.value, fresh_until: iso(e.freshUntil), keep_until: iso(e.keepUntil), created_at: iso(e.createdAt),
      })
      if (error) throw new Error(error.message)
    },
  }
}

let enabled = false

/**
 * Włącza trwały cache dla procesu (idempotentne). SOURCE_CACHE=off wyłącza go,
 * np. gdy migracja nie została jeszcze wykonana na danej bazie.
 */
export function enablePersistentCache(svc: SupabaseClient) {
  if (enabled || process.env.SOURCE_CACHE === 'off') return
  setPersistentCache(supabaseSourceCache(svc))
  enabled = true
}

/** Usuwa wpisy, których nie wolno już użyć nawet awaryjnie. */
export async function pruneSourceCache(svc: SupabaseClient): Promise<void> {
  const { error } = await svc.from(TABLE).delete().lt('keep_until', new Date().toISOString())
  if (error) console.warn('[cache] czyszczenie source_cache nieudane:', error.message)
}
