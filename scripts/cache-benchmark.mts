/**
 * Pomiar trwałego cache źródeł na prawdziwych usługach państwowych:
 *  1. zimny start (pusta pamięć i pusta baza),
 *  2. nowa instancja funkcji (pusta pamięć, baza z poprzedniego przebiegu),
 *  3. awaria wszystkich usług zewnętrznych po terminie świeżości cache.
 * Baza to lokalny mock Supabase (PGlite) — żadnego zapisu do produkcji.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/cache-benchmark.mts [slug...]
 */
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import type { ReportData } from '../src/lib/report/collect'
import { startMockSupabase } from '../tests/e2e/mock-supabase.mjs'
import { TEST_PARCELS } from '../tests/parcels'

// tsx ładuje src/*.ts importowane z ESM osobno od ich wewnętrznych importów (CJS) —
// stan modułu http.ts byłby zdublowany. require() daje jedną instancję, jak w bundlu Next.
const require = createRequire(import.meta.url)
const { clearCache, setPersistentCache } = require('../src/lib/http') as typeof import('../src/lib/http')
const { collectReportData } = require('../src/lib/report/collect') as typeof import('../src/lib/report/collect')
const { supabaseSourceCache } = require('../src/lib/source-cache') as typeof import('../src/lib/source-cache')

const mock = await startMockSupabase()
const svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false } })
setPersistentCache(supabaseSourceCache(svc))

const only = process.argv.slice(2)
const parcels = only.length ? TEST_PARCELS.filter(p => only.includes(p.slug)) : TEST_PARCELS.slice(0, 4)

const realFetch = globalThis.fetch
const offline = () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith(mock.url)) return realFetch(input, init)
    throw new TypeError('fetch failed (symulowana awaria)')
  }) as typeof fetch
}

async function timed(id: string): Promise<{ ms: number; d: ReportData | null; err?: string }> {
  const t0 = Date.now()
  try {
    const d = await collectReportData(id, '')
    return { ms: Date.now() - t0, d }
  } catch (e) {
    return { ms: Date.now() - t0, d: null, err: e instanceof Error ? e.message : String(e) }
  }
}
const st = (d: ReportData | null) => d ? d.sources.map(s => `${s.source.split(' –')[0].split(' ')[0]}:${s.status}${s.stale ? '*' : ''}`).join(' ') : '—'

console.log('działka | zimny start | nowa instancja | awaria usług (cache po terminie)')
for (const p of parcels) {
  globalThis.fetch = realFetch
  clearCache()
  const cold = await timed(p.id)

  clearCache() // nowa instancja: pusta pamięć, baza zostaje
  const warm = await timed(p.id)

  await mock.db().exec(`UPDATE source_cache SET fresh_until = NOW() - interval '1 hour'`)
  clearCache()
  offline()
  const down = await timed(p.id)
  globalThis.fetch = realFetch

  const same = cold.d && down.d && cold.d.assessment.verdict === down.d.assessment.verdict
  // Ten sam znacznik czasu pobrania = wynik z cache, nie z usługi.
  const fromCache = warm.d && cold.d ? warm.d.sources.filter((s, i) => s.fetchedAt === cold.d!.sources[i]?.fetchedAt).length : 0
  console.log(`${p.slug} | ${cold.ms} ms | ${warm.ms} ms | ${down.ms} ms, ${down.d ? `werdykt ${same ? 'ten sam' : 'INNY'} (${down.d.assessment.verdict})` : `błąd: ${down.err}`}`)
  console.log(`   nowa instancja: ${fromCache}/${warm.d?.sources.length ?? 0} źródeł z cache; pobierane ponownie: ${warm.d?.sources.filter((s, i) => s.fetchedAt !== cold.d?.sources[i]?.fetchedAt).map(s => `${s.source.split(' –')[0]} (${s.status})`).join(', ') || '—'}`)
  console.log(`   zimny:  ${st(cold.d)}`)
  console.log(`   awaria: ${st(down.d)}   (* = dane z kopii)`)
}
const rows = (await mock.db().query<{ n: number; kb: number }>(`SELECT count(*)::int AS n, (sum(pg_column_size(value)) / 1024)::int AS kb FROM source_cache`)).rows[0]
console.log(`source_cache: ${rows.n} wpisów, ${rows.kb} KB`)
await mock.close()
