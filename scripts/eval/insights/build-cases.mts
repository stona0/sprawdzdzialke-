/**
 * Buduje zestaw przypadków do ewaluacji rekomendacji AI (src/lib/report/ai.ts):
 * prawdziwe działki → collectReportData → zamrożony ReportData w JSON.
 * Bez wywołań modelu — dane pochodzą z publicznych rejestrów.
 *
 * Dwie fazy:
 *   1. --resolve: ustala identyfikatory działek (ULDK, Rejestr Urbanistyczny) → parcels.json
 *      i wypisuje powiaty, dla których trzeba wygenerować kafle linii (npm run etl:power-lines).
 *   2. domyślnie: zbiera dane dla działek z parcels.json → cases/<id>.json + cases.md.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/eval/insights/build-cases.mts --resolve
 *   npx tsx --tsconfig tsconfig.json scripts/eval/insights/build-cases.mts --power-lines ./data/power-lines-eval
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { TEST_PARCELS } from '../../../tests/parcels'

// Jedna instancja modułów aplikacji (tsx dubluje moduły importowane z ESM — patrz cache-benchmark.mts).
const require = createRequire(import.meta.url)
const { collectReportData } = require('../../../src/lib/report/collect') as typeof import('../../../src/lib/report/collect')
const { buildFacts } = require('../../../src/lib/report/ai') as typeof import('../../../src/lib/report/ai')
const geo = require('../../../src/lib/geo') as typeof import('../../../src/lib/geo')
const { clearCache } = require('../../../src/lib/http') as typeof import('../../../src/lib/http')
type ReportData = import('../../../src/lib/report/collect').ReportData

const OUT = 'tests/eval/insights'
const PARCELS = path.join(OUT, 'parcels.json')
const pl = process.argv.indexOf('--power-lines')
if (pl >= 0) process.env.POWER_LINES_URL = process.argv[pl + 1]

interface Seed { slug: string; opis: string; id?: string; lat?: number; lng?: number; degrade?: string; degradeOpis?: string }
interface Resolved { slug: string; opis: string; parcelId: string; degrade?: string }

// Punkty dobrane tak, by pokryć typowe sytuacje kupującego; o tym, co faktycznie jest
// na działce, decydują dane z rejestrów (tagi liczone z danych, nie z tej listy).
const POINTS: Seed[] = [
  { slug: 'torun-wisla', opis: 'Toruń, okolice Wisły', lat: 53.0040, lng: 18.6150 },
  { slug: 'opole-odra', opis: 'Opole, okolice Odry', lat: 50.6640, lng: 17.9350 },
  { slug: 'sandomierz-wisla', opis: 'Sandomierz, dolina Wisły', lat: 50.6790, lng: 21.7600 },
  { slug: 'nysa-nysa-klodzka', opis: 'Nysa, dolina Nysy Kłodzkiej', lat: 50.4750, lng: 17.3200 },
  { slug: 'goniadz-biebrza', opis: 'Goniądz, dolina Biebrzy', lat: 53.4880, lng: 22.7400 },
  { slug: 'kampinos-skraj', opis: 'Skraj Puszczy Kampinoskiej', lat: 52.3300, lng: 20.6300 },
  { slug: 'ustrzyki-gorne', opis: 'Bieszczady, Ustrzyki Górne', lat: 49.1060, lng: 22.6500 },
  { slug: 'gdansk-centrum', opis: 'Gdańsk, śródmieście', lat: 54.3480, lng: 18.6530 },
  { slug: 'lodz-centrum', opis: 'Łódź, śródmieście', lat: 51.7680, lng: 19.4580 },
  { slug: 'lublin-przedmiescie', opis: 'Lublin, dzielnica mieszkaniowa', lat: 51.2300, lng: 22.5300 },
  { slug: 'bialystok-obrzeza', opis: 'Białystok, obrzeża', lat: 53.1600, lng: 23.0900 },
  { slug: 'szczecin-obrzeza', opis: 'Szczecin, obrzeża', lat: 53.4000, lng: 14.6400 },
  { slug: 'mazury-wies', opis: 'Mazury, wieś', lat: 53.8100, lng: 21.5700 },
  { slug: 'podkarpacie-wies', opis: 'Podkarpacie, wieś', lat: 49.9500, lng: 22.0500 },
  { slug: 'wielkopolska-wies', opis: 'Wielkopolska, wieś', lat: 52.2000, lng: 17.4000 },
  { slug: 'podlasie-wies', opis: 'Podlasie, wieś', lat: 52.9000, lng: 22.8000 },
  { slug: 'pomorze-wies', opis: 'Pomorze, wieś', lat: 54.2000, lng: 17.3000 },
  { slug: 'slask-podmiejska', opis: 'Śląsk, gmina podmiejska', lat: 50.2200, lng: 18.8000 },
]

// Przypadki z awarią części źródeł — realne zachowanie raportu, gdy rejestr nie odpowiada.
const DEGRADED: Seed[] = [
  { slug: 'awaria-powodz-przyroda', opis: 'Siechnice (OUZ)', id: '022308_5.0021.24', degrade: 'wody\\.isok\\.gov\\.pl|sdi\\.gdos\\.gov\\.pl', degradeOpis: 'awaria ISOK i GDOŚ' },
  { slug: 'awaria-mpzp-pog', opis: 'Długołęka, Kiełczów', id: '022302_2.0020.440/1', degrade: 'KrajowaIntegracjaMiejscowych|rejestr-urbanistyczny\\.gov\\.pl', degradeOpis: 'awaria KIMPZP i Rejestru Urbanistycznego' },
  { slug: 'awaria-uzbrojenie', opis: 'Milicz, Natura 2000', id: '021303_4.0001.AR_18.19/9', degrade: 'KrajowaIntegracjaUzbrojenia|overpass|power-lines', degradeOpis: 'awaria KIUT, BDOT10k i OSM' },
]

async function parcelAt(lat: number, lng: number): Promise<string | null> {
  const [x, y] = geo.fromWgs84({ lat, lng })
  const t = await (await fetch(`https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy=${x},${y},2180&result=id`)).text()
  const [status, id] = t.trim().split('\n')
  return status.startsWith('0') && id ? id.trim() : null
}

type RuFeature = { symbol: string; label: { point: { lat: number; lng: number } }; polygon: { exterior: [number, number][]; interiors: [number, number][][] } }

/** Działki z gmin z planem ogólnym w mocy w RU: na zmianę punkt w OUZ (strefa SJ) i poza OUZ. */
async function pogSeeds(count: number): Promise<Seed[]> {
  const body = { page: { number: 1, size: 100, sort: { sortBy: 'publishDate', direction: 'desc' } }, criteria: { query: '', statusList: null, publishDateFrom: null, publishDateTo: null, planValidFrom: null, planValidTo: null, publishedActVersions: 'CURRENT', planTypeList: ['MUNICIPAL_GENERAL_PLAN'], plansGroup: 'MUNICIPAL_GENERAL_PLAN' } }
  const res = await fetch('https://rejestr-urbanistyczny.gov.pl/api/public/published/query', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
  const acts = ((await res.json()).publishedActs as Array<{ publishedActId: number; spatialPlanningActStatus: string; commune: string }>)
    .filter(a => a.spatialPlanningActStatus === 'prawnie wiążący lub realizowany')
  const step = Math.max(1, Math.floor(acts.length / count)) // deterministycznie: co n-ty plan z listy
  const out: Seed[] = []
  for (let k = 0; k < count && k * step < acts.length; k++) {
    const a = acts[k * step]
    await new Promise(r => setTimeout(r, 1500)) // RU odpowiada 429 przy seriach zapytań
    const g = (await (await fetch(`https://rejestr-urbanistyczny.gov.pl/api/public/published-details/${a.publishedActId}/geometries`)).json())[0]
    const mp = (f: RuFeature) => [[f.polygon.exterior, ...f.polygon.interiors].map(r => r.map(([la, ln]) => geo.fromWgs84({ lat: la, lng: ln })))]
    const inOuz = (pt: { lat: number; lng: number }) =>
      (g.regulations as RuFeature[]).some(o => o.symbol === 'OUZ' && geo.pointInMultiPolygon(geo.fromWgs84(pt), mp(o)))
    const want = k % 2 === 0
    const zone = (g.planningZones as RuFeature[]).find(z => (want ? z.symbol === 'SJ' : ['SR', 'SN', 'SO'].includes(z.symbol)) && inOuz(z.label.point) === want)
    if (!zone) continue
    const name = a.commune.toLowerCase().replace(/[^a-ząćęłńóśźż]+/g, '-')
    out.push({ slug: `pog-${name}-${want ? 'ouz' : 'poza-ouz'}`, opis: `${a.commune}: plan ogólny w mocy (RU), strefa ${zone.symbol}, ${want ? 'w OUZ' : 'poza OUZ'}`, ...zone.label.point })
  }
  return out
}

const realFetch = globalThis.fetch
async function collect(id: string, degradePattern?: string): Promise<ReportData> {
  const degrade = degradePattern ? new RegExp(degradePattern) : null
  if (degrade) {
    // Ta sama działka mogła być zebrana wcześniej w tym procesie — bez tego awaria nie zadziała.
    clearCache()
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (degrade.test(url)) throw new TypeError('fetch failed (symulowana awaria źródła)')
      return realFetch(input, init)
    }) as typeof fetch
  }
  try {
    return await collectReportData(id, '')
  } finally {
    globalThis.fetch = realFetch
  }
}

