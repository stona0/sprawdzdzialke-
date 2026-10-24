/**
 * Powtarzalność odległości do sieci z KIUT (src/lib/sources/gesut.ts) na żywej usłudze.
 * Serwer KIUT na identyczne GetMap potrafi oddać obraz bez części sieci, więc to samo zapytanie
 * powtarzamy N razy (bez cache) i liczymy, jak często wynik danej sieci odbiega od najlepszego
 * znanego: najmniejszej odległości ze wszystkich prób (połączenie wszystkich narysowanych pikseli).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/gesut-stability.mts [-n 10] [slug...]
 */
import { createRequire } from 'node:module'
import { TEST_PARCELS } from '../tests/parcels'

// Jedna instancja http.ts (cache), jak w scripts/cache-benchmark.mts.
const require = createRequire(import.meta.url)
const { clearCache } = require('../src/lib/http') as typeof import('../src/lib/http')
const { getParcelData } = require('../src/lib/geoportal') as typeof import('../src/lib/geoportal')
const { queryGesut, NETWORKS } = require('../src/lib/sources/gesut') as typeof import('../src/lib/sources/gesut')
type Network = import('../src/lib/sources/gesut').Network

const args = process.argv.slice(2)
const nIdx = args.indexOf('-n')
const N = nIdx >= 0 ? Number(args.splice(nIdx, 2)[1]) : 10
const DEFAULT = [...TEST_PARCELS.filter(p => p.expect.gesut === 'ok').map(p => p.slug), 'sobotka-linia-110kv', 'siechnice-ouz']
const slugs = args.length ? args : DEFAULT
const parcels = TEST_PARCELS.filter(p => slugs.includes(p.slug))
const nets = Object.keys(NETWORKS) as Network[]
const fmt = (d: number | null | undefined) => (d === undefined ? 'err' : d === null ? '—' : `${d}`)

let unstableParcels = 0
for (const p of parcels) {
  const parcel = await getParcelData(p.id, '')
  if (!parcel.geom) { console.log(`${p.slug}: brak geometrii z ULDK`); continue }
  const runs: Array<{ status: string; ms: number; unconfirmed?: boolean; d: Partial<Record<Network, number | null>> }> = []
  for (let i = 0; i < N; i++) {
    clearCache()
    const r = await queryGesut(`${p.id}#${i}`, parcel.geom)
    const d: Partial<Record<Network, number | null>> = {}
    for (const n of nets) if (r.data) d[n] = r.data[n].distanceM
    runs.push({ status: r.status, ms: r.ms, unconfirmed: r.unconfirmed, d })
    // KIUT: 10 zapytań na 2 s z jednego adresu — bez przerwy mierzylibyśmy limit (429), a nie dane
    await new Promise(r => setTimeout(r, 2500))
  }
  console.log(`\n${p.slug} (${p.id}), ${N} prób`)
  const statuses = Object.entries(runs.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}))
  console.log(`  status: ${statuses.map(([s, k]) => `${s} ×${k}`).join(', ')}; czas ${Math.min(...runs.map(r => r.ms))}–${Math.max(...runs.map(r => r.ms))} ms` +
    `; niepotwierdzone (bez cache) ${runs.filter(r => r.unconfirmed).length}/${N}`)
  let parcelUnstable = false
  for (const n of nets) {
    const vals = runs.map(r => r.d[n])
    const nums = vals.filter((v): v is number => typeof v === 'number')
    const best = nums.length ? Math.min(...nums) : null
    // „gorszy” = brak sieci albo większa odległość niż w najlepszej próbie (±2 m = dokładność metody)
    const isWorse = (v: number | null | undefined) => v === undefined || (best !== null && (v === null || v > best + 2))
    const worse = vals.filter(isWorse).length
    // najgorszy przypadek: zgodne odpowiedzi, a wynik gorszy — trafiłby do cache na dobę
    const cachedWorse = runs.filter(r => isWorse(r.d[n]) && r.status !== 'error' && !r.unconfirmed).length
    const nulls = vals.filter(v => v === null).length
    if (worse) parcelUnstable = true
    console.log(`  ${n.padEnd(12)} najlepszy ${fmt(best).padStart(4)} m | brak sieci ${nulls}/${N} | gorszy od najlepszego ${worse}/${N}, w tym zapisany w cache ${cachedWorse} | ` +
      runs.map(r => `${fmt(r.d[n])}${r.unconfirmed ? '*' : ''}`).join(' '))
  }
  if (parcelUnstable) unstableParcels++
}
console.log(`\nDziałki z niestabilnym wynikiem: ${unstableParcels}/${parcels.length} (* = wynik niepotwierdzony, bez cache)`)