function tagsFor(d: ReportData): string[] {
  const t: string[] = [d.assessment.verdict]
  if (d.flood?.scenarios.length) t.push('powodz')
  if (d.nature?.onParcel.length) t.push('natura')
  if (d.powerLines?.lines.some(l => l.klasa !== 'MV' && l.distanceM <= 100)) t.push('linia-wn')
  if (d.pog.plan?.zrodlo === 'Rejestr Urbanistyczny') t.push('pog-ru')
  if (d.pog.draft) t.push('projekt-pog')
  if (d.sources.some(s => s.status === 'error')) t.push('awaria-zrodla')
  return t
}

// ─── Faza 1: identyfikatory działek ──────────────────────────────────────────

if (process.argv.includes('--resolve')) {
  const seeds: Seed[] = [
    ...TEST_PARCELS.map(p => ({ slug: p.slug, opis: p.opis, id: p.id })),
    ...(await pogSeeds(6)),
    ...POINTS,
    ...DEGRADED,
  ]
  const resolved: Resolved[] = []
  for (const s of seeds) {
    const parcelId = s.id ?? (s.lat !== undefined && s.lng !== undefined ? await parcelAt(s.lat, s.lng) : null)
    if (!parcelId) { console.warn(`✘ ${s.slug}: brak działki w punkcie`); continue }
    resolved.push({ slug: s.slug, opis: s.degradeOpis ? `${s.opis} (${s.degradeOpis})` : s.opis, parcelId, ...(s.degrade ? { degrade: s.degrade } : {}) })
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(PARCELS, JSON.stringify(resolved, null, 1))
  console.log(`${resolved.length} działek → ${PARCELS}`)
  console.log(`Powiaty do ETL linii: ${[...new Set(resolved.map(r => r.parcelId.slice(0, 4)))].sort().join(',')}`)
  process.exit(0)
}

// ─── Faza 2: dane z rejestrów ────────────────────────────────────────────────

if (!existsSync(PARCELS)) {
  console.error(`Brak ${PARCELS} — najpierw uruchom z --resolve.`)
  process.exit(1)
}
const resolved = JSON.parse(readFileSync(PARCELS, 'utf8')) as Resolved[]
const cases: Array<{ id: string; tags: string[]; opis: string; parcelId: string; data: ReportData }> = []
for (const r of resolved) {
  try {
    const d = await collect(r.parcelId, r.degrade)
    d.utilityMapUrl = null
    cases.push({ id: r.slug, tags: tagsFor(d), opis: r.opis, parcelId: r.parcelId, data: d })
    console.log(`✔ ${r.slug} ${r.parcelId} → ${tagsFor(d).join(', ')}`)
  } catch (e) {
    console.warn(`✘ ${r.slug}: ${e instanceof Error ? e.message : e}`)
  }
}

mkdirSync(path.join(OUT, 'cases'), { recursive: true })
for (const c of cases) writeFileSync(path.join(OUT, 'cases', `${c.id}.json`), JSON.stringify(c, null, 1))

// Plik do przeglądu: dokładnie te fakty, które dostaje model.
const fence = (s: string) => '`'.repeat(Math.max(3, ...[...s.matchAll(/`+/g)].map(m => m[0].length + 1)))
const md = [
  `# Zestaw ewaluacyjny rekomendacji AI — ${cases.length} przypadków`,
  '',
  'Każdy przypadek to prawdziwa działka. Poniżej dokładnie te fakty (JSON), które dostaje model.',
  '',
  '| id | działka | werdykt | tagi | opis |',
  '|---|---|---|---|---|',
  ...cases.map(c => `| ${c.id} | ${c.parcelId} | ${c.data.assessment.verdict} | ${c.tags.slice(1).join(', ') || '—'} | ${c.opis} |`),
  '',
  ...cases.flatMap(c => {
    const facts = JSON.stringify(buildFacts(c.data), null, 1)
    const f = fence(facts)
    return [`## ${c.id}`, '', `${c.opis} — działka \`${c.parcelId}\`, ${c.data.parcel.gmina}`, '', `${f}json`, facts, f, '']
  }),
].join('\n')
writeFileSync(path.join(OUT, 'cases.md'), md)

const counts: Record<string, number> = {}
for (const c of cases) for (const t of c.tags) counts[t] = (counts[t] ?? 0) + 1
console.log(`\n${cases.length} przypadków; tagi: ${JSON.stringify(counts)}`)
